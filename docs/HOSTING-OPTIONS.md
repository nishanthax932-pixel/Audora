# Audora hosting options: choose a real inference runtime

Audora has two separate parts:

1. The Node.js workspace (UI + API gateway).
2. The model runtime that generates answers.

A free web host can run the first part. It does not automatically provide a free GPU or a permanently available large language model. Keep model credentials on the server; never place them in browser JavaScript or commit them to Git.

## Recommended zero-recurring-hosting-cost setup (if you have a suitable PC)

**Render Free for the public workspace + your own PC for model inference.**

- Deploy the app using [FREE-HOSTING.md](FREE-HOSTING.md).
- Run vLLM on a PC with a supported NVIDIA GPU and a model that fits its VRAM.
- Publish only the vLLM endpoint through a Cloudflare Tunnel. Cloudflare Tunnel requires a Cloudflare account and a domain on Cloudflare for a stable published hostname.
- Keep vLLM's API-key authentication enabled. Do not expose port 8000 directly to the internet.
- In Render's server-side environment variables set:
  - `AUDORA_PROVIDER=compatible`
  - `AUDORA_API_URL=https://llm.example.com/v1/chat/completions`
  - `AUDORA_API_KEY=<the-same-long-random-vLLM-key>`
  - `AUDORA_MODEL=<the-exact-served-model-name>`

The PC must stay powered on and connected. If it sleeps or disconnects, chat will be unavailable until it returns. The public app can still be hosted separately. This route avoids a recurring GPU-hosting bill, but uses your electricity, hardware, internet connection, and domain.

Official setup references:
- [Cloudflare Tunnel: get started](https://developers.cloudflare.com/tunnel/get-started/)
- [Cloudflare Tunnel tokens](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/)

## Alternative: Oracle Cloud Always Free CPU VM (limited)

Oracle currently documents an Always Free Ampere A1 allowance equivalent to **2 OCPUs and 12 GB RAM** in the home region. This is CPU-only compute, not a free GPU. It may be enough to experiment with a small CPU-compatible quantized model using an ARM-compatible runtime, but expect slower responses and limited concurrency. It is not a realistic replacement for a high-end GPU serving a large model.

Important constraints:
- Free capacity may be unavailable in a region ("out of host capacity").
- Oracle says idle Always Free compute instances can be reclaimed under its utilization rules.
- Account verification may be required. Never upgrade to a paid account or provision paid resources unless you deliberately accept the cost.
- Set budgets/compartment quotas where available and verify the resource is marked Always Free before creating it.

References:
- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)

## Alternative: hosted inference credits (testing only)

Hugging Face currently documents **$0.10/month** in Inference Provider credits for free users, subject to change. This can help test a small number of requests, but it is not enough to promise continuous free service to public Audora users. Do not enable pay-as-you-go billing unless you intentionally choose it and set a spending limit.

Reference: [Hugging Face Inference Providers pricing](https://huggingface.co/docs/inference-providers/pricing)

## What not to rely on for a permanent public AI service

- Free notebook sessions (Colab/Kaggle-style): useful for experiments, but sessions can stop and are not a stable always-on inference server.
- A free web app host by itself: it hosts Audora's interface/API, not model weights or GPU inference.
- A temporary public tunnel: useful for a short test, not a production endpoint.

## Honest deployment status

The Render Blueprint creates only the app service after you authorize it in Render. It does not deploy a model, SearXNG, or the image-generation GPU service. The `/api/health` endpoint reports configuration status and intentionally keeps `liveInferenceVerified: false`; it must not be interpreted as proof that a model is responding.

Before calling Audora live:
1. Deploy the web app.
2. Configure a real inference endpoint and server-side secret.
3. Send a real prompt through the public Audora URL.
4. Confirm the response came from the configured model and inspect server logs for errors.
5. Separately test search and image generation; they are independent services.

**Recommendation:** use Render + PC inference if a suitable PC is available. If there is no PC and the requirement is strictly no-cost cloud hosting, Oracle's small CPU VM is an experiment, not a ChatGPT-scale solution. There is no dependable permanent free GPU option documented here.
