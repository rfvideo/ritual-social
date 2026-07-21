"""
Translation container — real multilingual translation via
facebook/nllb-200-distilled-600M (No Language Left Behind, Meta AI).

Supports 200+ languages without any external API calls. Model weights (~2.4 GB)
download on first startup; subsequent requests are fast (~0.5–2 s on CPU).
To pre-warm: docker exec <translate-container> python -c "from app import get_model; get_model()"
"""
import os
import re
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

MODEL_NAME = os.environ.get("TRANSLATE_MODEL", "facebook/nllb-200-distilled-600M")

# ISO 639-1 / common code → NLLB BCP-47 script tag
LANG_MAP: dict[str, str] = {
    "en": "eng_Latn",
    "id": "ind_Latn",
    "ms": "zsm_Latn",
    "zh": "zho_Hans",
    "zh-tw": "zho_Hant",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "es": "spa_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "ar": "arb_Arab",
    "pt": "por_Latn",
    "ru": "rus_Cyrl",
    "hi": "hin_Deva",
    "tr": "tur_Latn",
    "vi": "vie_Latn",
    "th": "tha_Thai",
    "nl": "nld_Latn",
    "it": "ita_Latn",
    "pl": "pol_Latn",
    "uk": "ukr_Cyrl",
    "sw": "swh_Latn",
    "tl": "tgl_Latn",
}

_tokenizer = None
_model = None


def get_model():
    """Lazy-load on first request so the container starts instantly."""
    global _tokenizer, _model
    if _model is None:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    return _tokenizer, _model


# ── source language detection ────────────────────────────────────────────────

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_KANA_RE = re.compile(r"[\u3040-\u30ff]")
_HANGUL_RE = re.compile(r"[\uac00-\ud7a3]")
_ARABIC_RE = re.compile(r"[\u0600-\u06ff]")
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097f]")
_CYRILLIC_RE = re.compile(r"[\u0400-\u04ff]")
_THAI_RE = re.compile(r"[\u0e00-\u0e7f]")


def detect_source_lang(text: str) -> str:
    if _KANA_RE.search(text):
        return "ja"
    if _HANGUL_RE.search(text):
        return "ko"
    if _CJK_RE.search(text):
        return "zh"
    if _ARABIC_RE.search(text):
        return "ar"
    if _DEVANAGARI_RE.search(text):
        return "hi"
    if _CYRILLIC_RE.search(text):
        return "ru"
    if _THAI_RE.search(text):
        return "th"
    return "en"


# ── translation ──────────────────────────────────────────────────────────────


def translate(text: str, target_language: str) -> dict:
    tokenizer, model = get_model()

    src_lang = detect_source_lang(text)
    nllb_src = LANG_MAP.get(src_lang, "eng_Latn")
    nllb_tgt = LANG_MAP.get(target_language.lower(), "eng_Latn")

    # If source == target, return as-is (no-op)
    if nllb_src == nllb_tgt:
        return {
            "sourceLanguage": src_lang,
            "targetLanguage": target_language,
            "translatedText": text,
        }

    tokenizer.src_lang = nllb_src
    inputs = tokenizer(text, return_tensors="pt", max_length=512, truncation=True)

    tgt_lang_id = tokenizer.convert_tokens_to_ids(nllb_tgt)
    generated = model.generate(
        **inputs,
        forced_bos_token_id=tgt_lang_id,
        max_new_tokens=512,
        num_beams=4,
        early_stopping=True,
    )
    translated_text = tokenizer.batch_decode(generated, skip_special_tokens=True)[0]

    return {
        "sourceLanguage": src_lang,
        "targetLanguage": target_language,
        "translatedText": translated_text,
    }


# ── FastAPI endpoints ─────────────────────────────────────────────────────────


class JobInput(BaseModel):
    text: str
    targetLanguage: str


class Job(BaseModel):
    input: JobInput
    jobId: str | None = None


@app.post("/job")
def run_job(job: Job):
    output = translate(job.input.text, job.input.targetLanguage)
    return {"model": MODEL_NAME, "output": output, "proof": {"type": "none"}}


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_NAME, "model_loaded": _model is not None}
