# Audora

**Audora** is a self-hostable AI workspace intended to run open-weight models
on infrastructure controlled by Audora. It does not silently send prompts to
a third-party text-generation service. Optional image generation uses an
Audora-controlled local Diffusers checkpoint and never calls a hosted image API.

## Run the workspace

```bash
npm install
cp .env.example .env
npm start
```

The Node.js app expects a local OpenAI-compatible inference endpoint. The
default is `http://127.0.0.1:8000/v1/chat/completions`. If no model server is
running, chat reports a configuration error rather than falling back to an
outside provider.

## Run an unquantized open-weight model

Install CUDA-compatible PyTorch and vLLM, download an open-weight checkpoint
whose license permits your intended use, then launch it. Example:

```bash
vllm serve ./models/audora-checkpoint \
  --served-model-name audora-local \
  --dtype bfloat16 \
  --api-key replace-with-a-long-random-secret
```

Use BF16/FP16 safetensors if you specifically want non-quantized weights.
Avoid GGUF, AWQ, GPTQ, and 4-bit/8-bit quantized variants. BF16/FP16 are
floating-point formats (not quantized weights), although they are not FP32.
Set the same strong random API key (at least 32 characters) and model name in `.env`. Keep inference private
and authenticated; do not expose an unauthenticated model endpoint publicly.

## Fine-tune Audora

Two starter paths are included:

- `training/train.py`: full fine-tuning with the original model loaded in
  BF16/FP16; no quantized loading and no LoRA adapters.
- `training/train_lora.py`: lower-memory LoRA/PEFT option that trains
  adapter weights while leaving the base model frozen.

Both training scripts mask user/system prompt tokens from the loss and train on assistant response tokens only. Full fine-tuning requires substantially more GPU memory because weights,
gradients, optimizer states, and activations all consume memory. LoRA is more
practical on smaller GPUs, but it does not change the base weights. Neither
method is training a foundation model from scratch.

For full fine-tuning, copy the example data, add your reviewed examples, and run:

```bash
cp training/data/train.example.jsonl training/data/train.jsonl
pip install -r training/requirements.txt
python training/train.py --model Qwen/Qwen2.5-0.5B-Instruct --data training/data/train.jsonl --output models/audora-checkpoint
```

For LoRA, follow the instructions in `training/train_lora.py`. Install a
CUDA-compatible PyTorch build first. GitHub stores source code and
configuration; it does not provide the GPU compute or storage needed to train
a model. Check model and dataset licenses, use only data you have permission
to train on, remove personal information, deduplicate examples, and keep a
held-out evaluation set. Fine-tuning does not automatically make every answer
more accurate.

After training, serve the resulting full checkpoint or merged adapter with
vLLM and configure `AUDORA_API_URL`, `AUDORA_API_KEY`, and `AUDORA_MODEL`
in the server environment. Never commit real credentials or model secrets.

## Reasoning and answer quality

Audora is instructed to provide useful explanations, assumptions, key steps,
checks, and verifiable conclusions. It does not expose private internal
chain-of-thought. Test the final answers for correctness, factuality, and
consistency instead of exposing hidden scratchpad reasoning.

## Existing workspace capabilities

Chat history and profile memory are stored in browser local storage. There is
no account login, cross-device sync, or cloud chat database in this starter.
Text/code attachments and safe Markdown rendering are supported. Web search and source-link citations are available when SearXNG is configured; live token streaming is supported by compatible and Ollama providers. Autonomous multi-step tool execution is not yet implemented.
Image generation has a self-hosted UI/API path; it remains disabled until a local Diffusers checkpoint, CUDA GPU, and matching server secret are configured. See `image/README.md`.

## Web search with source citations

Audora can retrieve live search results through a SearXNG instance that you
control. Install and run SearXNG, enable JSON output in its search settings, then set the server-only environment variable:

```bash
AUDORA_SEARCH_URL=http://127.0.0.1:8080/search
```

Restart Audora. The search button appears in the composer when the endpoint is configured. Search snippets are passed to the model as untrusted evidence; the model is instructed to cite source URLs and not follow instructions embedded in web pages. Search is optional and does not silently fall back to a third-party search provider. SearXNG's JSON API requires `format=json` to be enabled by the instance administrator.

## Self-hosted image generation

See `image/README.md` to install the local Diffusers service and provide an already-downloaded, properly licensed SDXL checkpoint. The Node API proxies only to the configured private image service. The model server loads from disk with `local_files_only=True`; it does not download weights or call Pollinations/other hosted image providers. A CUDA GPU and substantial VRAM are required. Do not expose the image service publicly.

## Everyday user guide

See [the everyday user guide](docs/USER-GUIDE.md) for first-time setup status, everyday workspace tools, privacy, and troubleshooting.

## Free hosted deployment

See [free hosting](docs/FREE-HOSTING.md) for a Render Free blueprint that hosts the Audora interface and API gateway with a public HTTPS URL. The model runtime, web search service, and image-generation engine remain separate services and must be configured independently.

## Deployment and configuration doctor

See [the deployment guide](docs/DEPLOYMENT.md) for the Docker Compose GPU stack, model setup, optional services, and production security notes. Copy `.env.compose.example` to `.env` when using Compose. Run `npm run doctor` to check local configuration and reveal remaining infrastructure gaps; this check does not claim that a model or GPU is online.

See the [release acceptance checklist](docs/RELEASE-CHECKLIST.md) before a public launch.

## Tests and production

```bash
npm test
npm run build
```

Tests mock the local inference server; they verify request construction and
error handling, not model quality or GPU availability. A real end-to-end check
requires the actual checkpoint and inference server.

Before public launch, configure identity, durable rate limiting, monitoring,
HTTPS, access controls, backups, and infrastructure capacity. The built-in
rate limiter is per-process. Chat history is local to the current browser;
the inference server receives the context submitted for each request.

## Audora Wiki

Project documentation, setup instructions, architecture notes, known limitations, and deployment guidance:
[Open the Audora Wiki](docs/AUDORA-WIKI.md).
