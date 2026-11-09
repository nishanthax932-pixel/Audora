# Audora

**Audora** is an online, white-label AI workspace with a ChatGPT-inspired chat
experience and provider-agnostic inference layer. It is a practical foundation
for a custom model product—not a claim of artificial general intelligence.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` and chat. With no configuration at all, Audora
answers through a free shared model tier so the app works out of the box at
zero cost. That tier is rate-limited, can be busy at peak times, and messages
leave your machine to an outside free service - do not discuss secrets on it,
and expect occasional "free tier is busy" replies.

## Test

```bash
npm install
npm test
```

Runs the server test suite (validation, rate limiting, provider behavior,
error handling). No API key is needed - provider calls are simulated in tests.

For your own provider, copy `.env.example` to `.env` and either point Audora at
an OpenAI-compatible hosted provider (`AUDORA_PROVIDER=compatible`,
`AUDORA_API_URL`, `AUDORA_API_KEY`) or run a local model with Ollama
(`AUDORA_PROVIDER=ollama`, no cloud key needed). Keep API keys only in
environment variables - never in browser code.

## Chat history and privacy

Chat history is stored in the current browser's local storage on that device.
It is not synced between devices and there is no account login or cloud chat
database in this starter version. Use **Export conversations** in the sidebar
to save a JSON backup. Clearing browser site data can remove local history.
The UI keeps a bounded number of recent chats and supports searching and
deleting individual conversations.

The selected inference provider receives the message context sent by the
server. In the default free mode, prompts are sent to the external free-tier
provider; local Ollama mode sends prompts to the Ollama host. Do not send
passwords, API keys, or sensitive personal information to an untrusted provider.

## Deploy without 404 errors

The browser UI and `/api/*` server must be deployed together, or the UI needs
the URL of a separately deployed Audora API. A static-only host cannot run the
chat server or Ollama and will return `404` for `/api/config` and `/api/chat`.

### Deploy the full application together

Deploy this repository to any host that runs Node applications, set its start
command to `npm start`, and expose port `3000`. A container deployment can use:

```bash
docker build -t audora .
docker run --env-file .env -p 3000:3000 audora
```

### Deploy the UI and API separately

Deploy this Node application as the API, then edit `public/runtime-config.js`
before deploying the `public` directory to a static host:

```js
window.AUDORA_RUNTIME_CONFIG = { apiBaseUrl: "https://your-audora-api.example" };
```

Set `AUDORA_ALLOWED_ORIGINS=https://your-static-site.example` on the API. The
server permits only listed cross-origin browser requests; do not use `*`.

## Configuration

### Use Audora with no cloud API key

Audora supports local Ollama inference. Install [Ollama](https://ollama.com),
then run the following once before starting Audora:

```bash
ollama pull qwen3:8b
ollama serve
npm start
```

Set `AUDORA_PROVIDER=ollama` in `.env` to use Ollama; the example file documents
the optional setting. No cloud API key is needed in this mode. Your prompts
stay on the machine running Ollama. This is still a
real language model, but its quality and hardware requirements depend on the
model you choose—it is not an AGI.

### Use a hosted provider

Set `AUDORA_PROVIDER=compatible`, configure `AUDORA_API_URL` with a
compatible chat-completions endpoint, set `AUDORA_API_KEY`, and choose a
model through `AUDORA_MODEL`. Keep API keys only in environment variables—never
in browser code.

### White-labeling

Set `AUDORA_BRAND_NAME`, `AUDORA_BRAND_TAGLINE`, `AUDORA_ACCENT_COLOR`, and
`AUDORA_WELCOME_MESSAGE` to make the workspace your own. These safe branding
values are delivered by `/api/config`; credentials remain server-only. Use
`AUDORA_MODELS` to control models users can select. It is a JSON array, where
each model has a user-facing `label` and a provider-facing `id`.

## Production checklist

Before a public launch, configure a real identity provider and a shared,
durable rate limiter/database. The included rate limiter is per-process and
only protects a single server instance. By default, forwarded IP headers are
not trusted; set `AUDORA_TRUST_PROXY=1` only when exactly one trusted reverse
proxy sits in front of Node. The free provider also has a shared upstream
cooldown, so one visitor may temporarily delay other free-tier visitors.
Set request/spend limits with your inference provider, use HTTPS, and add monitoring. This application is an AI
workspace; it does not itself train or constitute an AGI model.

## Fine-tune an Audora model

Audora includes a reproducible supervised fine-tuning starter under `training/`.
It uses an openly available pretrained model plus LoRA adapters (PEFT). The
base checkpoint is not quantized by this starter: choose a model that fits the
GPU memory available. LoRA trains a small set of adapter weights while leaving
the original model weights frozen; it does not create a frontier model from
scratch.

1. Choose an open-weight base model whose license permits your intended use.
2. Prepare reviewed, consented examples in JSONL format using
   `training/data/train.example.jsonl` as the schema.
3. Create a Python environment and install `training/requirements.txt`.
4. Set `AUDORA_BASE_MODEL` and `AUDORA_TRAIN_FILE`, then run
   `python training/train_lora.py`.
5. Evaluate the adapter on held-out examples before deploying it.

The starter defaults to `Qwen/Qwen2.5-1.5B-Instruct` as a modest example, not
as a claim that it is the best model. Training requires a compatible GPU and
enough VRAM for the full-precision/base-precision checkpoint you select.
No model weights or training run are included in this repository. Do not
upload private user conversations, secrets, or personal data as training
examples without explicit permission.

To serve the trained model locally, merge/load the adapter in a compatible
Transformers runtime or export it to a supported inference format, then point
Audora at a local OpenAI-compatible inference server. The existing Ollama
provider remains available for local inference; a LoRA adapter must first be
converted/merged to a format supported by your chosen Ollama workflow.

## Image generation

Image generation has been removed. Audora does not call Pollinations or another
third-party image-generation API, and the composer no longer offers image mode.
An in-house image model is a separate project: it would require selecting an
open-weight diffusion model, checking its license, fine-tuning it on permitted
images, and providing GPU inference capacity. Until that exists, image
generation is intentionally unavailable.

The chat model currently returns normal text completions. Web search and
multi-step function/tool calling are not yet wired into the request lifecycle.
For reasoning questions, ask for a concise explanation or visible solution
steps; the app does not expose private internal chain-of-thought.
