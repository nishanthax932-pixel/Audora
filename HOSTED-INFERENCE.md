# Hosted AI inference setup

The Audora web service and the AI model are two separate services. Deploying the Node/Express app to Render does **not** start vLLM, Ollama, or download a model checkpoint.

## Configure a hosted OpenAI-compatible model endpoint

In Render, open the Audora web service → **Environment** and set:

- `AUDORA_PROVIDER=compatible`
- `AUDORA_API_URL=https://YOUR-MODEL-HOST/v1/chat/completions`
- `AUDORA_API_KEY=YOUR_PROVIDER_SECRET` (keep this secret; never put it in browser code or chat)
- `AUDORA_MODEL=THE_EXACT_MODEL_ID_EXPOSED_BY_YOUR_ENDPOINT`

The endpoint must be reachable from the Render service and accept OpenAI-compatible chat-completions requests. A local URL such as `http://127.0.0.1:8000` or `http://localhost:8000` will not work on Render: it points to the Audora container itself, not a model running on another device.

After saving environment variables, redeploy the service. Visit `/api/health` and check `providerConfigured`. This only checks configuration, not a real model response; send a test prompt to verify inference.

## Ollama

Ollama mode does not require `AUDORA_API_KEY`, but the Ollama URL must still be securely reachable from the hosted Audora server:

- `AUDORA_PROVIDER=ollama`
- `AUDORA_OLLAMA_URL=https://YOUR-SECURE-OLLAMA-ENDPOINT/api/chat`
- `AUDORA_MODEL=YOUR_INSTALLED_MODEL_TAG`

Do not expose an unauthenticated Ollama or vLLM server to the public internet. Use a private network, authenticated gateway, or provider-supported secure endpoint.

## Cost and privacy

Audora does not provide free GPU inference merely because the web app runs on Render's free web-service tier. Model hosting may have free quotas, usage limits, or charges depending on the provider. Check provider pricing and privacy terms before connecting it. Never commit API keys, model tokens, or private endpoints to Git.
