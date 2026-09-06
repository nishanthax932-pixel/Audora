# Audora

**Audora** is an online, white-label AI workspace with a ChatGPT-inspired chat
experience and provider-agnostic inference layer. It is a practical foundation
for a custom model product—not a claim of artificial general intelligence.

## Run locally

```bash
npm install
cp .env.example .env
# Add an API key and compatible model name to .env (loaded automatically)
npm start
```

Open `http://localhost:3000`. Without provider credentials, the interface still
runs and clearly reports that inference has not yet been configured.

## Configuration

Audora sends chat-completions requests to `AUDORA_API_URL`. Configure it with an
OpenAI-compatible hosted model provider, set `AUDORA_API_KEY`, and choose a
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
only protects a single server instance. Set request/spend limits with your
inference provider, use HTTPS, and add monitoring. This application is an AI
workspace; it does not itself train or constitute an AGI model.

## Building a real custom model

The responsible path to a distinct Audora model is to evaluate a suitable
open-weight base model, curate consented task data, fine-tune and evaluate it,
then deploy the resulting checkpoint behind this service. Training a
frontier-scale foundation model from scratch requires large-scale data,
specialized GPU infrastructure, and rigorous safety evaluation.
