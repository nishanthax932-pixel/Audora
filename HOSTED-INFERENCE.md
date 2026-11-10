# Hosted AI inference setup

The Audora web service and the AI model are two separate services. Deploying the Node/Express app to Render does **not** start vLLM, Ollama, or download a model checkpoint.

## Configure DeepSeek (recommended quick setup)

DeepSeek exposes an OpenAI-compatible chat-completions API, so Audora can connect without a separate vLLM server. In Render, open the Audora web service → **Environment** and set:

- `AUDORA_PROVIDER=deepseek`
- `AUDORA_API_URL=https://api.deepseek.com/chat/completions`
- `AUDORA_API_KEY=YOUR_DEEPSEEK_API_KEY` (create it in the [DeepSeek Platform](https://platform.deepseek.com/); keep it secret)
- `AUDORA_MODEL=deepseek-flash`

For stronger, more expensive reasoning you can choose `deepseek-v4-pro`; use `deepseek-flash` as the normal default. Audora sends DeepSeek thinking mode enabled when its Reasoning option is enabled, and disabled otherwise. DeepSeek API usage is billed separately; the free DeepSeek chat website does not mean API calls are free. Check current pricing and account balance before use.

After saving variables, redeploy and test a real chat prompt. `/api/health` only checks that configuration exists; it does not prove that the key works or that a model can answer.

## Configure another hosted OpenAI-compatible model endpoint

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
