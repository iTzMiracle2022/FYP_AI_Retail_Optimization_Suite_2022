"""
TF-IDF text features for Marketing Intelligence (NLP + clustering alignment).

Uses scikit-learn and NLTK (VADER). Combines object/string columns into
a per-row document, runs sentiment analysis and applies TfidfVectorizer.
The resulting sparse lexical features + sentiment score are merged with RFM-style
numeric features before Clustering.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

TEXT_NAME_HINTS = (
    "description",
    "review",
    "comment",
    "feedback",
    "campaign",
    "response",
    "note",
    "text",
    "message",
    "complain",
    "subject",
    "body",
    "content",
    "remarks",
)


def _skip_id_column(name: str) -> bool:
    n = name.strip().lower()
    return n in ("id", "customer id", "customer_id", "userid", "user_id")


def _candidate_object_columns(df: pd.DataFrame) -> list[str]:
    """Object columns suitable for text mining (exclude obvious IDs)."""
    out: list[str] = []
    for c in df.columns:
        if not pd.api.types.is_string_dtype(df[c]) and not pd.api.types.is_object_dtype(df[c]):
            continue
        if _skip_id_column(c):
            continue
        out.append(c)
    return out


def build_corpus(df: pd.DataFrame) -> tuple[pd.Series, list[str]]:
    """
    One whitespace-joined document per row. Prefers columns whose names suggest
    free text; otherwise uses all non-ID object columns.
    """
    cols = _candidate_object_columns(df)
    if not cols:
        return pd.Series([""] * len(df)), []

    hinted = [c for c in cols if any(h in c.lower() for h in TEXT_NAME_HINTS)]
    use_cols = hinted if hinted else cols

    acc = df[use_cols[0]].fillna("").astype(str).str.strip()
    for c in use_cols[1:]:
        acc = acc + " " + df[c].fillna("").astype(str).str.strip()
    return acc, use_cols


def fit_transform_tfidf(
    df: pd.DataFrame,
    vectorizer: TfidfVectorizer | None,
    *,
    fit: bool,
) -> tuple[np.ndarray, TfidfVectorizer | None, list[str]]:
    """
    Returns dense (n_samples, n_features) TF-IDF array, fitted vectorizer, and
    column names used for the corpus. Empty array second dim if no text signal.
    """
    corpus, used_cols = build_corpus(df)
    if not used_cols or corpus.str.len().sum() == 0:
        return np.zeros((len(df), 0)), vectorizer, []

    n = len(df)
    min_df = 1 if n < 50 else min(2, max(1, n // 25))
    max_features = min(48, max(8, n // 2))

    if vectorizer is None:
        vectorizer = TfidfVectorizer(
            max_features=max_features,
            min_df=min_df,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )

    if fit:
        X = vectorizer.fit_transform(corpus)
    else:
        X = vectorizer.transform(corpus)

    dense = X.toarray().astype(np.float32)
    
    # Methodology Alignment: NLTK VADER Sentiment Analysis
    try:
        import nltk
        from nltk.sentiment import SentimentIntensityAnalyzer
        try:
            nltk.data.find('sentiment/vader_lexicon.zip')
        except LookupError:
            nltk.download('vader_lexicon', quiet=True)
        sia = SentimentIntensityAnalyzer()
        scores = corpus.apply(lambda text: sia.polarity_scores(str(text))['compound'])
        vader_dense = scores.values.reshape(-1, 1).astype(np.float32)
        dense = np.hstack([dense, vader_dense])
    except Exception as e:
        print(f"  ⚠️ NLTK VADER failure: {e}")

    return dense, vectorizer, used_cols
