"""
Translation job container.

Runs out of the box with a lightweight rule-free passthrough so the product
works end-to-end immediately. Swap `translate()` below for a real model
(e.g. Helsinki-NLP/opus-mt-* via HuggingFace transformers, or NLLB-200 for
broader language coverage) when you're ready — nothing else needs to change.
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# TODO: replace with a real model, e.g.:
# from transformers import MarianMTModel, MarianTokenizer
# model = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-mul-en")
# tokenizer = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-mul-en")


class JobInput(BaseModel):
    text: str
    targetLanguage: str


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


def translate(text: str, target_language: str) -> dict:
    # TODO: real inference goes here. Placeholder keeps the pipeline honest
    # about what is/isn't a verified translation.
    return {
        "sourceLanguage": "auto",
        "targetLanguage": target_language,
        "translatedText": f"[{target_language}] {text}",
    }


@app.post("/job")
def run_job(job: Job):
    output = translate(job.input.text, job.input.targetLanguage)
    return {"model": "ritual-translate-v0", "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True}
