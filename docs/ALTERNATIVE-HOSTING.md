# Alternative free deployment: run Audora on your own PC

Render is the easiest no-card hosted option for the current Express app, but its Free web service sleeps after 15 minutes of inactivity. This alternative keeps the app and model on hardware you control and exposes only the Audora web app through a Cloudflare Tunnel.

## What this method gives you

- A public HTTPS tunnel URL for testing and personal use.
- Your model runs on your own PC through Ollama or an OpenAI-compatible local inference server.
- No rented GPU or hosted model API is required.
- Prompts go to the model endpoint you configure; they are not automatically sent to a hosted inference provider.

## What it does not give you

- It is not always-on: your PC, internet connection, Audora server, and model must stay running.
- A temporary Quick Tunnel URL can change and is not a permanent branded domain.
- Your PC's CPU/GPU determines response speed and model size.
- This is not a production multi-user deployment. The repository still has browser-local history and no server-side user accounts.

## Setup

1. Install Node.js 22 and install Ollama from https://ollama.com/download.
2. In a terminal, pull a model that your PC can run. For example, a small model:
   ```bash
   ollama pull qwen3:0.6b
   ```
   Choose a larger model only if your RAM/VRAM can handle it.
3. In the Audora repository, install dependencies:
   ```bash
   npm ci
   ```
4. Create a local `.env` file with:
   ```env
   AUDORA_PROVIDER=ollama
   AUDORA_MODEL=qwen3:0.6b
   AUDORA_OLLAMA_URL=http://127.0.0.1:11434/api/chat
   AUDORA_TRUST_PROXY=1
   ```
   Keep this file private. Do not commit it or put secrets in browser code.
5. Start Audora:
   ```bash
   npm start
   ```
   Verify locally at http://localhost:3000 and check http://localhost:3000/api/health.
6. Install `cloudflared` from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ and open a second terminal:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
7. Open the temporary `https://….trycloudflare.com` URL printed by cloudflared.

## Security notes

- Tunnel only port 3000 (the Audora web app). Do not tunnel Ollama's port 11434 or a vLLM port directly.
- Keep model endpoints bound to localhost and keep API keys in the server-side `.env` file.
- Stop the tunnel when you are finished. A public link allows other people to reach the app; the current project does not yet have full user authentication or durable shared rate limiting.
- Do not use a public tunnel as a substitute for production authentication, abuse controls, backups, or monitoring.
- For a stable hostname, use a named Cloudflare Tunnel with a domain managed in Cloudflare; that requires domain/DNS setup. Quick Tunnels are temporary.

## Which option should I choose?

| Need | Recommended path |
|---|---|
| Simplest hosted demo, PC can be off | Render Free (accept cold starts and usage limits) |
| Keep model weights private on your own computer | Local Audora + Cloudflare Quick Tunnel |
| Stable public service for many users | A properly secured paid server or managed infrastructure; there is no reliable unlimited free GPU host |

Cloudflare Tunnel documentation: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
