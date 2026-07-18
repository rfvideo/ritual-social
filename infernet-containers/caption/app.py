"""
Caption job container.

Swap `generate_caption()` for a real vision-language model (e.g. Salesforce/
blip-image-captioning-base via HuggingFace transformers) when ready. The
`imageURIs` passed in are IPFS references already pinned by ipfs-upload —
fetch and decode them from your IPFS gateway inside this container.
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# TODO: replace with a real model, e.g.:
# from transformers import BlipProcessor, BlipForConditionalGeneration
# processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
# model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")


class JobInput(BaseModel):
    imageURIs: list[str]


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


def generate_caption(image_uris: list[str]) -> dict:
    # TODO: fetch each URI from your IPFS gateway and run real inference.
    return {
        "caption": "A moment worth sharing on Ritual Social ✨",
        "hashtags": ["#RitualSocial", "#AINative"],
    }


@app.post("/job")
def run_job(job: Job):
    output = generate_caption(job.input.imageURIs)
    return {"model": "ritual-caption-v0", "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True}
