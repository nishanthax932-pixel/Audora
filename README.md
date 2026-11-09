# Audora

**Audora** is a self-hostable AI workspace intended to run open-weight models
on infrastructure controlled by Audora. It does not silently send prompts to
a third-party text-generation service. Image generation has been removed
until an Audora-owned image model and inference stack exist.

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
  --api-key local-audora-key
```

Use BF16/FP16 safetensors if you specifically want non-quantized weights.
Avoid GGUF, AWQ, GPTQ, and 4-bit/8-bit quantized variants. BF16/FP16 are
floating-point formats (not quantized weights), although they are not FP32.
Set the same local API key and model name in `.env`. Keep inference private
and authenticated; do not expose an unauthenticated model endpoint publicly.

## Fine-tune Audora

Two starter paths are included:

- `training/train.py`: full fine-tuning with the original model loaded in
  BF16/FP16; no quantized loading and no LoRA adapters.
- `training/train_lora.py`: a lower-memory LoRA/PEFT option that trains
  adapter weights while leaving the base model frozen.

Full fine-tuning requires substantially more GPU memory because weights,
gradients, optimizer states, and activations all consume memory. LoRA is more
practical on smaller GPUs, but it does not change the base weights. Neither
method is training a foundation model from scratch.

For full fine-tuning, prepare a reviewed, permissioned JSONL dataset and run:

```bash
pip install -r training/requirements.txt
python training/train.py --model Qwen/Qwen2.5-0.5B-Instruct --data data/audora_train.jsonl --output models/audora-checkpoint
```

For the LoRA path, follow the instructions in `training/train_lora.py` and
the example dataset under `training/data/`. Install a CUDA-compatible
PyTorch build first. GitHub stores source code and configuration; it does not
provide the GPU compute or storage needed to train a model. Check model and
dataset licenses, use only data you have permission to train on, remove
personal information, deduplicate examples, and keep a held-out evaluation
set. Fine-tuning does not automatically make every answer more accurate.

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
Text/code attachments and safe Markdown rendering are supported. Web search,
citations, streaming, and multi-step tool execution are not yet implemented.
Image generation is intentionally unavailable.

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
