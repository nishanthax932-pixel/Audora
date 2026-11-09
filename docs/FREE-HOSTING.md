# Free hosted deployment

This setup deploys the Audora web app and API gateway to a free Render web service. It gives the project a public HTTPS URL without requiring a credit card for the Free web-service tier at the time this guide was written.

## One-click blueprint deploy

1. Open the Render Blueprint flow: https://render.com/deploy
2. Connect the GitHub repository `nishanthax932-pixel/Audora`.
3. Select the `render.yaml` blueprint and approve creation of the `audora-workspace` service.
4. Wait for the first deploy to finish. Render will assign a public `onrender.com` URL; open that URL to use the Audora workspace.
5. Keep the service on the Free plan. Do not add a paid database or paid instance unless you intentionally choose to.

The service uses the repository's `main` branch, runs `npm ci` and `npm start`, and checks `/api/health`.

## Important: hosting is not an AI model

This deploy hosts the Audora interface and Node API. It does **not** create or train a language model, GPU, image model, or web-search index. Without an inference endpoint configured, the interface opens but chat correctly reports that the AI engine still needs setup.

To enable chat, configure these server-side Render environment variables with an OpenAI-compatible inference endpoint you control:

- `AUDORA_API_URL`: full chat-completions endpoint, e.g. `https://YOUR-HOST/v1/chat/completions`
- `AUDORA_API_KEY`: provider key / shared secret
- `AUDORA_MODEL`: exact model ID served by that endpoint
- Optional `AUDORA_MODELS`: JSON array of model IDs and labels for the model picker

Never put a private key in browser JavaScript, `runtime-config.js`, GitHub, or a public issue. Do not configure a provider that may incur charges unless you have checked its billing and set a hard usage limit. A provider's free tier can change or run out.

For live web search, configure `AUDORA_SEARCH_URL` to a SearXNG JSON search endpoint reachable from the Render service. Image generation similarly needs a separate compatible self-hosted Diffusers service and `AUDORA_IMAGE_API_URL` / `AUDORA_IMAGE_API_KEY`.

## Free-plan limits

Render Free web services spin down after 15 minutes without inbound traffic and can take about a minute to wake up. Their filesystem is ephemeral, so files written by the app are not durable. Free instances can restart and have monthly usage limits. This is suitable for a demo or hobby deployment, not production hosting for thousands of users. Chat history remains in each visitor's browser; this deployment does not add accounts or cloud sync.

See the current provider limits before deploying: https://render.com/docs/free

## Verify after deployment

- Open `/api/health` on the assigned Render URL.
- Confirm the response says `liveInferenceVerified: false` until you have independently tested real model output.
- Send a test prompt only after a valid inference endpoint and model ID are configured.
- Check Render deploy logs if the health check fails.

The GitHub repository cannot create the Render service or choose its public URL on your behalf. The Render account owner must authorize the repository connection and create the service.
