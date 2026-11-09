# Audora Wiki

> Audora — a self-hostable AI workspace by Audora Tech.

This page is the project documentation hub. It describes what is in the repository, how to run it, and what must be configured before real AI inference is available.

## 1. Project overview

Audora is designed to provide a chat workspace around open-weight models hosted on infrastructure controlled by the operator. The application code is not itself a trained foundation model. A separately downloaded, licensed model checkpoint and inference server are required.

## 2. Current workspace features

- Multiple conversations with local history and search
- Copy responses, stop generation, and export conversations
- Streaming responses with compatible OpenAI-style and Ollama providers
- Detailed-answer mode with visible explanations and checks (not private chain-of-thought)
- Text and code file attachments
- Safe Markdown and HTTP(S) source links
- Optional web search through a configured SearXNG server
- Self-hosted Diffusers/SDXL image-generation service integration
- Fine-tuning and LoRA starter scripts
- Request validation, rate limiting, safer error handling, and browser security hardening

## 3. Quick start

Requirements: a supported Node.js version (20 or 22), npm, and a local inference server for actual chat.

```bash
git clone https://github.com/nishanthax932-pixel/Audora.git
cd Audora
npm install
cp .env.example .env
npm start
```

Run the automated checks:

```bash
npm test
npm run build
```

The automated tests use mocked inference services. Passing tests do not prove that a real model, GPU, or deployment is working.

## 4. Connect a local language model

Audora uses an OpenAI-compatible chat-completions endpoint by default:

- Default endpoint: `http://127.0.0.1:8000/v1/chat/completions`
- Model ID: `audora-local`
- Configure `AUDORA_API_URL`, `AUDORA_API_KEY`, and `AUDORA_MODEL` in the server environment.

Example vLLM launch:

```bash
vllm serve ./models/audora-checkpoint \
  --served-model-name audora-local \
  --dtype bfloat16 \
  --api-key replace-with-a-long-random-secret
```

Use a model whose license permits your intended use. Keep the inference endpoint private and authenticated. Do not commit API keys or model secrets.

## 5. Web search

Run your own SearXNG instance, enable JSON output, and set:

```bash
AUDORA_SEARCH_URL=http://127.0.0.1:8080/search
```

Restart Audora. The search control appears when the endpoint is configured. Search results are untrusted evidence; links should be checked at their original sources.

## 6. Image generation

The image service requires a locally installed Diffusers-format SDXL checkpoint, compatible CUDA/PyTorch setup, sufficient GPU memory, and matching image-service authentication secrets. Follow [image/README.md](../image/README.md).

Image generation is not ready merely because the UI exists; it must be configured and tested on the target GPU.

## 7. Training and customization

- `training/train.py`: full fine-tuning starter.
- `training/train_lora.py`: LoRA/PEFT starter.

These scripts do not contain trained Audora weights and do not train a foundation model from scratch. Use clean, permissioned datasets, check licenses, remove personal information, and evaluate on held-out examples.

## 8. Privacy and deployment notes

- Chat history and profile memory are browser-local in this starter.
- There is no account login, cloud chat database, or cross-device sync yet.
- A configured inference server receives the conversation context submitted for each request.
- The built-in rate limiter is per process.
- Before public deployment, add identity and access management, durable rate limiting, HTTPS, monitoring, backups, and capacity planning.
- Never expose unauthenticated model or image endpoints to the public internet.

## 9. Known gaps

Autonomous multi-step tool execution, PDF/Office parsing, cloud accounts/history, cross-device sync, and production multi-user infrastructure are not implemented. Real inference quality, GPU image generation, and live deployment need separate end-to-end validation.

## 10. Useful links

- [Audora source repository](https://github.com/nishanthax932-pixel/Audora)
- [README and setup guide](../README.md)
- [Image service setup](../image/README.md)
- [Issues and bug reports](https://github.com/nishanthax932-pixel/Audora/issues)
