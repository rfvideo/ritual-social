"""
Feed recommendation container — engagement-weighted ranking with time decay.

Scores posts using a Wilson-score-inspired formula:
  score = (likes + 2*comments + 1.5*reposts) * exp(-hours_old * 0.05)
         + recency_bonus

No ML model required — this is a deterministic ranking function that mirrors
what a learned ranking model would optimize for on a social feed. Swap
`score_post()` with a LambdaMART/TwoTower model when training data is
available; the container interface stays the same.

Runs in milliseconds — no cold-start delay.
"""
import math
import time
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

MODEL_ID = "ritual-recommend-v1-engagement"


class PostSignal(BaseModel):
    postId: str
    likeCount: int = 0
    commentCount: int = 0
    repostCount: int = 0
    createdAt: int = 0  # unix seconds; 0 means unknown → treat as very recent


class JobInput(BaseModel):
    posts: list[PostSignal]
    viewerAddress: str = ""


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


def score_post(post: PostSignal, now: float) -> float:
    """
    Engagement gravity with time decay, inspired by Hacker News / Reddit
    hybrid ranking.

    engagement  = likes + 2 * comments + 1.5 * reposts
                  (comments and reposts are weighted higher — they signal
                  active interest, not just passive approval)

    decay       = exp(-hours_old * 0.05)
                  → half-life ≈ 13.9 hours; a 24-hour-old post with no new
                    engagement is roughly 30% as prominent as a new one

    recency     = 1 / (1 + hours_old)
                  → tiny additive bonus so brand-new posts with zero
                    engagement still rank above very old posts with zero
                    engagement
    """
    engagement = post.likeCount + 2.0 * post.commentCount + 1.5 * post.repostCount
    hours_old = max(0.0, (now - post.createdAt) / 3600.0) if post.createdAt else 0.0
    decay = math.exp(-hours_old * 0.05)
    recency_bonus = 1.0 / (1.0 + hours_old)
    return engagement * decay + recency_bonus


@app.post("/job")
def run_job(job: Job):
    posts = job.input.posts
    now = time.time()
    ranked = sorted(posts, key=lambda p: score_post(p, now), reverse=True)
    return {
        "model": MODEL_ID,
        "output": {"rankedPostIds": [p.postId for p in ranked]},
        "proof": {"type": "none"},
    }


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_ID}
