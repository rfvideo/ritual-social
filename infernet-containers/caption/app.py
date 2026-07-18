"""
Caption job container — REAL image captioning via BLIP (Salesforce/blip-image-
captioning-base), an open-source vision-language model. This fetches each
image from your IPFS gateway, runs it through BLIP, and combines the results
into one caption + suggested hashtags. Nothing here calls a third-party AI
API (OpenAI/Gemini/Claude/etc) — the model runs entirely inside this
container, on infrastructure you control.

First request after startup will be slow (~30-60s) while the model downloads
and loads into memory; subsequent requests are fast (~1-3s on CPU, <1s on GPU).
"""
import os
import re
from io import BytesIO

import requests
import torch
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel
from transformers import BlipForConditionalGeneration, BlipProcessor

app = FastAPI()

IPFS_GATEWAY = os.environ.get("IPFS_GATEWAY", "https://w3s.link/ipfs/")
MODEL_NAME = "Salesforce/blip-image-captioning-base"

_device = "cuda" if torch.cuda.is_available() else "cpu"
_processor: BlipProcessor | None = None
_model: BlipForConditionalGeneration | None = None


def get_model():
    """Lazy-load so the container starts instantly; model loads on first request."""
    global _processor, _model
    if _model is None:
        _processor = BlipProcessor.from_pretrained(MODEL_NAME)
        _model = BlipForConditionalGeneration.from_pretrained(MODEL_NAME).to(_device)
    return _processor, _model


def resolve_ipfs(uri: str) -> str:
    if uri.startswith("ipfs://"):
        return f"{IPFS_GATEWAY.rstrip('/')}/{uri.replace('ipfs://', '')}"
    return uri


def fetch_image(uri: str) -> Image.Image:
    url = resolve_ipfs(uri)
    res = requests.get(url, timeout=20)
    res.raise_for_status()
    return Image.open(BytesIO(res.content)).convert("RGB")


def caption_image(image: Image.Image) -> str:
    processor, model = get_model()
    inputs = processor(image, return_tensors="pt").to(_device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=40)
    return processor.decode(out[0], skip_special_tokens=True)


STOPWORDS = {
    "a", "an", "the", "is", "are", "of", "in", "on", "with", "and", "to", "at",
}


def hashtags_from_captions(captions: list[str], limit: int = 4) -> list[str]:
    words: list[str] = []
    for c in captions:
        for w in re.findall(r"[a-zA-Z]{4,}", c.lower()):
            if w not in STOPWORDS and w not in words:
                words.append(w)
    return [f"#{w.capitalize()}" for w in words[:limit]] or ["#RitualSocial"]


class JobInput(BaseModel):
    imageURIs: list[str]


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


def generate_caption(image_uris: list[str]) -> dict:
    if not image_uris:
        return {"caption": "", "hashtags": []}

    per_image_captions = []
    for uri in image_uris:
        try:
            image = fetch_image(uri)
            per_image_captions.append(caption_image(image))
        except Exception as e:
            print(f"[caption] failed to process {uri}: {e}")

    if not per_image_captions:
        return {
            "caption": "Couldn't analyze the image(s) — try again in a moment.",
            "hashtags": ["#RitualSocial"],
        }

    if len(per_image_captions) == 1:
        caption = per_image_captions[0].capitalize()
    else:
        caption = f"{per_image_captions[0].capitalize()} (+{len(per_image_captions) - 1} more)"

    return {
        "caption": caption,
        "hashtags": hashtags_from_captions(per_image_captions),
    }


@app.post("/job")
def run_job(job: Job):
    output = generate_caption(job.input.imageURIs)
    return {"model": MODEL_NAME, "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True, "device": _device, "model_loaded": _model is not None}
