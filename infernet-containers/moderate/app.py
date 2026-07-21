"""
Moderation container — real toxicity detection via unitary/toxic-bert
(DistilBERT fine-tuned on toxic comment datasets) combined with fast
regex heuristics for spam/phishing that don't need a GPU.

No external API calls — everything runs inside this container on
infrastructure you control. Model weights (~250 MB) download on first
startup; subsequent requests run in ~50–200 ms on CPU.
"""
import re
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# ── regex heuristics (fast, no model required) ───────────────────────────────

SPAM_RE = re.compile(
    r"\b(free\s*money|guaranteed\s*profit|airdrop\s*claim\s*now|dm\s*me\s*for"
    r"|earn\s*\$?\d+\s*daily|passive\s*income\s*guaranteed|make\s*money\s*fast)\b",
    re.I,
)
PHISHING_RE = re.compile(
    r"\b(seed\s*phrase|connect\s*wallet\s*here|verify\s*your\s*wallet"
    r"|claim\.\S+|metamask\s*support|wallet\s*recovery\s*phrase"
    r"|private\s*key\s*required)\b",
    re.I,
)

# ── model ─────────────────────────────────────────────────────────────────────

TOXICITY_MODEL = "unitary/toxic-bert"
TOXICITY_THRESHOLD = 0.75   # confidence required to label as toxic

_classifier = None


def get_classifier():
    """Lazy-load so container starts without waiting for model download."""
    global _classifier
    if _classifier is None:
        from transformers import pipeline
        # top_k=None returns scores for every label
        _classifier = pipeline(
            "text-classification",
            model=TOXICITY_MODEL,
            top_k=None,
            truncation=True,
            max_length=512,
        )
    return _classifier


# ── core logic ────────────────────────────────────────────────────────────────


def moderate(text: str) -> dict:
    categories: list[str] = []
    reason_parts: list[str] = []

    # 1. Fast regex checks
    if SPAM_RE.search(text):
        categories.append("spam")
        reason_parts.append("matched spam pattern")
    if PHISHING_RE.search(text):
        if "phishing" not in categories:
            categories.append("phishing")
        if "scam" not in categories:
            categories.append("scam")
        reason_parts.append("matched phishing/scam pattern")

    # 2. Neural toxicity classification
    if text.strip():
        try:
            classifier = get_classifier()
            # results shape: list[list[{"label": str, "score": float}]]
            raw = classifier(text[:512])
            label_scores: dict[str, float] = {}
            for item in (raw[0] if isinstance(raw[0], list) else raw):
                label_scores[item["label"].lower()] = item["score"]

            toxic_score = label_scores.get("toxic", 0.0)
            if toxic_score >= TOXICITY_THRESHOLD:
                if "toxic" not in categories:
                    categories.append("toxic")
                reason_parts.append(
                    f"neural toxicity classifier: {toxic_score:.0%} confidence"
                )

            # unitary/toxic-bert also exposes severe_toxic, obscene, etc.
            for extra_label in ("severe_toxic", "obscene", "threat", "insult", "identity_hate"):
                if label_scores.get(extra_label, 0.0) >= TOXICITY_THRESHOLD:
                    if "toxic" not in categories:
                        categories.append("toxic")
                    reason_parts.append(f"{extra_label}: {label_scores[extra_label]:.0%}")
        except Exception as exc:
            print(f"[moderate] classifier error (falling back to regex only): {exc}")

    return {
        "flagged": len(categories) > 0,
        "categories": categories,
        "reason": "; ".join(reason_parts) if reason_parts else None,
    }


# ── FastAPI endpoints ─────────────────────────────────────────────────────────


class JobInput(BaseModel):
    text: str
    imageURIs: list[str] = []


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


@app.post("/job")
def run_job(job: Job):
    output = moderate(job.input.text)
    return {
        "model": TOXICITY_MODEL,
        "output": output,
        "proof": {"type": "none"},
    }


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": TOXICITY_MODEL, "model_loaded": _classifier is not None}
