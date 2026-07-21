"""
Thread summarization container — real abstractive summarization via
facebook/bart-large-cnn (BART fine-tuned on CNN/DailyMail news articles).

No external API calls. Model weights (~1.6 GB) download on first startup;
subsequent requests run in ~1–4 s on CPU, <1 s on GPU.
"""
import os
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

MODEL_NAME = os.environ.get("SUMMARIZE_MODEL", "facebook/bart-large-cnn")

_summarizer = None


def get_summarizer():
    """Lazy-load on first request so the container starts instantly."""
    global _summarizer
    if _summarizer is None:
        from transformers import pipeline
        _summarizer = pipeline(
            "summarization",
            model=MODEL_NAME,
            truncation=True,
        )
    return _summarizer


def summarize(thread_text: str) -> dict:
    summarizer = get_summarizer()

    # BART-large-cnn has a 1024 token window; truncate raw chars conservatively
    truncated = thread_text[:3500]

    result = summarizer(
        truncated,
        max_length=150,
        min_length=30,
        do_sample=False,
        no_repeat_ngram_size=3,
    )

    summary: str = result[0]["summary_text"] if result else ""
    if not summary:
        return {
            "summary": "Thread too short or could not be summarized.",
            "keyPoints": [],
        }

    # Split summary into individual sentences for key-points display
    sentences = [s.strip() for s in summary.split(". ") if s.strip()]
    # Re-add periods stripped during split
    key_points = [
        (s if s.endswith((".", "!", "?")) else s + ".") for s in sentences[:5]
    ]

    return {
        "summary": summary,
        "keyPoints": key_points,
    }


# ── FastAPI endpoints ─────────────────────────────────────────────────────────


class JobInput(BaseModel):
    threadText: str


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


@app.post("/job")
def run_job(job: Job):
    output = summarize(job.input.threadText)
    return {"model": MODEL_NAME, "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_NAME, "model_loaded": _summarizer is not None}
