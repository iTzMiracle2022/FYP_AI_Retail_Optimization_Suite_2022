"""
Marketing NLP Feedback Intelligence.

This module is intentionally separate from K-Means segmentation. It analyzes
Customer_Feedback text after segmentation has produced customer segments, then
aggregates sentiment, aspects, themes, and mixed-signal flags by segment.
"""
from __future__ import annotations

import hashlib
import html
import json
import math
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer


NLP_PIPELINE_VERSION = "marketing_nlp_feedback_v4_mixed_signal_theme_polish"
ROBERTA_MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"
XLMR_MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
SBERT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
KEYBERT_MODEL_NAME = "KeyBERT"
GPU_BATCH_SIZE = 32
CPU_BATCH_SIZE = 8

_CACHE_DIR = Path(__file__).parent.parent / "cache" / "marketing_nlp"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
_MEMORY_CACHE: dict[str, dict] = {}


RETAIL_ASPECTS = {
    "Product Quality": [
        "quality", "product", "item", "durable", "broken", "defect", "defective",
        "fresh", "stale", "damaged", "poor quality", "top-notch", "top notch",
    ],
    "Price / Value": [
        "price", "pricing", "value", "expensive", "cheap", "cost", "worth",
        "overpriced", "affordable", "deal", "money",
    ],
    "Delivery / Shipping": [
        "delivery", "shipping", "ship", "late", "delay", "delayed", "arrived",
        "arrival", "order took", "took too long", "days",
    ],
    "Packaging": [
        "packaging", "package", "boxed", "wrap", "wrapped", "parcel",
    ],
    "Customer Support": [
        "support", "service", "staff", "agent", "help", "helpful", "rude",
        "representative", "complaint", "customer service",
    ],
    "Returns / Refunds": [
        "return", "refund", "exchange", "replacement", "money back",
    ],
    "Availability": [
        "available", "availability", "stock", "out of stock", "sold out",
        "unavailable", "backorder",
    ],
    "Discounts / Promotions": [
        "discount", "promotion", "promo", "coupon", "offer", "sale",
    ],
    "Website / Checkout": [
        "website", "checkout", "cart", "app", "online", "payment", "site",
        "login", "web",
    ],
    "Store Experience": [
        "store", "shop", "checkout line", "queue", "cashier", "aisle",
        "experience", "visit",
    ],
}

POSITIVE_TERMS = {
    "good", "great", "excellent", "amazing", "awesome", "perfect", "love",
    "loved", "helpful", "recommended", "top notch", "top-notch", "quality",
    "fast", "smooth", "satisfied", "happy", "best", "nice", "acceptable",
    "okay", "fine",
}

NEGATIVE_TERMS = {
    "bad", "poor", "late", "delay", "delayed", "issue", "problem", "broken",
    "damaged", "refund", "return", "rude", "slow", "worst", "complaint",
    "expensive", "overpriced", "not", "never", "no", "failed", "can't",
    "cant", "cannot", "didn't", "didnt", "won't", "wont", "doesn't",
    "doesnt", "isn't", "isnt", "wasn't", "wasnt", "frustrating",
    "frustrated", "too long", "long",
}

THEME_PATTERNS = [
    ("delivery delay", {"delivery", "shipping", "late", "delay", "delayed", "arrived", "days"}),
    ("customer support", {"support", "service", "staff", "agent", "help", "rude"}),
    ("refund issue", {"refund", "return", "exchange", "replacement"}),
    ("product quality", {"quality", "product", "broken", "damaged", "defect", "top notch"}),
    ("price value", {"price", "value", "expensive", "affordable", "worth", "cost"}),
    ("checkout experience", {"website", "checkout", "cart", "payment", "app", "site"}),
    ("stock availability", {"stock", "available", "sold out", "unavailable", "availability"}),
    ("discount offers", {"discount", "promotion", "coupon", "offer", "sale"}),
    ("store experience", {"store", "shop", "cashier", "queue", "visit"}),
]

THEME_DISPLAY_PATTERNS = [
    ("Product Quality Praise", [
        "top-notch", "top notch", "excellent quality", "high quality",
        "quality", "recommended", "highly recommended",
    ]),
    ("Repeat Purchase Intent", [
        "buying again", "buy again", "might buy", "5 stars", "five stars",
        "recommended", "recommend",
    ]),
    ("Product Selection", [
        "wines", "meats", "selection", "product selection",
    ]),
    ("Fast Delivery", [
        "fast delivery", "quick delivery", "arrived quickly", "on time",
    ]),
    ("Delivery Delay", [
        "delivery took", "took long", "took a bit long", "late delivery",
        "shipping delay", "delayed", "delay",
    ]),
    ("Customer Support", [
        "customer service", "support", "staff", "agent", "smooth experience",
    ]),
    ("Store Experience Complaint", [
        "frustrating", "frustrated", "disappointed", "worst", "glitch",
        "glitches", "slow", "too slow", "complained", "complaint",
        "no one reached out", "store experience complaint",
    ]),
    ("Website / Checkout Issues", [
        "checkout", "website", "site", "glitches", "website slow", "too slow",
        "cart", "payment",
    ]),
    ("Discount Sensitivity", [
        "discount", "deals", "coupon", "offer", "promotion", "promo",
    ]),
    ("Neutral Experience", [
        "average", "fine", "okay", "standard", "nothing special",
        "acceptable", "basic expectations",
    ]),
    ("Support Complaint", [
        "complained", "complaint", "no one reached out", "worst customer service",
    ]),
]


def _contains_term(text: str, term: str) -> bool:
    normalized_text = text.lower()
    normalized_term = term.lower().strip()
    if not normalized_term:
        return False
    if re.fullmatch(r"[a-z0-9']+", normalized_term):
        return re.search(rf"(?<![a-z0-9']){re.escape(normalized_term)}(?![a-z0-9'])", normalized_text) is not None
    return normalized_term in normalized_text


def _contains_any_term(text: str, terms: set[str] | list[str]) -> bool:
    return any(_contains_term(text, term) for term in terms)


def _canonical_theme_label(theme: str, feedback_text: str = "") -> str:
    source = f"{theme} {feedback_text}".lower()
    for label, patterns in THEME_DISPLAY_PATTERNS:
        if any(_contains_term(source, pattern) for pattern in patterns):
            return label

    normalized = str(theme or "").strip().lower()
    direct_map = {
        "product quality": "Product Quality Praise",
        "product quality praise": "Product Quality Praise",
        "delivery delay": "Delivery Delay",
        "customer support": "Customer Support",
        "store experience complaint": "Store Experience Complaint",
        "checkout experience": "Website / Checkout Issues",
        "discount offers": "Discount Sensitivity",
        "price value": "Discount Sensitivity",
        "store experience": "Neutral Experience",
        "experience products": "Neutral Experience",
        "average experience": "Neutral Experience",
        "products fine": "Neutral Experience",
        "okay special": "Neutral Experience",
        "wines meats": "Product Selection",
        "selection wines": "Product Selection",
        "buying stars": "Repeat Purchase Intent",
    }
    if normalized in direct_map:
        return direct_map[normalized]

    return str(theme or "").strip().title() or "General Feedback"


def _canonicalize_themes(themes: list[str], feedback_text: str) -> list[str]:
    seen = set()
    canonical = []
    for theme in themes:
        label = _canonical_theme_label(theme, feedback_text)
        if label not in seen:
            seen.add(label)
            canonical.append(label)
    return canonical[:5]


class _NLPRuntime:
    """Lazy singleton for optional NLP dependencies."""

    def __init__(self) -> None:
        self._initialized = False
        self.device_label = "CPU fallback"
        self.device = "cpu"
        self.device_index = -1
        self.batch_size = CPU_BATCH_SIZE
        self.sentiment_model = "VADER fallback"
        self.theme_model = "TF-IDF fallback"
        self.language_detector = "lightweight detector"
        self.fallback_used = True
        self.vader = None
        self.torch_available = False
        self.transformers_available = False
        self.sentence_transformers_available = False
        self.keybert_available = False
        self.fasttext_available = False
        self.langdetect_available = False
        self.roberta_pipeline = None
        self.xlmr_pipeline = None
        self.sbert_model = None
        self.keybert_model = None

    def ensure_loaded(self) -> "_NLPRuntime":
        if self._initialized:
            return self

        try:
            import torch  # type: ignore
            self.torch_available = True
            if torch.cuda.is_available():
                self.device = "cuda"
                self.device_index = 0
                self.device_label = "GPU - cuda"
                self.batch_size = GPU_BATCH_SIZE
            else:
                self.device = "cpu"
                self.device_index = -1
                self.device_label = "CPU fallback"
                self.batch_size = CPU_BATCH_SIZE
        except Exception:
            self.torch_available = False
            self.device_label = "CPU fallback"
            self.device = "cpu"
            self.device_index = -1
            self.batch_size = CPU_BATCH_SIZE

        try:
            import nltk
            from nltk.sentiment import SentimentIntensityAnalyzer
            try:
                nltk.data.find("sentiment/vader_lexicon.zip")
            except LookupError:
                nltk.download("vader_lexicon", quiet=True)
            self.vader = SentimentIntensityAnalyzer()
        except Exception as exc:
            print(f"[marketing_nlp] VADER unavailable, using lexical fallback: {exc}")
            self.vader = None

        try:
            import fasttext  # noqa: F401
            self.fasttext_available = True
            self.language_detector = "fastText available"
        except Exception:
            self.fasttext_available = False

        try:
            import langdetect  # noqa: F401
            self.langdetect_available = True
            if not self.fasttext_available:
                self.language_detector = "langdetect available"
        except Exception:
            self.langdetect_available = False

        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
            self.transformers_available = True
            if not self.torch_available:
                raise RuntimeError("torch is required for transformer sentiment models")

            def load_sentiment_pipeline(model_name: str):
                tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True, use_fast=False)
                model = AutoModelForSequenceClassification.from_pretrained(
                    model_name,
                    local_files_only=True,
                    use_safetensors=True
                )
                return pipeline(
                    "sentiment-analysis",
                    model=model,
                    tokenizer=tokenizer,
                    device=self.device_index,
                    truncation=True,
                )

            try:
                self.roberta_pipeline = load_sentiment_pipeline(ROBERTA_MODEL_NAME)
            except Exception as exc:
                print(f"[marketing_nlp] RoBERTa not available locally: {exc}")
                self.roberta_pipeline = None

            try:
                self.xlmr_pipeline = load_sentiment_pipeline(XLMR_MODEL_NAME)
            except Exception as exc:
                print(f"[marketing_nlp] XLM-R not available locally: {exc}")
                self.xlmr_pipeline = None

            active_sentiment = []
            if self.roberta_pipeline is not None:
                active_sentiment.append("RoBERTa")
            if self.xlmr_pipeline is not None:
                active_sentiment.append("XLM-R")
            self.sentiment_model = " + ".join(active_sentiment) if active_sentiment else "VADER fallback"
        except Exception as exc:
            self.transformers_available = False
            print(f"[marketing_nlp] Transformer NLP unavailable, using VADER + TF-IDF fallback: {exc}")
            self.sentiment_model = "VADER fallback"

        try:
            from keybert import KeyBERT
            from sentence_transformers import SentenceTransformer
            self.sentence_transformers_available = True
            self.keybert_available = True
            self.sbert_model = SentenceTransformer(
                SBERT_MODEL_NAME,
                device=self.device,
                local_files_only=True,
            )
            self.keybert_model = KeyBERT(model=self.sbert_model)
            self.theme_model = "SBERT + KeyBERT"
        except Exception as exc:
            if "sentence_transformers" in str(type(exc)) or "SentenceTransformer" in str(exc):
                self.sentence_transformers_available = False
            if "keybert" in str(type(exc)) or "KeyBERT" in str(exc):
                self.keybert_available = False
            print(f"[marketing_nlp] SBERT/KeyBERT unavailable locally, using TF-IDF fallback: {exc}")
            self.theme_model = "TF-IDF fallback"

        self.fallback_used = (
            self.roberta_pipeline is None
            or self.xlmr_pipeline is None
            or self.keybert_model is None
        )
        diagnostics = self.diagnostics()
        print(f"[marketing_nlp] diagnostics: {diagnostics}")
        if self.fallback_used:
            print("Transformer NLP unavailable, using VADER + TF-IDF fallback")

        self._initialized = True
        return self

    def diagnostics(self) -> dict:
        return {
            "torch_available": self.torch_available,
            "transformers_available": self.transformers_available,
            "sentence_transformers_available": self.sentence_transformers_available,
            "keybert_available": self.keybert_available,
            "fasttext_available": self.fasttext_available,
            "langdetect_available": self.langdetect_available,
            "device": self.device,
            "fallback_used": self.fallback_used,
            "batch_size": self.batch_size,
            "roberta_loaded": self.roberta_pipeline is not None,
            "xlm_r_loaded": self.xlmr_pipeline is not None,
            "sbert_keybert_loaded": self.keybert_model is not None,
        }

    def _pipeline_scores(self, pipe, texts: list[str]) -> list[dict | None]:
        if pipe is None or not texts:
            return [None for _ in texts]
        try:
            outputs = pipe(texts, batch_size=self.batch_size, truncation=True)
        except Exception as exc:
            print(f"[marketing_nlp] transformer batch inference failed, falling back to VADER: {exc}")
            return [None for _ in texts]
        return [_normalize_transformer_output(item) for item in outputs]

    def score_sentiments(self, texts: list[str], languages: list[str]) -> list[dict]:
        results: list[dict | None] = [None for _ in texts]
        english_indices = [idx for idx, language in enumerate(languages) if language == "English"]
        multilingual_indices = [
            idx for idx, language in enumerate(languages)
            if language in {"Mixed", "Multilingual"}
        ]

        if self.roberta_pipeline is not None and english_indices:
            scored = self._pipeline_scores(self.roberta_pipeline, [texts[idx] for idx in english_indices])
            for idx, score in zip(english_indices, scored):
                results[idx] = score

        if self.xlmr_pipeline is not None and multilingual_indices:
            scored = self._pipeline_scores(self.xlmr_pipeline, [texts[idx] for idx in multilingual_indices])
            for idx, score in zip(multilingual_indices, scored):
                results[idx] = score

        final = []
        for idx, maybe_score in enumerate(results):
            if maybe_score is not None:
                final.append(maybe_score)
            else:
                vader = _vader_scores(texts[idx], self)
                final.append({
                    "compound": vader["compound"],
                    "label": _sentiment_label(vader, []),
                    "confidence": abs(vader["compound"]),
                    "model": "VADER fallback",
                })
        return final

    def extract_keyphrases(self, text: str, limit: int = 3) -> list[str]:
        if self.keybert_model is None or not text:
            return []
        try:
            keywords = self.keybert_model.extract_keywords(
                text,
                keyphrase_ngram_range=(1, 2),
                stop_words="english",
                top_n=limit,
            )
            return [str(keyword) for keyword, _score in keywords]
        except Exception as exc:
            print(f"[marketing_nlp] KeyBERT extraction failed, using fallback themes: {exc}")
            return []


_RUNTIME = _NLPRuntime()


def _normalize_transformer_output(output: Any) -> dict | None:
    if isinstance(output, list) and output and isinstance(output[0], dict):
        # Some pipelines may return all scores; choose the highest confidence.
        output = max(output, key=lambda item: item.get("score", 0))
    if not isinstance(output, dict):
        return None

    raw_label = str(output.get("label", "")).strip().lower()
    label_map = {
        "label_0": "Negative",
        "label_1": "Neutral",
        "label_2": "Positive",
        "negative": "Negative",
        "neutral": "Neutral",
        "positive": "Positive",
        "neg": "Negative",
        "neu": "Neutral",
        "pos": "Positive",
        "1 star": "Negative",
        "2 stars": "Negative",
        "3 stars": "Neutral",
        "4 stars": "Positive",
        "5 stars": "Positive",
    }
    label = label_map.get(raw_label, raw_label.title() if raw_label else "Neutral")
    confidence = _safe_float(output.get("score"), digits=4) or 0.0
    if label == "Positive":
        compound = confidence
    elif label == "Negative":
        compound = -confidence
    else:
        compound = 0.0
    return {
        "compound": compound,
        "label": label,
        "confidence": confidence,
        "model": "Transformer",
    }


def _safe_float(value: Any, digits: int = 4) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, digits)


def _json_scalar(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        number = float(value)
        return None if not math.isfinite(number) else number
    return value


def _clean_text(value: Any) -> str:
    text = "" if value is None or pd.isna(value) else str(value)
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"([!?.,])\1{2,}", r"\1\1", text)
    text = re.sub(r"[^A-Za-z0-9\s.,!?;:'\"()/-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _detect_language(text: str) -> str:
    if not text:
        return "Unknown"
    ascii_letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    letters = sum(1 for ch in text if ch.isalpha())
    if letters < 8:
        return "Unknown"
    if ascii_letters / max(letters, 1) >= 0.9:
        return "English"
    if ascii_letters:
        return "Mixed"
    return "Multilingual"


def _vader_scores(text: str, runtime: _NLPRuntime) -> dict:
    if runtime.vader is not None:
        scores = runtime.vader.polarity_scores(text)
        return {
            "compound": float(scores.get("compound", 0.0)),
            "pos": float(scores.get("pos", 0.0)),
            "neu": float(scores.get("neu", 0.0)),
            "neg": float(scores.get("neg", 0.0)),
        }

    lowered = text.lower()
    positive = sum(1 for term in POSITIVE_TERMS if _contains_term(lowered, term))
    negative = sum(1 for term in NEGATIVE_TERMS if _contains_term(lowered, term))
    total = positive + negative
    compound = 0.0 if not total else (positive - negative) / total
    return {"compound": compound, "pos": positive / max(total, 1), "neu": 0.0, "neg": negative / max(total, 1)}


def _sentiment_label(scores: dict, aspect_labels: list[str]) -> str:
    compound = scores["compound"]
    if "Positive" in aspect_labels and "Negative" in aspect_labels:
        return "Mixed"
    if compound >= 0.25:
        return "Positive"
    if compound <= -0.25:
        return "Negative"
    return "Neutral"


def _sentiment_score(compound: float) -> float:
    return round((compound + 1.0) * 50.0, 1)


def _aspect_sentiment(text: str, runtime: _NLPRuntime) -> tuple[dict[str, str], str | None, str | None]:
    lowered = text.lower()
    aspect_map: dict[str, str] = {}
    for aspect, keywords in RETAIL_ASPECTS.items():
        if not _contains_any_term(lowered, keywords):
            continue

        polarity = _vader_scores(text, runtime)["compound"]
        aspect_has_negative = _contains_any_term(lowered, NEGATIVE_TERMS)
        aspect_has_positive = _contains_any_term(lowered, POSITIVE_TERMS)
        if aspect_has_negative and _contains_any_term(lowered, RETAIL_ASPECTS[aspect]):
            label = "Negative" if polarity < 0.2 else "Mixed"
        elif aspect_has_positive:
            label = "Positive" if polarity > -0.2 else "Mixed"
        else:
            label = "Neutral"
        aspect_map[aspect] = label

    positive = [aspect for aspect, label in aspect_map.items() if label == "Positive"]
    negative = [aspect for aspect, label in aspect_map.items() if label == "Negative"]
    mixed = [aspect for aspect, label in aspect_map.items() if label == "Mixed"]
    top_positive = positive[0] if positive else None
    top_negative = negative[0] if negative else mixed[0] if mixed else None
    return aspect_map, top_positive, top_negative


def _sarcasm_signal(text: str, sentiment_label: str, top_negative_aspect: str | None) -> tuple[bool, str | None]:
    # Validation examples:
    # "Highly recommended, top-notch quality!" -> Positive, not mixed/sarcasm.
    # "Delivery took a bit long but the items were acceptable." -> mixed signal may apply.
    # "Products were okay but the experience was frustrating." -> mixed signal may apply.
    # "Worst customer service, the website is too slow." -> Negative, not substring-driven.
    lowered = text.lower()
    positive_hit = _contains_any_term(lowered, POSITIVE_TERMS)
    negative_hit = _contains_any_term(lowered, NEGATIVE_TERMS)
    mixed_phrase = any(_contains_term(lowered, phrase) for phrase in [
        "great, another", "great another", "just great", "love waiting",
        "thanks for nothing", "exactly what i needed",
    ])
    if mixed_phrase or (positive_hit and negative_hit and top_negative_aspect):
        reason = "positive wording appears with a negative issue"
        if top_negative_aspect:
            reason = f"positive wording appears with {top_negative_aspect.lower()} issue"
        return True, reason
    if sentiment_label == "Mixed" and top_negative_aspect:
        return True, f"mixed sentiment around {top_negative_aspect.lower()}"
    return False, None


def _themes_for_text(text: str, aspects: dict[str, str]) -> list[str]:
    lowered = text.lower()
    themes = []
    for theme, keywords in THEME_PATTERNS:
        if _contains_any_term(lowered, keywords):
            themes.append(theme)
    for aspect in aspects:
        aspect_theme = aspect.lower().replace(" / ", " ")
        if aspect_theme not in themes:
            themes.append(aspect_theme)
    return themes[:5]


def _feedback_column(df: pd.DataFrame) -> str | None:
    preferred = ["Customer_Feedback", "customer_feedback", "Feedback", "feedback", "Review", "review"]
    for col in preferred:
        if col in df.columns:
            return col
    hinted = [col for col in df.columns if any(token in col.lower() for token in ["feedback", "review", "comment"])]
    return hinted[0] if hinted else None


def _customer_id_series(df: pd.DataFrame) -> pd.Series:
    if "ID" in df.columns:
        return df["ID"]
    if "customer_id" in df.columns:
        return df["customer_id"]
    return pd.Series(np.arange(len(df)))


def _feedback_fingerprint(dataset_id: str, customer_ids: pd.Series, feedback: pd.Series) -> str:
    hasher = hashlib.sha256()
    hasher.update(str(dataset_id).encode("utf-8"))
    for cid, text in zip(customer_ids.tolist(), feedback.fillna("").astype(str).tolist()):
        hasher.update(str(cid).encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(text.encode("utf-8", errors="ignore"))
        hasher.update(b"\n")
    return hasher.hexdigest()[:20]


def _cache_key(dataset_id: str, feedback_hash: str) -> str:
    model_part = "|".join([
        NLP_PIPELINE_VERSION,
        ROBERTA_MODEL_NAME,
        XLMR_MODEL_NAME,
        SBERT_MODEL_NAME,
        KEYBERT_MODEL_NAME,
        "vader",
        "tfidf-fallback",
    ])
    digest = hashlib.sha256(f"{dataset_id}:{feedback_hash}:{model_part}".encode("utf-8")).hexdigest()[:16]
    return f"{Path(str(dataset_id)).stem}_{feedback_hash}_{digest}"


def _cache_path(key: str) -> Path:
    return _CACHE_DIR / f"{key}.json"


def _cache_get(key: str) -> dict | None:
    if key in _MEMORY_CACHE:
        return _MEMORY_CACHE[key]
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        _MEMORY_CACHE[key] = payload
        return payload
    except Exception as exc:
        print(f"[marketing_nlp] Cache read error ({path.name}): {exc}")
        return None


def _cache_put(key: str, payload: dict) -> None:
    _MEMORY_CACHE[key] = payload
    path = _cache_path(key)
    try:
        tmp = path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(payload, f, allow_nan=False)
        tmp.replace(path)
    except Exception as exc:
        print(f"[marketing_nlp] Cache write error: {exc}")


def _extract_tfidf_keywords(texts: list[str], limit: int = 10) -> list[str]:
    valid = [text for text in texts if text]
    if not valid:
        return []
    try:
        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_features=80,
            min_df=1,
        )
        matrix = vectorizer.fit_transform(valid)
        scores = np.asarray(matrix.sum(axis=0)).ravel()
        names = vectorizer.get_feature_names_out()
        ranked = sorted(zip(names, scores), key=lambda item: item[1], reverse=True)
        return [name for name, _ in ranked[:limit]]
    except Exception:
        return []


def _process_records(source_df: pd.DataFrame, dataset_id: str) -> tuple[list[dict], dict]:
    runtime = _RUNTIME.ensure_loaded()
    feedback_col = _feedback_column(source_df)
    if feedback_col is None:
        return [], {
            "device": runtime.device_label,
            "language_mode": "Unknown",
            "sentiment_model": runtime.sentiment_model,
            "theme_model": runtime.theme_model,
            "fallback_used": True,
            "feedback_column": None,
        }

    ids = _customer_id_series(source_df)
    prepared_rows = []
    language_counts = Counter()
    for cid, raw_text in zip(ids.tolist(), source_df[feedback_col].tolist()):
        clean_text = _clean_text(raw_text)
        if not clean_text:
            continue
        language = _detect_language(clean_text)
        language_counts[language] += 1
        prepared_rows.append((cid, raw_text, clean_text, language))

    sentiment_results = runtime.score_sentiments(
        [row[2] for row in prepared_rows],
        [row[3] for row in prepared_rows],
    )

    records = []
    cleaned_texts = []
    transformer_sentiment_used = False
    keybert_used = False

    def process_single_row(args):
        (cid, raw_text, clean_text, language), sentiment_result = args
        scores = {"compound": float(sentiment_result.get("compound", 0.0))}
        t_used = sentiment_result.get("model") == "Transformer"
        aspects, top_positive, top_negative = _aspect_sentiment(clean_text, runtime)
        aspect_labels = list(aspects.values())
        label = str(sentiment_result.get("label") or _sentiment_label(scores, aspect_labels))
        if "Positive" in aspect_labels and "Negative" in aspect_labels:
            label = "Mixed"
        sarcasm_flag, sarcasm_reason = _sarcasm_signal(clean_text, label, top_negative)
        k_themes = runtime.extract_keyphrases(clean_text)
        k_used = bool(k_themes)
        themes = _canonicalize_themes(k_themes or _themes_for_text(clean_text, aspects), clean_text)
        
        record = {
            "customer_id": _json_scalar(cid),
            "raw_feedback_text": "" if raw_text is None or pd.isna(raw_text) else str(raw_text),
            "clean_feedback_text": clean_text,
            "feedback_snippet": clean_text[:120] + ("..." if len(clean_text) > 120 else ""),
            "language": language,
            "nlp_sentiment_label": label,
            "nlp_sentiment_score": _sentiment_score(scores["compound"]),
            "compound_score": round(scores["compound"], 4),
            "sentiment_confidence": _safe_float(sentiment_result.get("confidence"), digits=4) or round(abs(scores["compound"]), 4),
            "aspects": aspects,
            "main_issue": top_negative,
            "main_aspect": top_negative or top_positive,
            "top_positive_aspect": top_positive,
            "top_negative_aspect": top_negative,
            "sarcasm_flag": "Possible" if sarcasm_flag else "None",
            "sarcasm_reason": sarcasm_reason,
            "top_themes": themes,
            "top_keywords": themes,
        }
        return record, clean_text, t_used, k_used

    # Optimization: Use ThreadPoolExecutor for multiprocessing technique on data loading/parsing
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(process_single_row, item)
            for item in zip(prepared_rows, sentiment_results)
        ]
        for future in as_completed(futures):
            record, clean_text, t_used, k_used = future.result()
            records.append(record)
            cleaned_texts.append(clean_text)
            transformer_sentiment_used = transformer_sentiment_used or t_used
            keybert_used = keybert_used or k_used

    language_mode = language_counts.most_common(1)[0][0] if language_counts else "Unknown"
    if len(language_counts) > 1 and language_mode != "Unknown":
        language_mode = "Mixed"

    keywords = _extract_tfidf_keywords(cleaned_texts)
    sentiment_model = runtime.sentiment_model if transformer_sentiment_used else "VADER fallback"
    theme_model = "SBERT + KeyBERT" if keybert_used else "TF-IDF fallback"
    meta = {
        "device": runtime.device_label,
        "language_mode": language_mode,
        "sentiment_model": sentiment_model,
        "theme_model": theme_model,
        "fallback_used": not (transformer_sentiment_used and keybert_used),
        "feedback_column": feedback_col,
        "global_keywords": keywords,
        "diagnostics": runtime.diagnostics(),
    }
    return records, meta


def _percentage(count: int, total: int) -> float:
    return round((count / total * 100), 1) if total else 0.0


def _segment_action(sentiment_label: str, top_issue: str | None) -> str:
    if top_issue == "Delivery / Shipping":
        return "Improve delivery experience before promotions."
    if top_issue == "Customer Support":
        return "Resolve support issues before campaign outreach."
    if top_issue == "Returns / Refunds":
        return "Reduce refund friction before reactivation."
    if sentiment_label in {"Low", "Negative"}:
        return "Improve experience before promotional offers."
    if sentiment_label == "Positive":
        return "Prioritize loyalty and referral offers."
    return "Use tailored outreach based on feedback themes."


def _sentiment_bucket(score: float | None) -> str:
    if score is None:
        return "Unknown"
    if score >= 62:
        return "Positive"
    if score <= 45:
        return "Low"
    return "Neutral"


def _build_insights(enriched: pd.DataFrame, meta: dict, processing_ms: float, cache_status: str) -> dict:
    if "clean_feedback_text" not in enriched.columns:
        analyzed = enriched.iloc[0:0].copy()
    else:
        feedback_mask = enriched["clean_feedback_text"].fillna("").astype(str).str.len() > 0
        analyzed = enriched.loc[feedback_mask].copy()
    total = len(analyzed)
    if total == 0:
        return {
            "status": "empty",
            "message": "NLP Feedback Intelligence: No feedback text available.",
            "feedback_records_analyzed": 0,
            "overall_sentiment_score": None,
            "sentiment_distribution": {
                "positive": {"count": 0, "percentage": 0},
                "neutral": {"count": 0, "percentage": 0},
                "negative": {"count": 0, "percentage": 0},
            },
            "possible_sarcasm_count": 0,
            "top_positive_aspect": None,
            "top_complaint_aspect": None,
            "most_discussed_aspect": None,
            "top_themes": [],
            "top_themes_by_segment": [],
            "aspect_sentiment_by_segment": [],
            "cache_status": cache_status,
            "device": meta.get("device", "CPU fallback"),
            "language_mode": meta.get("language_mode", "Unknown"),
            "sentiment_model": meta.get("sentiment_model", "VADER fallback"),
            "theme_model": meta.get("theme_model", "TF-IDF fallback"),
            "processing_time_ms": round(processing_ms, 1),
            "fallback_used": True,
            "diagnostics": meta.get("diagnostics", {}),
        }

    labels = analyzed["nlp_sentiment_label"].fillna("Neutral").astype(str).str.lower()
    positive_count = int((labels == "positive").sum())
    neutral_count = int(((labels == "neutral") | (labels == "mixed")).sum())
    negative_count = int((labels == "negative").sum())
    avg_score = _safe_float(analyzed["nlp_sentiment_score"].mean(), digits=1)
    sarcasm_count = int((analyzed["sarcasm_flag"] == "Possible").sum()) if "sarcasm_flag" in analyzed.columns else 0

    positive_aspects = Counter(v for v in analyzed["top_positive_aspect"].dropna().tolist() if v)
    negative_aspects = Counter(v for v in analyzed["top_negative_aspect"].dropna().tolist() if v)
    discussed_aspects: Counter[str] = Counter()
    for aspects in analyzed["aspects"].dropna().tolist():
        if isinstance(aspects, dict):
            discussed_aspects.update(aspects.keys())
    theme_counter: Counter[str] = Counter()
    for themes in analyzed["top_themes"].dropna().tolist():
        if isinstance(themes, list):
            theme_counter.update(themes)

    segment_rows = []
    aspect_rows = []
    segment_field = "segment_display_name" if "segment_display_name" in analyzed.columns else "segment_name"
    for segment, group in analyzed.groupby(segment_field, dropna=False):
        group_theme_counter: Counter[str] = Counter()
        group_positive_aspects: Counter[str] = Counter()
        group_negative_aspects: Counter[str] = Counter()
        aspect_sentiment_counter: dict[str, Counter] = defaultdict(Counter)

        for _, row in group.iterrows():
            themes = row.get("top_themes")
            if isinstance(themes, list):
                group_theme_counter.update(themes)
            if row.get("top_positive_aspect"):
                group_positive_aspects[row.get("top_positive_aspect")] += 1
            if row.get("top_negative_aspect"):
                group_negative_aspects[row.get("top_negative_aspect")] += 1
            aspects = row.get("aspects")
            if isinstance(aspects, dict):
                for aspect, label in aspects.items():
                    aspect_sentiment_counter[aspect][label] += 1

        segment_avg = _safe_float(group["nlp_sentiment_score"].mean(), digits=1)
        sentiment_label = _sentiment_bucket(segment_avg)
        top_issue = group_negative_aspects.most_common(1)[0][0] if group_negative_aspects else None
        top_positive = group_positive_aspects.most_common(1)[0][0] if group_positive_aspects else None
        segment_sarcasm = int((group["sarcasm_flag"] == "Possible").sum())
        top_keywords = [theme for theme, _ in group_theme_counter.most_common(5)]

        segment_rows.append({
            "segment_display_name": str(segment),
            "top_keywords": top_keywords,
            "top_themes": top_keywords,
            "avg_sentiment": segment_avg,
            "sentiment_label": sentiment_label,
            "top_negative_aspect": top_issue,
            "top_positive_aspect": top_positive,
            "possible_sarcasm_count": segment_sarcasm,
            "suggested_action": _segment_action(sentiment_label, top_issue),
        })

        aspect_row = {"segment_display_name": str(segment)}
        for aspect in [
            "Delivery / Shipping", "Customer Support", "Price / Value",
            "Product Quality", "Returns / Refunds", "Website / Checkout",
        ]:
            counts = aspect_sentiment_counter.get(aspect, Counter())
            if counts:
                label = counts.most_common(1)[0][0]
                aspect_row[aspect] = label
        aspect_rows.append(aspect_row)

    top_themes = [theme for theme, _ in theme_counter.most_common(6)]
    if not top_themes:
        top_themes = meta.get("global_keywords", [])[:6]

    return {
        "status": "ready",
        "feedback_records_analyzed": total,
        "overall_sentiment_score": avg_score,
        "sentiment_distribution": {
            "positive": {"count": positive_count, "percentage": _percentage(positive_count, total)},
            "neutral": {"count": neutral_count, "percentage": _percentage(neutral_count, total)},
            "negative": {"count": negative_count, "percentage": _percentage(negative_count, total)},
        },
        "possible_sarcasm_count": sarcasm_count,
        "top_positive_aspect": positive_aspects.most_common(1)[0][0] if positive_aspects else None,
        "top_complaint_aspect": negative_aspects.most_common(1)[0][0] if negative_aspects else None,
        "most_discussed_aspect": discussed_aspects.most_common(1)[0][0] if discussed_aspects else None,
        "top_themes": top_themes,
        "top_themes_by_segment": segment_rows,
        "aspect_sentiment_by_segment": aspect_rows,
        "cache_status": cache_status,
        "device": meta.get("device", "CPU fallback"),
        "language_mode": meta.get("language_mode", "Unknown"),
        "sentiment_model": meta.get("sentiment_model", "VADER fallback"),
        "theme_model": meta.get("theme_model", "TF-IDF fallback"),
        "processing_time_ms": round(processing_ms, 1),
        "fallback_used": bool(meta.get("fallback_used", True)),
        "feedback_column": meta.get("feedback_column"),
        "diagnostics": meta.get("diagnostics", {}),
    }


def analyze_feedback_intelligence(
    source_df: pd.DataFrame,
    clusters: pd.DataFrame,
    *,
    dataset_id: str,
    force_refresh: bool = False,
) -> tuple[pd.DataFrame, dict]:
    """Return clusters enriched with lightweight NLP fields plus aggregate insights."""
    started = time.perf_counter()
    feedback_col = _feedback_column(source_df)
    if feedback_col is None:
        meta = _RUNTIME.ensure_loaded()
        enriched = clusters.copy()
        insights = _build_insights(enriched, {
            "device": meta.device_label,
            "language_mode": "Unknown",
            "sentiment_model": meta.sentiment_model,
            "theme_model": meta.theme_model,
            "fallback_used": True,
            "feedback_column": None,
            "diagnostics": meta.diagnostics(),
        }, (time.perf_counter() - started) * 1000, "MISS")
        return enriched, insights

    customer_ids = _customer_id_series(source_df)
    feedback = source_df[feedback_col]
    fingerprint = _feedback_fingerprint(dataset_id, customer_ids, feedback)
    key = _cache_key(dataset_id, fingerprint)
    cache_status = "MISS"
    records: list[dict]
    meta: dict

    if not force_refresh:
        cached = _cache_get(key)
        if cached:
            cache_status = "HIT"
            records = cached.get("records", [])
            meta = cached.get("meta", {})
        else:
            records, meta = _process_records(source_df, dataset_id)
            _cache_put(key, {"records": records, "meta": meta, "pipeline_version": NLP_PIPELINE_VERSION})
    else:
        cache_status = "FORCE_REFRESH"
        records, meta = _process_records(source_df, dataset_id)
        _cache_put(key, {"records": records, "meta": meta, "pipeline_version": NLP_PIPELINE_VERSION})

    records_df = pd.DataFrame(records)
    enriched = clusters.copy()
    if not records_df.empty and "customer_id" in enriched.columns:
        lightweight_cols = [
            "customer_id", "feedback_snippet", "clean_feedback_text", "language",
            "nlp_sentiment_label", "nlp_sentiment_score", "compound_score",
            "sentiment_confidence", "aspects", "main_issue", "main_aspect",
            "top_positive_aspect", "top_negative_aspect", "sarcasm_flag",
            "sarcasm_reason", "top_themes", "top_keywords",
        ]
        available = [col for col in lightweight_cols if col in records_df.columns]
        replace_cols = [col for col in available if col != "customer_id" and col in enriched.columns]
        if replace_cols:
            enriched = enriched.drop(columns=replace_cols)
        enriched = enriched.merge(records_df[available], on="customer_id", how="left")

    processing_ms = (time.perf_counter() - started) * 1000
    insights = _build_insights(enriched, meta, processing_ms, cache_status)
    return enriched, insights


def print_nlp_console_summary(nlp_insights: dict | None, *, dataset_id: str, cache_status: str | None = None) -> None:
    if not nlp_insights:
        return

    status = cache_status or nlp_insights.get("cache_status", "N/A")
    distribution = nlp_insights.get("sentiment_distribution") or {}
    positive = distribution.get("positive", {}).get("percentage", 0)
    neutral = distribution.get("neutral", {}).get("percentage", 0)
    negative = distribution.get("negative", {}).get("percentage", 0)
    top_themes = nlp_insights.get("top_themes") or []

    print("================ NLP FEEDBACK INTELLIGENCE SUMMARY ================")
    print(f"Dataset: {dataset_id}")
    print(f"NLP Cache Status: {status}")
    print(f"NLP Device: {nlp_insights.get('device', 'CPU fallback')}")
    print(f"Feedback Records Analyzed: {int(nlp_insights.get('feedback_records_analyzed') or 0):,}")
    print(f"Language Mode: {nlp_insights.get('language_mode', 'Unknown')}")
    print(f"Sentiment Model: {nlp_insights.get('sentiment_model', 'VADER fallback')}")
    print(f"Theme Model: {nlp_insights.get('theme_model', 'TF-IDF fallback')}")
    score = nlp_insights.get("overall_sentiment_score")
    print(f"Overall Sentiment Score: {score if score is not None else 'N/A'}%")
    print(f"Positive Feedback: {positive}%")
    print(f"Neutral Feedback: {neutral}%")
    print(f"Negative Feedback: {negative}%")
    print(f"Mixed Signal Flags: {nlp_insights.get('possible_sarcasm_count', 0)}")
    print(f"Most Discussed Aspect: {nlp_insights.get('most_discussed_aspect') or nlp_insights.get('top_complaint_aspect') or 'N/A'}")
    print(f"Top Positive Aspect: {nlp_insights.get('top_positive_aspect') or 'N/A'}")
    print("Top Feedback Themes:")
    if top_themes:
        for theme in top_themes[:5]:
            print(f"* {theme}")
    else:
        print("* N/A")
    print(f"NLP Processing Time: {nlp_insights.get('processing_time_ms', 'N/A')} ms")
    print(f"Fallback Used: {'Yes' if nlp_insights.get('fallback_used') else 'No'}")
    diagnostics = nlp_insights.get("diagnostics") or {}
    if diagnostics:
        print(
            "Diagnostics: "
            f"transformers_available={diagnostics.get('transformers_available')} | "
            f"sentence_transformers_available={diagnostics.get('sentence_transformers_available')} | "
            f"keybert_available={diagnostics.get('keybert_available')} | "
            f"device={diagnostics.get('device')} | "
            f"fallback_used={diagnostics.get('fallback_used')}"
        )
    print("===================================================================")

    rows = nlp_insights.get("top_themes_by_segment") or []
    if rows:
        print("NLP by Segment:")
        for row in rows:
            themes = ", ".join((row.get("top_themes") or row.get("top_keywords") or [])[:3]) or "N/A"
            print(
                f"{row.get('segment_display_name', 'Segment')} | "
                f"Sentiment={row.get('sentiment_label', 'Unknown')} | "
                f"Top Aspect={row.get('top_negative_aspect') or row.get('top_positive_aspect') or 'N/A'} | "
                f"Themes={themes} | "
                f"Mixed Signal Flags={row.get('possible_sarcasm_count', 0)}"
            )
