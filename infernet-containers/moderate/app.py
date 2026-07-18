"""
Moderation job container: spam / scam / phishing / toxic / NSFW detection.

Ships with the same heuristic used in the Netlify fallback so behavior is
consistent whether or not this container is reachable. Swap `moderate()` for
a real classifier (e.g. a fine-tuned DistilBERT for toxicity/spam, plus a
vision model such as a NSFW-detection CNN for `imageURIs`) when ready.
"""
import re
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

SPAM_RE = re.compile(r"\b(free\s*money|guaranteed\s*profit|airdrop\s*claim\s*now|dm\s*me\s*for)\b", re.I)
PHISHING_RE = re.compile(r"\b(seed\s*phrase|connect\s*wallet\s*here|verify\s*your\s*wallet|claim\.\S+)\b", re.I)

# TODO: replace with real classifiers, e.g.:
# from transformers import pipeline
# toxicity_classifier = pipeline("text-classification", model="unitary/toxic-bert")


class JobInput(BaseModel):
    text: str
    imageURIs: list[str] = []


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


def moderate(text: str) -> dict:
    categories = []
    if SPAM_RE.search(text):
        categories.append("spam")
    if PHISHING_RE.search(text):
        categories.extend(["phishing", "scam"])
    return {
        "flagged": len(categories) > 0,
        "categories": categories,
        "reason": "Matched known spam/phishing heuristics." if categories else None,
    }


@app.post("/job")
def run_job(job: Job):
    output = moderate(job.input.text)
    return {"model": "ritual-moderate-v0", "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True}
