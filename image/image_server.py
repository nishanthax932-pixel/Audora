"""Local-only image inference service for Audora. Loads model weights from disk; never downloads them."""
import base64
import io
import os
import threading
from pathlib import Path

import torch
from diffusers import StableDiffusionXLPipeline
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(os.environ.get("AUDORA_IMAGE_MODEL_PATH", "./models/audora-image")).resolve()
API_KEY = os.environ.get("AUDORA_IMAGE_API_KEY", "")
app = FastAPI(title="Audora Local Image Engine")
pipe = None
generation_lock = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=4, max_length=1000)


@app.on_event("startup")
def load_pipeline():
    global pipe
    if not API_KEY or len(API_KEY) < 32:
        raise RuntimeError("AUDORA_IMAGE_API_KEY must be a strong secret of at least 32 characters")
    if not MODEL_PATH.is_dir():
        raise RuntimeError(f"Local image checkpoint not found: {MODEL_PATH}")
    if not torch.cuda.is_available():
        raise RuntimeError("A CUDA GPU is required for this image service")
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    pipe = StableDiffusionXLPipeline.from_pretrained(
        str(MODEL_PATH),
        torch_dtype=dtype,
        local_files_only=True,
        use_safetensors=True,
    ).to("cuda")
    pipe.enable_attention_slicing()


@app.get("/health")
def health():
    return {"status": "ready" if pipe is not None else "loading", "model": MODEL_PATH.name}


@app.post("/generate")
def generate(body: GenerateRequest, authorization: str = Header(default="")):
    if not API_KEY or authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if pipe is None:
        raise HTTPException(status_code=503, detail="Image model is not loaded")
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Image engine is busy; retry shortly")
    try:
        result = pipe(
            prompt=body.prompt,
            num_inference_steps=28,
            guidance_scale=6.5,
            width=1024,
            height=1024,
        ).images[0]
        buffer = io.BytesIO()
        result.save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return {"image": encoded}
    except torch.cuda.OutOfMemoryError as exc:
        torch.cuda.empty_cache()
        raise HTTPException(
            status_code=503,
            detail="GPU memory is insufficient for image generation",
        ) from exc
    finally:
        generation_lock.release()
