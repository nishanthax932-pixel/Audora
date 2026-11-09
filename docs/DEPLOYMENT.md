# Audora deployment guide

This guide separates the application from the model runtime. Audora's Node.js workspace is the UI/API gateway; it is not itself a trained foundation model.

## 1. Requirements

- Linux host with Docker Engine and the Docker Compose plugin.
- NVIDIA GPU, current NVIDIA driver, and NVIDIA Container Toolkit for the bundled vLLM service.
- A local, already-downloaded open-weight checkpoint in a vLLM-compatible format.
- A model license that permits your intended use.
- Enough GPU VRAM and system RAM for the chosen model and context length.

The included Compose stack expects an unquantized BF16 checkpoint at `./models/audora`. It deliberately does not download model weights at startup.

## 2. Prepare secrets and model files

From the repository root:

```bash
cp .env.compose.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the generated value into `AUDORA_API_KEY` in `.env`. Use the same secret for the gateway and vLLM. Do not commit `.env`, publish it in logs, or expose the vLLM port publicly.

Place the complete checkpoint files in `./models/audora` (or change `AUDORA_MODEL_DIR`). Check that the model's tokenizer, configuration, and weight files are present and that its license is suitable.

## 3. Start

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f app inference
```

Open `http://localhost:3000`. The app port is bound to loopback by default. Put a properly configured HTTPS reverse proxy in front of it before remote access. Do not publish the inference service port.

Run the configuration doctor:

```bash
node scripts/doctor.mjs
```

The doctor validates local configuration and explains known gaps. It does not contact the GPU, prove the model is loaded, or validate model output.

## 4. Optional services

### Web search

Run a SearXNG instance on a private network reachable by the app container, enable JSON output, and set `AUDORA_SEARCH_URL` in the app service environment (for example, `http://searxng:8080/search`). Restart the app. Do not expose an unrestricted search endpoint to the public internet.

### Image generation

The image service is a separate optional Python/CUDA process. Follow [image engine setup](../image/README.md), mount a licensed Diffusers-format SDXL checkpoint, and keep the service on loopback/private networking. Configure `AUDORA_IMAGE_API_URL` and `AUDORA_IMAGE_API_KEY` only on the server. No image weights are included in this repository.

## 5. Operations and security

- Keep inference and image-generation ports private; only the HTTPS gateway should be public.
- Terminate TLS at a trusted reverse proxy. Configure `AUDORA_TRUST_PROXY=1` only when exactly one trusted proxy is in front of the Node app.
- The built-in rate limiter is process-local. Use a shared limiter/store for multiple replicas.
- The current chat/profile store is browser local storage. It is not a cloud account system and does not provide cross-device sync or server-side backups.
- Add authentication and authorization before multi-user exposure. Do not treat the optional profile email field as login.
- Configure request-size limits, provider spend/compute limits, monitoring, log retention, backups, and an incident-response contact.
- Keep model files and user data out of public Git history.
- Review model and dataset licenses and use only training data you have permission to use.

## 6. What is not included

This repository does not include model weights, a trained Audora foundation model, GPU capacity, a hosted deployment, cloud identity, durable multi-user storage, or a production moderation/abuse system. CI tests mock inference endpoints; they do not prove real model quality or image generation. These require real infrastructure and end-to-end testing.
