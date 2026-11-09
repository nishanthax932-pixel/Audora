# Audora Local Image Engine

This optional service runs an image checkpoint owned/hosted by Audora. It does not call Pollinations, hosted image APIs, or download model weights at runtime.

1. Obtain a Stable Diffusion XL checkpoint with a license suitable for your use and place its complete Diffusers-format files under `models/audora-image`.
2. Install a CUDA-compatible PyTorch build, then `pip install -r image/requirements.txt`.
3. Generate a strong secret (at least 32 characters; for example, `python -c "import secrets; print(secrets.token_urlsafe(48))"`) and set the same value as `AUDORA_IMAGE_API_KEY` in both the Node app and image service environments. Set `AUDORA_IMAGE_MODEL_PATH` to the local checkpoint directory.
4. Start: `uvicorn image.image_server:app --host 127.0.0.1 --port 8001`.
5. In the Node app set `AUDORA_IMAGE_API_URL=http://127.0.0.1:8001/generate` and `AUDORA_IMAGE_API_KEY`.

The model must already exist on disk; startup uses `local_files_only=True`. A CUDA GPU with sufficient VRAM is required. Do not expose this service publicly; keep it on loopback or a private network. Image generation remains unavailable until a valid local checkpoint and key are configured.
