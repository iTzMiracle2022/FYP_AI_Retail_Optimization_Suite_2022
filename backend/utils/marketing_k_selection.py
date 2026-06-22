from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import MiniBatchKMeans
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score


def _safe_float(value: Any, digits: int = 4) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, digits)


def _normalize(values: list[float | None], *, higher_is_better: bool = True) -> list[float]:
    valid = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    if not valid:
        return [0.0 for _ in values]
    low = min(valid)
    high = max(valid)
    if high == low:
        return [0.5 if v is not None else 0.0 for v in values]

    normalized = []
    for value in values:
        if value is None:
            normalized.append(0.0)
            continue
        score = (float(value) - low) / (high - low)
        normalized.append(score if higher_is_better else 1 - score)
    return normalized


def _quality_label(silhouette: float | None, validation_score: float | None) -> str:
    sil = silhouette if silhouette is not None else 0.0
    score = validation_score if validation_score is not None else 0.0
    if sil >= 0.18 and score >= 0.62:
        return "Good"
    if sil >= 0.06 and score >= 0.42:
        return "Moderate"
    return "Weak"


def _business_usability_score(k: int, business_min_k: int, business_max_k: int) -> float:
    if business_min_k <= k <= business_max_k:
        midpoint = (business_min_k + business_max_k) / 2
        distance = abs(k - midpoint)
        return max(0.78, 1.0 - (distance * 0.08))
    if k < business_min_k:
        return 0.58
    return max(0.15, 0.52 - ((k - business_max_k) * 0.17))


def _candidate_reason(selected: dict) -> str:
    k = selected.get("k")
    balance = selected.get("balance_status")
    if balance == "balanced":
        return (
            f"Selected {k} groups because it provided the best balance between "
            "cluster separation, segment size balance, and business usability."
        )
    return (
        f"Selected {k} groups because it had the strongest validation trade-off "
        "while keeping the segmentation practical for business use."
    )


def recommend_marketing_k(
    X_df: pd.DataFrame,
    *,
    min_k: int = 2,
    max_k: int = 8,
    business_min_k: int = 3,
    business_max_k: int = 6,
    random_state: int = 42,
) -> dict:
    """
    Evaluate candidate K values on the already-preprocessed Marketing feature matrix.
    The final score blends statistical separation with segment-size balance and
    a practical SaaS preference for 3-6 customer groups.
    """
    n_samples = len(X_df)
    upper_k = min(max_k, max(min_k, n_samples - 1))
    candidate_range = range(min_k, upper_k + 1)
    candidates: list[dict] = []

    if n_samples < 3:
        return {
            "selected_k": 2,
            "quality_label": "Weak",
            "selection_method": "auto_validation",
            "reason": "Not enough customer rows were available for a reliable Auto-K comparison.",
            "candidate_scores": [],
        }

    for k in candidate_range:
        if k >= n_samples:
            continue

        try:
            model = MiniBatchKMeans(
                n_clusters=k,
                random_state=random_state,
                batch_size=2048,
                n_init=3,
            )
            labels = model.fit_predict(X_df)
            unique_labels = np.unique(labels)
            if len(unique_labels) < 2:
                continue

            counts = np.bincount(labels.astype(int), minlength=k)
            shares = counts / counts.sum() * 100
            min_share = float(shares.min())
            max_share = float(shares.max())
            balance_status = "balanced" if min_share >= 5 and max_share <= 70 else "imbalanced"
            sample_limit = min(n_samples, 10000)

            candidate = {
                "k": int(k),
                "silhouette_score": _safe_float(
                    silhouette_score(X_df, labels, sample_size=sample_limit, random_state=random_state)
                ),
                "davies_bouldin_score": _safe_float(davies_bouldin_score(X_df, labels)),
                "calinski_harabasz_score": _safe_float(calinski_harabasz_score(X_df, labels)),
                "inertia": _safe_float(model.inertia_, digits=2),
                "min_cluster_share": _safe_float(min_share, digits=1),
                "max_cluster_share": _safe_float(max_share, digits=1),
                "balance_status": balance_status,
            }
            candidates.append(candidate)
        except Exception as exc:
            print(f"[marketing_auto_k] Candidate K={k} failed: {exc}")

    if not candidates:
        fallback_k = min(4, max(min_k, n_samples - 1))
        return {
            "selected_k": int(fallback_k),
            "quality_label": "Weak",
            "selection_method": "auto_validation",
            "reason": "Auto-K validation could not compare candidates reliably, so a conservative group count was selected.",
            "candidate_scores": [],
        }

    sil_norm = _normalize([c["silhouette_score"] for c in candidates])
    db_norm = _normalize([c["davies_bouldin_score"] for c in candidates], higher_is_better=False)
    ch_norm = _normalize([c["calinski_harabasz_score"] for c in candidates])
    inertia_norm = _normalize([c["inertia"] for c in candidates], higher_is_better=False)

    for idx, candidate in enumerate(candidates):
        k = candidate["k"]
        min_share = candidate["min_cluster_share"] or 0.0
        max_share = candidate["max_cluster_share"] or 100.0
        balance_score = 1.0 if candidate["balance_status"] == "balanced" else 0.35
        business_usability_score = _business_usability_score(k, business_min_k, business_max_k)
        complexity_penalty = max(0, k - business_max_k) * 0.07
        small_segment_penalty = 0.12 if min_share < 5 else 0.0
        dominant_segment_penalty = 0.10 if max_share > 70 else 0.0
        small_dataset_penalty = 0.08 if n_samples < 250 and k > 5 else 0.0

        validation_score = (
            0.32 * sil_norm[idx]
            + 0.20 * db_norm[idx]
            + 0.16 * ch_norm[idx]
            + 0.10 * inertia_norm[idx]
            + 0.10 * balance_score
            + 0.12 * business_usability_score
            - complexity_penalty
            - small_segment_penalty
            - dominant_segment_penalty
            - small_dataset_penalty
        )
        candidate["business_usability_score"] = _safe_float(business_usability_score, digits=3)
        candidate["validation_score"] = _safe_float(validation_score, digits=4)

    best = max(candidates, key=lambda item: item.get("validation_score") or -1)
    business_candidates = [
        candidate for candidate in candidates
        if business_min_k <= candidate["k"] <= business_max_k
    ]
    if business_candidates and not (business_min_k <= best["k"] <= business_max_k):
        best_business = max(business_candidates, key=lambda item: item.get("validation_score") or -1)
        best_score = best.get("validation_score") or 0.0
        business_score = best_business.get("validation_score") or 0.0
        if business_score >= best_score - 0.08:
            best = best_business

    best["quality_label"] = _quality_label(best.get("silhouette_score"), best.get("validation_score"))

    return {
        "selected_k": int(best["k"]),
        "quality_label": best["quality_label"],
        "selection_method": "auto_validation",
        "reason": _candidate_reason(best),
        "candidate_scores": candidates,
    }
