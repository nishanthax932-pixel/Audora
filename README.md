# Audora

**Audora** is an online AI assistant with its own identity, safety-oriented
behavior, and provider-agnostic inference layer. It is a practical foundation
for a custom model product—not a claim of artificial general intelligence.

## Run locally

```bash
npm install
cp .env.example .env
# Add an API key and compatible model name to .env
npm start
```

Open `http://localhost:3000`. Without provider credentials, the interface still
runs and clearly reports that inference has not yet been configured.

## Configuration

Audora sends chat-completions requests to `AUDORA_API_URL`. Configure it with an
OpenAI-compatible hosted model provider, set `AUDORA_API_KEY`, and choose a
model through `AUDORA_MODEL`. Keep API keys only in environment variables—never
in browser code.

## Building a real custom model

The responsible path to a distinct Audora model is to evaluate a suitable
open-weight base model, curate consented task data, fine-tune and evaluate it,
then deploy the resulting checkpoint behind this service. Training a
frontier-scale foundation model from scratch requires large-scale data,
specialized GPU infrastructure, and rigorous safety evaluation.
