from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.error_handlers import handle_errors, APIError
from models.churn_predictor import ChurnPredictor, CHURN_MODEL_VERSION
from utils.churn_chart_mapper import generate_chart_data
churn_bp = Blueprint('churn', __name__, url_prefix='/api/churn')
predictor = ChurnPredictor()
loader = DataLoader()
from config import config


import os
import json
import hashlib
from datetime import datetime

import joblib

AI_SNAPSHOT_VERSION = "ai_behavior_snapshot_v8_nonzero_risk_zone_payloads"
CUSTOMER_DASHBOARD_CACHE_VERSION = "customer_dashboard_v4_customer_key_index_reset"
RISK_ZONE_ORDER = ["Low Risk", "Watchlist", "Highest Available Risk", "High Risk"]


def _json_safe(value):
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, float) and pd.isna(value):
        return None
    return value


def _feature_schema_hash(feature_schema):
    payload = json.dumps(list(feature_schema or []), sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _ai_behavior_cache_paths(dataset_id):
    safe_id = predictor._safe_dataset_id(dataset_id)
    cache_dir = predictor.cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    return (
        cache_dir / f"{safe_id}_ai_behavior_snapshot.joblib",
        cache_dir / f"{safe_id}_ai_behavior_charts.json",
    )


def _customer_dashboard_cache_path(dataset_id):
    safe_id = predictor._safe_dataset_id(dataset_id)
    cache_dir = predictor.cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{safe_id}_customer_dashboard.joblib"


def _customer_dashboard_cache_metadata(dataset_id, raw_df, has_actual_churn_label):
    return {
        "dataset_id": dataset_id,
        "dataset_hash": predictor._dataset_hash(raw_df),
        "model_version": CHURN_MODEL_VERSION,
        "ai_snapshot_version": AI_SNAPSHOT_VERSION,
        "customer_dashboard_cache_version": CUSTOMER_DASHBOARD_CACHE_VERSION,
        "has_actual_churn_label": bool(has_actual_churn_label),
    }


def _load_customer_dashboard_cache(dataset_id, raw_df, has_actual_churn_label, force_retune=False):
    cache_path = _customer_dashboard_cache_path(dataset_id)
    expected_metadata = _customer_dashboard_cache_metadata(dataset_id, raw_df, has_actual_churn_label)
    if force_retune or not cache_path.exists():
        return None

    try:
        cached = joblib.load(cache_path)
        metadata = cached.get("metadata") or {}
        if all(metadata.get(k) == v for k, v in expected_metadata.items()):
            customer_summary_df = cached.get("customer_summary_df")
            if isinstance(customer_summary_df, pd.DataFrame):
                print(f"✅ Loaded cached customer dashboard summary: {cache_path}")
                return cached
    except Exception as exc:
        print(f"⚠️ Customer dashboard cache ignored. Reason: {type(exc).__name__}: {str(exc)[:180]}")
    return None


def _load_cached_model_metadata(dataset_id, raw_df):
    _, metadata_path = predictor._cache_paths(dataset_id)
    if not metadata_path.exists():
        return None

    try:
        with open(metadata_path, "r") as fh:
            metadata = json.load(fh)
        expected_hash = predictor._dataset_hash(raw_df)
        if (
            metadata.get("dataset_id") == dataset_id
            and metadata.get("dataset_hash") == expected_hash
            and metadata.get("model_version") == CHURN_MODEL_VERSION
        ):
            return metadata
    except Exception as exc:
        print(f"⚠️ Cached model metadata ignored. Reason: {type(exc).__name__}: {str(exc)[:180]}")
    return None


def _save_customer_dashboard_cache(dataset_id, raw_df, has_actual_churn_label, payload):
    cache_path = _customer_dashboard_cache_path(dataset_id)
    metadata = {
        **_customer_dashboard_cache_metadata(dataset_id, raw_df, has_actual_churn_label),
        "generated_at": datetime.now().isoformat(),
        "cache_path": str(cache_path),
    }
    joblib.dump({"metadata": metadata, **payload}, cache_path)
    print(f"✅ Saved customer dashboard summary cache: {cache_path}")


def _build_customer_dashboard_payload(merged_df, source_df, has_actual_churn_label, include_customer_transactions=False):
    # ── Fast Vectorized Customer-Level Grouping
    merged_df = merged_df.copy()
    merged_df["Total Purchase Amount"] = pd.to_numeric(merged_df.get("Total Purchase Amount", pd.Series([0]*len(merged_df))), errors="coerce").fillna(0)
    merged_df["Returns"] = pd.to_numeric(merged_df.get("Returns", pd.Series([0]*len(merged_df))), errors="coerce").fillna(0)
    merged_df["Purchase Date"] = pd.to_datetime(merged_df.get("Purchase Date"), errors="coerce")
    valid_purchase_dates = merged_df["Purchase Date"].dropna()
    dataset_date_bounds = {
        "min_date": valid_purchase_dates.min().strftime("%Y-%m-%d") if not valid_purchase_dates.empty else None,
        "max_date": valid_purchase_dates.max().strftime("%Y-%m-%d") if not valid_purchase_dates.empty else None,
    }

    if "_customer_key" not in merged_df.columns:
        merged_df["_customer_key"] = predictor._customer_keys(merged_df).reset_index(drop=True)

    grouped = merged_df.groupby("_customer_key", dropna=False)

    orders = grouped.size()
    revenue = grouped["Total Purchase Amount"].sum()
    last_order = grouped["Purchase Date"].max().dt.strftime('%Y-%m-%d')
    if "model_churn_probability" in merged_df:
        max_probability = grouped["model_churn_probability"].max()
    else:
        max_probability = pd.Series([0.0]*len(grouped), index=grouped.groups.keys())
    if "model_predicted_churn" in merged_df:
        model_predicted_churn = grouped["model_predicted_churn"].max()
    else:
        model_predicted_churn = pd.Series([0]*len(grouped), index=grouped.groups.keys())
    if "actual_churn" in merged_df and has_actual_churn_label:
        actual_churn = grouped["actual_churn"].max()
    else:
        actual_churn = pd.Series([None]*len(grouped), index=grouped.groups.keys())
    dashboard_churn_status = model_predicted_churn

    customer_display_names = grouped["Customer Name"].first().fillna(orders.index.to_series()).astype(str)
    customer_ref_id = grouped["Customer ID"].first() if "Customer ID" in merged_df else grouped["_source_index"].min()

    gender = grouped["Gender"].first() if "Gender" in merged_df else pd.Series(None, index=grouped.groups.keys())
    age = grouped["Age"].first() if "Age" in merged_df else (grouped["Customer Age"].first() if "Customer Age" in merged_df else pd.Series(None, index=grouped.groups.keys()))
    returns = grouped["Returns"].sum()

    categories = grouped["Product Category"].agg(lambda x: list(pd.Series(x.dropna().unique()).head(10))) if "Product Category" in merged_df else pd.Series([[]]*len(grouped), index=grouped.groups.keys())
    payment_methods = grouped["Payment Method"].agg(lambda x: list(pd.Series(x.dropna().unique()).head(10))) if "Payment Method" in merged_df else pd.Series([[]]*len(grouped), index=grouped.groups.keys())

    # Optional lightweight transactions for exact frontend date-range recalculation.
    # Default response skips this large nested payload to keep Churn analysis responsive.
    if include_customer_transactions and "Purchase Date" in merged_df and "Total Purchase Amount" in merged_df:
        cols = ["_customer_key", "Purchase Date", "Total Purchase Amount"]
        opt_cols = {"Product Category": "category", "Payment Method": "payment_method", "Product Price": "price", "Quantity": "quantity", "Returns": "returns"}
        for c in opt_cols.keys():
            if c in merged_df:
                cols.append(c)

        tx_df = merged_df[cols].copy()
        tx_df["Purchase Date"] = tx_df["Purchase Date"].dt.strftime('%Y-%m-%d')
        tx_records = tx_df.to_dict('records')
        tx_grouped = {}
        for r in tx_records:
            c = r["_customer_key"]
            if c not in tx_grouped:
                tx_grouped[c] = []

            tx_item = {
                'date': r["Purchase Date"],
                'amount': r["Total Purchase Amount"]
            }
            for og_c, new_c in opt_cols.items():
                if og_c in r:
                    val = r[og_c]
                    tx_item[new_c] = val if pd.notna(val) else None

            tx_grouped[c].append(tx_item)
        transactions = pd.Series(tx_grouped)
    else:
        transactions = None

    historical_status = actual_churn.apply(
        lambda value: "At Risk" if pd.notna(value) and int(value) == 1 else ("Safe" if pd.notna(value) else None)
    )

    customer_summary_df = pd.DataFrame({
        'customer_name': customer_display_names,
        'customer_ref_id': customer_ref_id.fillna(0).astype(int),
        'orders': orders.fillna(0).astype(int),
        'revenue': revenue.fillna(0).astype(float),
        'aov': (revenue / orders.replace(0, 1)).fillna(0).astype(float),
        'last_order': last_order,
        'churn_probability': max_probability.fillna(0).astype(float),
        'churn_prediction': dashboard_churn_status,
        'actual_churn': actual_churn,
        'historical_status': historical_status,
        'model_predicted_churn': model_predicted_churn.fillna(0).astype(int),
        'model_churn_probability': max_probability.fillna(0).astype(float),
        'gender': gender.astype(str).replace('nan', None),
        'age': age.astype(float),
        'returns': returns.fillna(0).astype(float),
        'categories': categories,
        'payment_methods': payment_methods,
    }, index=orders.index)
    customer_summary_df["_customer_key"] = customer_summary_df.index.astype(str)
    if transactions is not None:
        customer_summary_df["transactions"] = transactions

    def get_risk(pred):
        if pd.isna(pred):
            return None
        return 'At Risk' if int(pred) == 1 else 'Safe'

    customer_summary_df['risk_level'] = customer_summary_df['churn_prediction'].apply(get_risk)
    customer_summary_df['status'] = customer_summary_df['risk_level']
    customer_summary_df['dashboard_churn_status'] = customer_summary_df['churn_prediction']

    if not customer_summary_df.empty:
        # Sort exactly as requested: At Risk first, Revenue desc, Last Order desc
        customer_summary_df['_is_at_risk'] = customer_summary_df['risk_level'] == 'At Risk'
        customer_summary_df = customer_summary_df.sort_values(
            by=['_is_at_risk', 'revenue', 'last_order'],
            ascending=[False, False, False]
        )
        customer_summary_df.drop(columns=['_is_at_risk'], inplace=True)
    customer_summary_df = customer_summary_df.reset_index(drop=True)

    filter_options = {
        'categories': source_df.get('Product Category', pd.Series([])).dropna().unique().tolist(),
        'payment_methods': source_df.get('Payment Method', pd.Series([])).dropna().unique().tolist(),
        'genders': source_df.get('Gender', pd.Series([])).dropna().unique().tolist()
    }

    total_transactions = len(merged_df)
    total_customers = len(customer_summary_df)
    if not customer_summary_df.empty:
        at_risk_customers = int(sum(customer_summary_df['model_predicted_churn'] == 1))
        safe_customers = int(sum(customer_summary_df['model_predicted_churn'] == 0))
    else:
        at_risk_customers = 0
        safe_customers = 0
    medium_risk_customers = 0
    churn_risk_percentage = (at_risk_customers / total_customers * 100) if total_customers > 0 else 0.0

    historical_safe_customers = None
    historical_at_risk_customers = None
    model_agreement_customers = None
    model_disagreement_customers = None
    model_agreement_rate = None
    if has_actual_churn_label and not customer_summary_df.empty:
        actual_values = pd.to_numeric(customer_summary_df["actual_churn"], errors="coerce")
        predicted_values = pd.to_numeric(customer_summary_df["model_predicted_churn"], errors="coerce")
        labeled_mask = actual_values.notna()
        labeled_count = int(labeled_mask.sum())
        historical_at_risk_customers = int((actual_values[labeled_mask] == 1).sum())
        historical_safe_customers = int((actual_values[labeled_mask] == 0).sum())
        model_agreement_customers = int((actual_values[labeled_mask].astype(int) == predicted_values[labeled_mask].astype(int)).sum())
        model_disagreement_customers = labeled_count - model_agreement_customers
        model_agreement_rate = (model_agreement_customers / labeled_count * 100) if labeled_count else None

    summary = {
        'total_transactions': total_transactions,
        'total_customers': total_customers,
        'safe_customers': safe_customers,
        'medium_risk_customers': medium_risk_customers,
        'at_risk_customers': at_risk_customers,
        'churn_risk_percentage': churn_risk_percentage,
        'kpi_source': 'ai_model_predictions',
        'historical_safe_customers': historical_safe_customers,
        'historical_at_risk_customers': historical_at_risk_customers,
        'model_agreement_customers': model_agreement_customers,
        'model_disagreement_customers': model_disagreement_customers,
        'model_agreement_rate': model_agreement_rate,
    }
    chart_data = generate_chart_data(merged_df, customer_summary_df.copy()) if has_actual_churn_label else {}

    return {
        "customer_summary_df": customer_summary_df,
        "summary": summary,
        "filter_options": filter_options,
        "dataset_date_bounds": dataset_date_bounds,
        "chart_data": chart_data,
    }


def _risk_zone_cutoff_percentages(
    selected_threshold,
    score_percent=None,
    at_risk_mask=None,
    total_count=0,
    high_risk_quantile=0.90,
    min_absolute_high_count=10,
    min_absolute_high_share=0.001,
):
    threshold = float(selected_threshold if selected_threshold is not None else 0.5)
    threshold = min(max(threshold, 0.0), 1.0)
    low_max_score_percent = round(threshold * 100.0, 1)
    absolute_high_min_score_percent = round((threshold + ((1.0 - threshold) * 0.5)) * 100.0, 1)

    score_basis = "fallback_midpoint"
    relative_high_min_score_percent = None
    absolute_high_count = 0
    at_risk_count = 0
    max_observed_score_percent = None
    if score_percent is not None:
        numeric_scores = pd.to_numeric(pd.Series(score_percent), errors="coerce")
        max_observed_score_percent = round(float(numeric_scores.max()), 1) if numeric_scores.notna().any() else None
        if at_risk_mask is not None:
            at_risk_flags = pd.Series(at_risk_mask)
            if len(at_risk_flags) == len(numeric_scores):
                at_risk_flags.index = numeric_scores.index
            at_risk_flags = at_risk_flags.fillna(False).astype(bool)
            at_risk_scores = numeric_scores[at_risk_flags].dropna()
        else:
            at_risk_scores = numeric_scores[numeric_scores > low_max_score_percent].dropna()
            at_risk_flags = numeric_scores > low_max_score_percent
        at_risk_count = int(at_risk_flags.sum())
        absolute_high_count = int((at_risk_flags & (numeric_scores >= absolute_high_min_score_percent)).sum())
        if not at_risk_scores.empty:
            relative_high_min_score_percent = round(float(at_risk_scores.quantile(high_risk_quantile)), 1)
            relative_high_min_score_percent = min(max(relative_high_min_score_percent, low_max_score_percent), 100.0)
            score_basis = "at_risk_score_quantile"
    minimum_absolute_high_count = max(
        int(min_absolute_high_count),
        int(np.ceil(float(total_count or 0) * float(min_absolute_high_share))),
    )
    relative_fallback_enabled = (
        relative_high_min_score_percent is not None
        and absolute_high_count < minimum_absolute_high_count
    )

    return {
        "selected_threshold": threshold,
        "low_max_score_percent": low_max_score_percent,
        "watchlist_min_exclusive_score_percent": low_max_score_percent,
        "absolute_high_min_score_percent": absolute_high_min_score_percent,
        "high_min_score_percent": absolute_high_min_score_percent,
        "relative_high_min_score_percent": relative_high_min_score_percent,
        "highest_available_min_score_percent": relative_high_min_score_percent if relative_fallback_enabled else None,
        "method": "absolute_threshold_with_relative_fallback",
        "formula": "high_min = selected_threshold + (1 - selected_threshold) * 0.5; if sparse, highest_available_min = p90(score_percent where model_predicted_churn == 1)",
        "high_risk_quantile": high_risk_quantile,
        "score_basis": score_basis,
        "relative_fallback_enabled": relative_fallback_enabled,
        "minimum_absolute_high_count": minimum_absolute_high_count,
        "absolute_high_count": absolute_high_count,
        "at_risk_count": at_risk_count,
        "max_observed_score_percent": max_observed_score_percent,
        "max_observed_probability": round(float(max_observed_score_percent / 100.0), 4) if max_observed_score_percent is not None else None,
    }


def _assign_score_band_risk_zones(snapshot_df, selected_threshold=0.5):
    snapshot_df = snapshot_df.copy()
    total = len(snapshot_df)
    threshold = float(selected_threshold if selected_threshold is not None else 0.5)
    threshold = min(max(threshold, 0.0), 1.0)
    if "risk_score_percent" in snapshot_df:
        score_percent = pd.to_numeric(snapshot_df["risk_score_percent"], errors="coerce").fillna(0.0)
    else:
        probability_source = snapshot_df["model_churn_probability"] if "model_churn_probability" in snapshot_df else pd.Series(0.0, index=snapshot_df.index)
        score_percent = (pd.to_numeric(probability_source, errors="coerce").fillna(0.0) * 100).round(1)
    probability_source = snapshot_df["model_churn_probability"] if "model_churn_probability" in snapshot_df else pd.Series(0.0, index=snapshot_df.index)
    scores = pd.to_numeric(probability_source, errors="coerce").fillna(0.0)
    if "model_predicted_churn" in snapshot_df:
        at_risk_mask = pd.to_numeric(snapshot_df["model_predicted_churn"], errors="coerce").fillna(0).astype(int) == 1
    else:
        at_risk_mask = scores >= threshold
    cutoffs = _risk_zone_cutoff_percentages(
        selected_threshold,
        score_percent=score_percent,
        at_risk_mask=at_risk_mask,
        total_count=total,
    )
    low_max_score_percent = cutoffs["low_max_score_percent"]
    high_min_score_percent = cutoffs["high_min_score_percent"]
    relative_high_min_score_percent = cutoffs.get("relative_high_min_score_percent")
    if total == 0:
        snapshot_df["risk_zone"] = []
        snapshot_df["model_risk_level"] = []
        snapshot_df["risk_percentile"] = []
        return snapshot_df, cutoffs

    sorted_index = scores.sort_values(kind="mergesort").index
    positions = pd.Series(np.arange(total), index=sorted_index)
    percentiles = (positions / total) * 100

    zones = pd.Series("Low Risk", index=snapshot_df.index, dtype=object)
    zones.loc[at_risk_mask] = "Watchlist"
    absolute_high_mask = at_risk_mask & (score_percent >= high_min_score_percent)
    relative_fallback_mask = pd.Series(False, index=snapshot_df.index)
    if cutoffs.get("relative_fallback_enabled") and relative_high_min_score_percent is not None:
        relative_fallback_mask = at_risk_mask & ~absolute_high_mask & (score_percent >= relative_high_min_score_percent)
        zones.loc[relative_fallback_mask] = "Highest Available Risk"
    zones.loc[absolute_high_mask] = "High Risk"

    cutoffs["absolute_high_count"] = int(absolute_high_mask.sum())
    cutoffs["relative_fallback_count"] = int(relative_fallback_mask.sum())
    cutoffs["watchlist_count"] = int((zones == "Watchlist").sum())
    cutoffs["low_risk_count"] = int((zones == "Low Risk").sum())

    cutoffs["low_rule"] = "model_predicted_churn == 0"
    cutoffs["watchlist_rule"] = f"model_predicted_churn == 1 and score < {relative_high_min_score_percent:g}" if cutoffs.get("relative_fallback_enabled") and relative_high_min_score_percent is not None else f"model_predicted_churn == 1 and score < {high_min_score_percent:g}"
    cutoffs["highest_available_rule"] = f"model_predicted_churn == 1 and score >= {relative_high_min_score_percent:g} and score < {high_min_score_percent:g}" if cutoffs.get("relative_fallback_enabled") and relative_high_min_score_percent is not None else None
    cutoffs["high_rule"] = f"model_predicted_churn == 1 and score >= {high_min_score_percent:g}"

    snapshot_df["risk_percentile"] = percentiles.reindex(snapshot_df.index).round(4)
    snapshot_df["risk_zone"] = zones
    snapshot_df["model_risk_level"] = zones
    return snapshot_df, cutoffs


def _recency_bucket(days):
    if pd.isna(days):
        return "Unknown"
    days = float(days)
    if days <= 30:
        return "0-30 days"
    if days <= 60:
        return "31-60 days"
    if days <= 90:
        return "61-90 days"
    if days <= 180:
        return "91-180 days"
    return "180+ days"


def _add_aov_band(snapshot_df):
    snapshot_df = snapshot_df.copy()
    snapshot_df["aov_band"] = "Unknown"
    values = pd.to_numeric(snapshot_df.get("avg_order_value"), errors="coerce")
    valid = values.notna()
    if valid.sum() <= 3:
        return snapshot_df

    labels = ["Low AOV", "Mid AOV", "High AOV", "Premium AOV"]
    try:
        categories = pd.qcut(values[valid], q=4, labels=labels, duplicates="drop")
        snapshot_df.loc[valid, "aov_band"] = categories.astype(str)
    except Exception:
        ranks = values[valid].rank(method="first", pct=True)
        snapshot_df.loc[ranks[ranks <= 0.25].index, "aov_band"] = "Low AOV"
        snapshot_df.loc[ranks[(ranks > 0.25) & (ranks <= 0.5)].index, "aov_band"] = "Mid AOV"
        snapshot_df.loc[ranks[(ranks > 0.5) & (ranks <= 0.75)].index, "aov_band"] = "High AOV"
        snapshot_df.loc[ranks[ranks > 0.75].index, "aov_band"] = "Premium AOV"
    return snapshot_df


def _apply_ai_behavior_filters(snapshot_df, filters=None):
    if snapshot_df is None or snapshot_df.empty or not filters:
        return snapshot_df.copy() if snapshot_df is not None else pd.DataFrame()

    filtered = snapshot_df.copy()
    filter_map = {
        "risk_zone": "risk_zone",
        "category": "primary_product_category",
        "payment_method": "primary_payment_method",
        "recency_bucket": "recency_bucket",
        "aov_band": "aov_band",
    }
    for key, column in filter_map.items():
        value = filters.get(key)
        if value and value != "All" and column in filtered:
            filtered = filtered[filtered[column].astype(str) == str(value)]
    return filtered


def _pct(part, total):
    return round((float(part) / float(total) * 100), 1) if total else 0.0


def _risk_zone_label(value):
    normalized = str(value or "").strip().lower()
    if normalized in {"0", "low", "low risk"}:
        return "Low Risk"
    if normalized in {"1", "medium", "med", "watchlist", "medium risk"}:
        return "Watchlist"
    if normalized in {"highest available risk", "highest available", "relative high", "relatively elevated", "elevated"}:
        return "Highest Available Risk"
    if normalized in {"2", "high", "high risk"}:
        return "High Risk"
    return str(value or "Unknown")


def _ai_recommended_action(risk_zone):
    zone = _risk_zone_label(risk_zone)
    if zone == "High Risk":
        return "Priority Outreach"
    if zone == "Highest Available Risk":
        return "Review Top-Ranked Risk"
    if zone == "Watchlist":
        return "Monitor Customer"
    if zone == "Low Risk":
        return "Retain Customer"
    return None


def _response_churn_mode(has_actual_churn_label):
    return "labeled_supervised" if has_actual_churn_label else "unlabeled_behavior_inference"


def build_ai_behavior_charts_from_snapshot(snapshot_df, filters=None, feature_importance=None):
    filtered = _apply_ai_behavior_filters(snapshot_df, filters)
    total = len(filtered)
    charts = {
        "ai_predicted_risk_distribution": [],
        "risk_score_bands": [],
        "ai_risk_by_category": [],
        "ai_revenue_at_risk_by_category": [],
        "ai_risk_by_payment_method": [],
        "ai_risk_by_recency_bucket": [],
        "ai_risk_by_aov_band": [],
        "top_ai_churn_signals": [],
        "filtered_total_customers": total,
    }
    if filtered.empty:
        return charts

    filtered = filtered.copy()
    filtered["risk_zone"] = filtered["risk_zone"].apply(_risk_zone_label)
    filtered["model_churn_probability"] = pd.to_numeric(filtered["model_churn_probability"], errors="coerce").fillna(0.0)

    risk_order = RISK_ZONE_ORDER
    for zone in risk_order:
        customer_count = int((filtered["risk_zone"] == zone).sum())
        if customer_count == 0:
            continue
        charts["ai_predicted_risk_distribution"].append({
            "label": zone,
            "customer_count": customer_count,
            "percentage": _pct(customer_count, total),
            "explanation": "Risk zones are based on customer behavior score bands."
        })

    try:
        bins = [0, 20, 40, 60, 80, 100.000001]
        labels = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"]
        scores = pd.to_numeric(filtered["risk_score_percent"], errors="coerce").clip(lower=0, upper=100)
        binned = pd.cut(scores, bins=bins, right=False, labels=labels, include_lowest=True)
        counts = binned.value_counts().sort_index()
        charts["risk_score_bands"] = [
            {
                "label": str(label),
                "customer_count": int(count),
                "percentage": _pct(count, total),
                "explanation": "Risk score range based on customer behavior patterns."
            }
            for label, count in counts.items()
        ]
    except Exception:
        charts["risk_score_bands"] = []

    def grouped_risk(column, output_key, legacy_label_key=None):
        rows = []
        if column not in filtered:
            return rows
        for label, group in filtered.groupby(column, dropna=False):
            customer_count = len(group)
            high_count = int(sum(1 for value in group["risk_zone"] if _risk_zone_label(value) in {"High Risk", "Highest Available Risk"}))
            avg_risk = float(group["model_churn_probability"].mean() * 100) if customer_count else 0.0
            display_label = str(label) if pd.notna(label) else "Unknown"
            row = {
                "label": display_label,
                "customer_count": customer_count,
                "avg_model_risk_score": round(avg_risk, 1),
                "high_risk_customers": high_count,
                "high_risk_rate": _pct(high_count, customer_count),
                "explanation": "Risk zones are based on customer behavior score bands."
            }
            if legacy_label_key:
                row[legacy_label_key] = display_label
            rows.append(row)
        charts[output_key] = sorted(rows, key=lambda x: x.get("avg_model_risk_score", 0), reverse=True)
        return charts[output_key]

    grouped_risk("primary_product_category", "ai_risk_by_category", "category")
    grouped_risk("primary_payment_method", "ai_risk_by_payment_method", "payment_method")
    grouped_risk("recency_bucket", "ai_risk_by_recency_bucket", "bucket")
    grouped_risk("aov_band", "ai_risk_by_aov_band", "band")

    revenue_rows = []
    if "primary_product_category" in filtered:
        for category, group in filtered.groupby("primary_product_category", dropna=False):
            customer_count = len(group)
            exposure = (pd.to_numeric(group["total_revenue"], errors="coerce").fillna(0) * pd.to_numeric(group["model_churn_probability"], errors="coerce").fillna(0)).sum()
            high_count = int(sum(1 for value in group["risk_zone"] if _risk_zone_label(value) in {"High Risk", "Highest Available Risk"}))
            display_label = str(category) if pd.notna(category) else "Unknown"
            revenue_rows.append({
                "label": display_label,
                "category": display_label,
                "customer_count": customer_count,
                "probability_weighted_revenue_exposure": round(float(exposure), 2),
                "avg_model_risk_score": round(float(group["model_churn_probability"].mean() * 100), 1) if customer_count else 0.0,
                "high_risk_customers": high_count,
                "high_risk_rate": _pct(high_count, customer_count),
                "explanation": "Risk zones are based on customer behavior score bands."
            })
    charts["ai_revenue_at_risk_by_category"] = sorted(
        revenue_rows,
        key=lambda x: x["probability_weighted_revenue_exposure"],
        reverse=True
    )

    signal_map = {
        "total_orders": "Total Orders",
        "frequency_score": "Purchase Frequency Score",
        "total_revenue": "Total Revenue",
        "monetary_score": "Monetary Strength",
        "revenue_first_half": "Earlier Revenue",
        "revenue_second_half": "Recent Revenue",
        "order_count_second_half": "Recent Order Volume",
        "return_amount_proxy": "Return Activity",
        "orders_per_active_month": "Orders per Active Month",
        "purchase_frequency": "Purchase Frequency",
        "median_days_between_orders": "Typical Order Gap",
        "days_since_last_purchase": "Recency Gap",
    }
    top_signals = []
    for feature, value in sorted((feature_importance or {}).items(), key=lambda item: item[1], reverse=True)[:8]:
        top_signals.append({
            "label": signal_map.get(feature, str(feature).replace("_", " ").title()),
            "feature": str(feature),
            "value": round(float(value), 4),
            "explanation": "Higher value means the feature influenced model risk scoring more."
        })
    charts["top_ai_churn_signals"] = top_signals
    return charts


def _validate_ai_behavior_snapshot(snapshot_df, charts):
    if snapshot_df is None or snapshot_df.empty:
        return {
            "valid": False,
            "message": "AI behavior snapshot is empty.",
            "row_count": 0,
            "unique_customer_count": 0,
            "risk_distribution_total": 0,
            "risk_score_bands_total": 0,
            "duplicate_customer_count": 0,
            "actual_label_columns_used": False,
        }

    label_columns = {"Churn", "actual_churn", "dashboard_churn_status"}
    customer_key_col = "_customer_key" if "_customer_key" in snapshot_df else "customer_name"
    duplicate_count = int(snapshot_df[customer_key_col].duplicated().sum()) if customer_key_col in snapshot_df else len(snapshot_df)
    row_count = int(len(snapshot_df))
    unique_count = int(snapshot_df[customer_key_col].nunique()) if customer_key_col in snapshot_df else 0
    risk_distribution_total = int(sum(item.get("customer_count", 0) for item in charts.get("ai_predicted_risk_distribution", [])))
    risk_score_bands_total = int(sum(item.get("customer_count", 0) for item in charts.get("risk_score_bands", [])))
    actual_label_columns_used = any(col in snapshot_df.columns for col in label_columns)

    return {
        "valid": (
            row_count == unique_count
            and duplicate_count == 0
            and risk_distribution_total == row_count
            and risk_score_bands_total == row_count
            and not actual_label_columns_used
        ),
        "message": "AI behavior snapshot validation passed.",
        "row_count": row_count,
        "unique_customer_count": unique_count,
        "risk_distribution_total": risk_distribution_total,
        "risk_score_bands_total": risk_score_bands_total,
        "duplicate_customer_count": duplicate_count,
        "actual_label_columns_used": actual_label_columns_used,
    }


def build_customer_ai_behavior_snapshot(dataset_id, raw_df, customer_summary_df, churn_predictor, force_retune=False):
    dataset_hash = churn_predictor._dataset_hash(raw_df)
    feature_hash = _feature_schema_hash(churn_predictor.MODEL_INPUT_FEATURES)
    snapshot_path, charts_path = _ai_behavior_cache_paths(dataset_id)

    expected_metadata = {
        "dataset_id": dataset_id,
        "dataset_hash": dataset_hash,
        "model_version": CHURN_MODEL_VERSION,
        "feature_schema_hash": feature_hash,
        "ai_snapshot_version": AI_SNAPSHOT_VERSION,
    }

    if not force_retune and snapshot_path.exists() and charts_path.exists():
        try:
            cached = joblib.load(snapshot_path)
            snapshot_df = cached.get("snapshot")
            metadata = cached.get("metadata") or {}
            with open(charts_path, "r") as fh:
                cached_charts_payload = json.load(fh)
            if (
                isinstance(snapshot_df, pd.DataFrame)
                and all(metadata.get(k) == v for k, v in expected_metadata.items())
                and all((cached_charts_payload.get("metadata") or {}).get(k) == v for k, v in expected_metadata.items())
            ):
                print(f"✅ Loaded cached AI behavior snapshot: {snapshot_path}")
                return snapshot_df, cached_charts_payload.get("charts") or {}, metadata, cached_charts_payload.get("validation") or {}, True
        except Exception as exc:
            print(f"⚠️ AI behavior snapshot cache ignored. Reason: {type(exc).__name__}: {str(exc)[:180]}")

    customer_model_table = churn_predictor._build_customer_model_table(raw_df, include_target=False)
    customer_lookup = pd.DataFrame()
    if isinstance(customer_summary_df, pd.DataFrame) and not customer_summary_df.empty and "_customer_key" in customer_summary_df:
        lookup_columns = ["_customer_key"]
        for optional_column in ["customer_name", "customer_ref_id"]:
            if optional_column in customer_summary_df:
                lookup_columns.append(optional_column)
        customer_lookup = (
            customer_summary_df[lookup_columns]
            .drop_duplicates("_customer_key")
            .reset_index(drop=True)
            .copy()
        )
    
    if churn_predictor.is_trained and churn_predictor.model is not None:
        predictions_df = churn_predictor._predict_customer_table_from_table(customer_model_table)
        snapshot_df = customer_model_table.copy()
        snapshot_df["model_churn_probability"] = predictions_df["model_churn_probability"].values
        snapshot_df["model_predicted_churn"] = predictions_df["model_predicted_churn"].values
        snapshot_df["model_risk_level"] = predictions_df["model_risk_level"].values
    else:
        predictions_df = churn_predictor._behavior_risk_predict(raw_df)
        raw_df_copy = raw_df.copy()
        raw_df_copy["_customer_key"] = churn_predictor._customer_keys(raw_df_copy).reset_index(drop=True)
        predictions_df["_customer_key"] = raw_df_copy["_customer_key"].values
        
        prob_map = predictions_df.groupby("_customer_key")["model_churn_probability"].max()
        pred_map = predictions_df.groupby("_customer_key")["model_predicted_churn"].max()
        risk_map = predictions_df.groupby("_customer_key")["model_risk_level"].first()
        
        snapshot_df = customer_model_table.copy()
        snapshot_df["model_churn_probability"] = snapshot_df["customer_name"].map(prob_map).fillna(0.0)
        snapshot_df["model_predicted_churn"] = snapshot_df["customer_name"].map(pred_map).fillna(0).astype(int)
        snapshot_df["model_risk_level"] = snapshot_df["customer_name"].map(risk_map).fillna("LOW")

    snapshot_df["_customer_key"] = snapshot_df["customer_name"].astype(str)
    if not customer_lookup.empty:
        snapshot_df = snapshot_df.merge(
            customer_lookup.rename(columns={
                "customer_name": "customer_display_name",
                "customer_ref_id": "customer_summary_ref_id",
            }),
            on="_customer_key",
            how="left",
        )
        if "customer_display_name" in snapshot_df:
            snapshot_df["customer_display_name"] = snapshot_df["customer_display_name"].fillna(snapshot_df["customer_name"])
        if "customer_summary_ref_id" in snapshot_df:
            if "customer_ref_id" in snapshot_df:
                snapshot_df["customer_ref_id"] = snapshot_df["customer_summary_ref_id"].combine_first(snapshot_df["customer_ref_id"])
            else:
                snapshot_df["customer_ref_id"] = snapshot_df["customer_summary_ref_id"]
            snapshot_df = snapshot_df.drop(columns=["customer_summary_ref_id"])
    if "customer_display_name" not in snapshot_df:
        snapshot_df["customer_display_name"] = snapshot_df["customer_name"]
    if "customer_ref_id" not in snapshot_df:
        snapshot_df["customer_ref_id"] = range(1, len(snapshot_df) + 1)
    snapshot_df["model_churn_probability"] = pd.to_numeric(snapshot_df["model_churn_probability"], errors="coerce").fillna(0.0)
    snapshot_df["model_predicted_churn"] = pd.to_numeric(snapshot_df["model_predicted_churn"], errors="coerce").fillna(0).astype(int)
    snapshot_df["risk_score_percent"] = (snapshot_df["model_churn_probability"] * 100).round(1)
    snapshot_df, risk_zone_cutoffs = _assign_score_band_risk_zones(
        snapshot_df,
        selected_threshold=getattr(churn_predictor, "selected_threshold", 0.5),
    )
    snapshot_df["ai_churn_estimate"] = snapshot_df["risk_score_percent"]
    snapshot_df["ai_risk_zone"] = snapshot_df["risk_zone"]
    snapshot_df["ai_recommended_action"] = snapshot_df["ai_risk_zone"].apply(_ai_recommended_action)
    snapshot_df["recency_bucket"] = snapshot_df["days_since_last_purchase"].apply(_recency_bucket)
    snapshot_df = _add_aov_band(snapshot_df)

    allowed_columns = [
        "_customer_key",
        "customer_name",
        "customer_display_name",
        "customer_ref_id",
        "total_orders",
        "total_revenue",
        "avg_order_value",
        "purchase_frequency",
        "days_since_last_purchase",
        "total_returns",
        "return_rate",
        "rfm_score",
        "monetary_score",
        "frequency_score",
        "recency_score",
        "revenue_trend_ratio",
        "order_trend_ratio",
        "dominant_category_share",
        "dominant_payment_share",
        "primary_product_category",
        "primary_payment_method",
        "model_churn_probability",
        "model_predicted_churn",
        "model_risk_level",
        "risk_percentile",
        "risk_score_percent",
        "risk_zone",
        "ai_churn_estimate",
        "ai_risk_zone",
        "ai_recommended_action",
        "recency_bucket",
        "aov_band",
    ]
    snapshot_df = snapshot_df[[col for col in allowed_columns if col in snapshot_df.columns]].copy()

    charts = build_ai_behavior_charts_from_snapshot(snapshot_df, feature_importance=churn_predictor.feature_importance)
    validation = _validate_ai_behavior_snapshot(snapshot_df, charts)
    if not validation["valid"]:
        raise APIError(f"AI behavior snapshot validation failed: {validation}", 500)

    metadata = {
        **expected_metadata,
        "generated_at": datetime.now().isoformat(),
        "total_customers": validation["row_count"],
        "unique_customers": validation["unique_customer_count"],
        "risk_zone_method": "absolute_threshold_with_relative_fallback",
        "risk_zone_cutoffs": risk_zone_cutoffs,
        "snapshot_path": str(snapshot_path),
        "charts_path": str(charts_path),
    }
    joblib.dump({"metadata": metadata, "snapshot": snapshot_df}, snapshot_path)
    with open(charts_path, "w") as fh:
        json.dump(_json_safe({"metadata": metadata, "validation": validation, "charts": charts}), fh, indent=2)
    print(f"✅ Saved AI behavior snapshot: {snapshot_path}")
    print(f"✅ Saved AI behavior chart payload: {charts_path}")
    return snapshot_df, charts, metadata, validation, False

def _print_churn_ai_evaluation(dataset_id, predictor, evaluation, label_message, summary, force_retune=False):
    if evaluation:
        is_verbose = (
            os.environ.get("CHURN_VERBOSE_EVAL", "0") == "1"
            or os.environ.get("CHURN_FORCE_RETUNE", "0") == "1"
            or force_retune
            or evaluation.get("evaluation_source") != "Cached"
        )
        
        backend_label = "cuML GPU" if evaluation.get("model_backend") == "cuml_gpu" else "sklearn CPU"

        def pct(value):
            return "N/A" if value is None else f"{float(value) * 100:.2f}%"

        cm = evaluation.get("confusion_matrix") or {}
        
        print("================ CHURN AI MODEL SUMMARY ===================")
        print(f"Dataset: {dataset_id}")
        print("Mode: LABELED")
        print(f"Evaluation Source: {evaluation.get('evaluation_source', 'Fresh')}")
        print(f"Tuning Skipped: {'Yes' if evaluation.get('tuning_skipped') else 'No'}")
        print(f"Configs Evaluated This Run: {int(evaluation.get('configs_evaluated_this_run') or 0):,}")
        print(f"Model Version: {evaluation.get('model_version', 'customer_rf_v3_rfm_threshold_cache')}")
        print("")
        print("Business KPI Source:")
        print("AI model predictions aggregated by robust customer key")
        print("")
        print("Business KPIs:")
        print(f"Transactions: {summary['total_transactions']:,}")
        print(f"Customers: {summary['total_customers']:,}")
        print(f"Safe Customers: {summary['safe_customers']:,}")
        print(f"At-Risk Customers: {summary['at_risk_customers']:,}")
        print(f"Churn Risk: {summary['churn_risk_percentage']:.2f}%")
        if summary.get("model_agreement_rate") is not None:
            print(f"Model Agreement Rate: {float(summary['model_agreement_rate']):.2f}%")
            print(f"Historical Safe Customers: {int(summary.get('historical_safe_customers') or 0):,}")
            print(f"Historical At-Risk Customers: {int(summary.get('historical_at_risk_customers') or 0):,}")
        print("")
        print("AI Model:")
        print("Level: Customer-level")
        print("Model: Random Forest Classifier")
        if evaluation.get("model_backend") == "cuml_gpu":
            print("Evaluation Backend: cuML GPU")
            print("GPU Used: Yes")
        else:
            print("Evaluation Backend: sklearn CPU")
            print("Reason: sklearn supports class weights, feature importance, and controlled validation tuning.")
            print("GPU Status: Available for compatible RAPIDS operations; not used for sklearn cached evaluation.")
            print("CPU Fallback: No, sklearn CPU was intentionally used for validation/tuning.")
        
        if is_verbose:
            print("")
            print("--- VERBOSE EVALUATION DETAILS ---")
            print(f"Tuning Backend: {evaluation.get('tuning_backend', 'sklearn_cpu').replace('_', ' ')}")
            print(f"GPU Attempted: {'Yes' if evaluation.get('gpu_attempted') else 'No'}")
            print(f"Fallback Used: {'Yes' if evaluation.get('fallback_used') else 'No'}")
            print("")
            print("Target:")
            print("actual_churn = max(Churn) per robust customer key")
            print("")
            print("Split:")
            print(f"Train Customers: {int(evaluation.get('train_size') or 0):,}")
            print(f"Validation Customers: {int(evaluation.get('validation_size') or 0):,}")
            print(f"Test Customers: {int(evaluation.get('test_size') or 0):,}")
            print(f"Train Positive Rate: {pct(evaluation.get('train_positive_rate'))}")
            print(f"Validation Positive Rate: {pct(evaluation.get('validation_positive_rate'))}")
            print(f"Test Positive Rate: {pct(evaluation.get('test_positive_rate'))}")
            print("")
            print("Baseline:")
            print(f"All-Safe Accuracy: {pct(evaluation.get('all_safe_accuracy'))}")
            print(f"All-Safe F1: {pct(evaluation.get('all_safe_f1_score'))}")
            print(f"All-Safe Balanced Accuracy: {pct(evaluation.get('all_safe_balanced_accuracy'))}")
            print(f"All-At-Risk Accuracy: {pct(evaluation.get('all_at_risk_accuracy'))}")
            print(f"All-At-Risk F1: {pct(evaluation.get('all_at_risk_f1_score'))}")
            print(f"All-At-Risk Balanced Accuracy: {pct(evaluation.get('all_at_risk_balanced_accuracy'))}")
            print("Model is useful only if it improves beyond majority-class baseline on balanced metrics.")
            print("")
            print("Selected Model Config:")
            print(evaluation.get("selected_model_config"))
            print(f"Model Configs Evaluated: {int(evaluation.get('model_configs_evaluated') or 0):,}")
            print("")
            print(f"Selected Threshold: {float(evaluation.get('selected_threshold') or 0):.4f}")
            print(f"Threshold Selection Method: {evaluation.get('threshold_selection_method')}")
            print(f"Threshold Guardrails Applied: {'Yes' if evaluation.get('threshold_guardrails_applied') else 'No'}")
            print(f"Rejected Threshold Count: {int(evaluation.get('rejected_threshold_count') or 0):,}")
            print(f"Selected Threshold Reason: {evaluation.get('selected_threshold_reason')}")
            print(f"Validation Actual Positive Rate: {pct(evaluation.get('validation_actual_positive_rate'))}")
            print(f"Validation Predicted Positive Rate: {pct(evaluation.get('validation_predicted_positive_rate'))}")
            print(f"Predicted Positive Rate: {pct(evaluation.get('predicted_positive_rate'))}")

        print("")
        metric_title = "Cached Test Metrics:" if evaluation.get("evaluation_source") == "Cached" else "Test Metrics:"
        print(metric_title)
        print(f"Accuracy: {pct(evaluation.get('accuracy'))}")
        print(f"Precision: {pct(evaluation.get('precision'))}")
        print(f"Recall: {pct(evaluation.get('recall'))}")
        print(f"F1 Score: {pct(evaluation.get('f1_score'))}")
        print(f"Specificity: {pct(evaluation.get('specificity'))}")
        print(f"Balanced Accuracy: {pct(evaluation.get('balanced_accuracy'))}")
        print(f"ROC-AUC: {pct(evaluation.get('roc_auc')) if evaluation.get('roc_auc') is not None else 'N/A'}")
        print(f"PR-AUC: {pct(evaluation.get('pr_auc')) if evaluation.get('pr_auc') is not None else 'N/A'}")
        print("")
        print("Confusion Matrix:")
        print(f"TP: {cm.get('true_positive', 0):,} | FP: {cm.get('false_positive', 0):,} | TN: {cm.get('true_negative', 0):,} | FN: {cm.get('false_negative', 0):,}")
        print("")
        
        print("Top AI Churn Signals:")
        for idx, item in enumerate((evaluation.get("top_feature_importances") or [])[:5], start=1):
            print(f"{idx}. {item.get('feature')}: {float(item.get('importance') or 0):.6f}")
        print("")
        
        if is_verbose:
            print(f"Features Used: {evaluation.get('input_feature_count', 0)}")
            for feature in evaluation.get("semantic_features_used") or evaluation.get("features_used") or []:
                print(f"- {feature}")
            print("")
            print("Prediction Counts:")
            print(f"Actual Positive: {int(evaluation.get('actual_positive_count') or 0):,}")
            print(f"Predicted Positive: {int(evaluation.get('predicted_positive_count') or 0):,}")
            print(f"Actual Positive Rate: {pct(evaluation.get('actual_positive_rate'))}")
            print(f"Predicted Positive Rate: {pct(evaluation.get('predicted_positive_rate'))}")
            print("")
            diagnostics = evaluation.get("probability_diagnostics") or {}
            overall_q = diagnostics.get("overall_quantiles") or {}
            churn_q = diagnostics.get("churn_quantiles") or {}
            fmt = lambda v: "N/A" if v is None else f"{float(v):.4f}"
            print("Probability Diagnostics:")
            print(f"Mean Probability - Actual Safe: {fmt(diagnostics.get('mean_probability_actual_safe'))}")
            print(f"Mean Probability - Actual Churn: {fmt(diagnostics.get('mean_probability_actual_churn'))}")
            print(f"Overall P50/P75/P90: {fmt(overall_q.get('p50'))} / {fmt(overall_q.get('p75'))} / {fmt(overall_q.get('p90'))}")
            print(f"Churn P50/P75/P90: {fmt(churn_q.get('p50'))} / {fmt(churn_q.get('p75'))} / {fmt(churn_q.get('p90'))}")
            print("")
            print("Warning:")
            if evaluation.get("model_signal_warning"):
                print(evaluation["model_signal_warning"])
            if evaluation.get("degenerate_prediction_warning"):
                print(evaluation["degenerate_prediction_warning"])
            print("")
        else:
            print(f"Features Used: {evaluation.get('input_feature_count', 0)} customer-level behavior/RFM features")
            print("")

        print("Model Note:")
        print(f"Accuracy is {pct(evaluation.get('accuracy'))}, but all-safe baseline is {pct(evaluation.get('all_safe_accuracy'))}. Use recall, F1, balanced accuracy, ROC-AUC, and feature signals to explain model quality honestly.")
        print("")
        print("Important:")
        print("Dashboard KPIs use AI model predictions.")
        print("Historical labels remain visible for comparison when available.")
        print("===========================================================")
        return

    print("================ CHURN AI MODEL STATUS ====================")
    print(f"Dataset: {dataset_id}")
    print("Mode: UNLABELED")
    print("Actual Churn Label: Not found")
    print("Model Evaluation: Not available")
    print("Reason: Accuracy/Precision/Recall/F1 cannot be calculated without ground-truth Churn labels.")
    print("Action: Using saved model inference or behavior-based risk scoring.")
    if label_message:
        print(f"Details: {label_message}")
    print("===========================================================")


@churn_bp.route('/predict', methods=['POST'])
@handle_errors
def predict_churn():
    """Run churn prediction on a specific dataset"""
    data = request.get_json()
    
    if not data or 'dataset_id' not in data:
        raise APIError("dataset_id is required", 400)

    dataset_id = data['dataset_id']
    include_customer_transactions = bool(data.get("include_customer_transactions"))

    # Ensure dataset is tracked (Isolated)
    user_email = data.get('email')
    requester_role = request.headers.get('X-User-Role')
    print(f"[DEBUG] Churn Predict - user_email: {user_email}, requester_role: {requester_role}", flush=True)
    dataset_owner_email = None if requester_role and requester_role.lower() in ['manager', 'system admin'] else user_email
    db.get_dataset_info(dataset_id, dataset_owner_email)

    import time
    t_start = time.perf_counter()

    # Load file
    df = loader.load_csv(dataset_id)
    has_actual_churn_label = 'Churn' in df.columns
    behavior_columns_available = (
        "Customer Name" in df.columns
        and any(col in df.columns for col in ["Total Purchase Amount", "Purchase Date", "Quantity", "Returns", "Product Category", "Payment Method"])
    )
    t_load = time.perf_counter()
    print(f"[CHURN TIMING] load dataset: {t_load - t_start:.4f} sec")

    force_retune = bool(data.get('force_retrain') or data.get('force_retune'))
    dashboard_cache = None
    if not include_customer_transactions:
        dashboard_cache = _load_customer_dashboard_cache(dataset_id, df, has_actual_churn_label, force_retune=force_retune)
    cached_model_metadata = None if force_retune else _load_cached_model_metadata(dataset_id, df)
    predictions_json_path = config.PROCESSED_DATA_DIR / f"{dataset_id}_churn_predictions.json"
    fast_dashboard_response = bool(
        dashboard_cache 
        and cached_model_metadata 
        and predictions_json_path.exists()
        and os.path.getsize(str(predictions_json_path)) > 10
        and not include_customer_transactions
    )

    if fast_dashboard_response:
        ai_model_evaluation = dict(cached_model_metadata.get("ai_model_evaluation") or {})
        ai_model_evaluation["evaluation_source"] = "Cached"
        ai_model_evaluation["tuning_skipped"] = True
        ai_model_evaluation["configs_evaluated_this_run"] = 0
        model_accuracy = ai_model_evaluation.get("accuracy")
        churn_mode = _response_churn_mode(has_actual_churn_label)
        can_evaluate_model = bool(has_actual_churn_label and ai_model_evaluation)
        label_message = ""
        predictions_df = pd.DataFrame()
        merged_df = None
        t_pred = time.perf_counter()
        print(f"[CHURN TIMING] cached dashboard/model metadata: {t_pred - t_load:.4f} sec")
        t_merge = t_pred
        print("[CHURN TIMING] merge predictions: skipped (cached dashboard response)")
    else:
        # Preserve original index for safe merging
        df['_source_index'] = df.index

        # Run prediction
        predictions_df = predictor.predict(df, dataset_id=dataset_id, force_retune=force_retune)
        model_accuracy = predictor.get_accuracy()
        ai_model_evaluation = predictor.get_evaluation()
        churn_mode = predictor.churn_mode
        can_evaluate_model = predictor.can_evaluate_model
        label_message = predictor.label_message
        t_pred = time.perf_counter()
        action = "model tuning/training/evaluation" if force_retune or ai_model_evaluation.get("evaluation_source") != "Cached" else "cached model load/evaluation"
        print(f"[CHURN TIMING] {action}: {t_pred - t_load:.4f} sec")

        # Merge predictions back to original df using source index
        merged_df = df.copy()
        if len(predictions_df) == len(merged_df):
            for col in [
                "actual_churn",
                "model_predicted_churn",
                "model_churn_probability",
                "model_risk_level",
                "churn_probability",
                "churn_prediction",
                "risk_level",
            ]:
                if col in predictions_df.columns:
                    merged_df[col] = predictions_df[col].values
        else:
            merged_df = pd.merge(
                df,
                predictions_df[[
                    '_source_index',
                    'actual_churn',
                    'model_predicted_churn',
                    'model_churn_probability',
                    'model_risk_level',
                    'churn_prediction',
                    'churn_probability',
                    'risk_level'
                ]],
                on='_source_index',
                how='inner'
            )
        if has_actual_churn_label:
            merged_df["actual_churn"] = pd.to_numeric(merged_df["Churn"], errors="coerce").fillna(0).astype(int)
        if "model_churn_probability" not in merged_df and "churn_probability" in merged_df:
            merged_df["model_churn_probability"] = merged_df["churn_probability"]
        if "model_predicted_churn" not in merged_df and "churn_prediction" in merged_df:
            merged_df["model_predicted_churn"] = merged_df["churn_prediction"]
        merged_df["_customer_key"] = predictor._customer_keys(merged_df).reset_index(drop=True)
        t_merge = time.perf_counter()
        print(f"[CHURN TIMING] merge predictions: {t_merge - t_pred:.4f} sec")

    if dashboard_cache:
        customer_summary_df = dashboard_cache["customer_summary_df"]
        summary = dashboard_cache["summary"]
        filter_options = dashboard_cache["filter_options"]
        dataset_date_bounds = dashboard_cache["dataset_date_bounds"]
        chart_data = dashboard_cache.get("chart_data") or {}
    else:
        dashboard_payload = _build_customer_dashboard_payload(
            merged_df=merged_df,
            source_df=df,
            has_actual_churn_label=has_actual_churn_label,
            include_customer_transactions=include_customer_transactions,
        )
        customer_summary_df = dashboard_payload["customer_summary_df"]
        summary = dashboard_payload["summary"]
        filter_options = dashboard_payload["filter_options"]
        dataset_date_bounds = dashboard_payload["dataset_date_bounds"]
        chart_data = dashboard_payload["chart_data"]
        if not include_customer_transactions:
            _save_customer_dashboard_cache(dataset_id, df, has_actual_churn_label, dashboard_payload)

    t_agg = time.perf_counter()
    print(f"[CHURN TIMING] customer aggregation: {t_agg - t_merge:.4f} sec")
    total_transactions = summary["total_transactions"]
    at_risk_customers = summary["at_risk_customers"]
    safe_customers = summary["safe_customers"]

    prediction_id = None
    if dashboard_cache and not force_retune:
        try:
            latest_prediction = db.predictions.find_one(
                {
                    "dataset_id": dataset_id,
                    "prediction_type": "churn",
                    "user_email": user_email,
                },
                {"_id": 1, "file_path": 1},
                sort=[("generated_date", -1)]
            )
            if latest_prediction:
                file_path = latest_prediction.get("file_path")
                if file_path and os.path.exists(file_path) and os.path.getsize(file_path) > 10:
                    prediction_id = str(latest_prediction["_id"])
                    # Update predictions generated_date to now
                    db.predictions.update_one({"_id": latest_prediction["_id"]}, {"$set": {"generated_date": datetime.now()}})
                    # Track report entry and insert into analysis_runs
                    db._save_report(dataset_id, 'churn', user_email=user_email, churn_prediction_id=prediction_id)
                    print(f"✅ Reused and updated cached churn prediction record: {prediction_id}")
                else:
                    print(f"⚠️ Churn prediction file missing or empty on disk: {file_path}. Invalidating cache and re-running.")
        except Exception as exc:
            print(f"⚠️ Cached prediction record lookup failed. Reason: {type(exc).__name__}: {str(exc)[:180]}")

    if not prediction_id:
        # Save to MongoDB (Isolated)
        prediction_id = db.save_churn_predictions(
            dataset_id=dataset_id,
            user_email=user_email,
            predictions=predictions_df,
            accuracy=model_accuracy,
            using_gpu=predictor.using_gpu
        )

    # ── Identify Top 5 Critical Alerts (using customer summary)
    critical_alerts = []
    if has_actual_churn_label and not customer_summary_df.empty:
        critical_alerts = customer_summary_df[customer_summary_df['churn_prediction'] == 1].head(5).to_dict(orient='records')
        
    drivers = (cached_model_metadata or {}).get("feature_importance") or predictor.get_feature_importance()
    top_driver = max(drivers, key=drivers.get) if drivers else "Unknown"

    # For original predictions array (backward compatibility)
    if fast_dashboard_response:
        display_columns = [
            "customer_name",
            "customer_ref_id",
            "churn_probability",
            "churn_prediction",
            "historical_status",
            "model_churn_probability",
            "model_predicted_churn",
            "risk_level",
        ]
        display_df = customer_summary_df[
            [col for col in display_columns if col in customer_summary_df.columns]
        ].head(500).copy()
    elif 'churn_probability' in predictions_df.columns:
        display_df = predictions_df.sort_values(by='churn_probability', ascending=False)
    else:
        display_df = predictions_df

    t_build = time.perf_counter()
    print(f"[CHURN TIMING] response core prep: {t_build - t_agg:.4f} sec")
    
    _print_churn_ai_evaluation(dataset_id, predictor, ai_model_evaluation, label_message, summary, force_retune)

    # --- Generate AI Behavioral Churn Signals from customer-level model snapshot ---
    ai_behavior_snapshot_df, ai_behavior_charts, ai_behavior_metadata, ai_behavior_validation, ai_behavior_cache_hit = build_customer_ai_behavior_snapshot(
        dataset_id=dataset_id,
        raw_df=df,
        customer_summary_df=customer_summary_df,
        churn_predictor=predictor,
        force_retune=force_retune,
    )
    t_ai_snapshot = time.perf_counter()
    print(f"[CHURN TIMING] AI behavior snapshot/cache: {t_ai_snapshot - t_build:.4f} sec")
    risk_zone_counts = ai_behavior_snapshot_df.get("risk_zone", pd.Series(dtype=str)).apply(_risk_zone_label).value_counts().to_dict()
    risk_zone_options = [
        zone for zone in RISK_ZONE_ORDER
        if risk_zone_counts.get(zone, 0) > 0
    ]
    ai_filter_options = {
        "risk_zones": risk_zone_options,
        "categories": sorted(ai_behavior_snapshot_df.get("primary_product_category", pd.Series(dtype=str)).dropna().astype(str).unique().tolist()),
        "payment_methods": sorted(ai_behavior_snapshot_df.get("primary_payment_method", pd.Series(dtype=str)).dropna().astype(str).unique().tolist()),
        "recency_buckets": ["0-30 days", "31-60 days", "61-90 days", "91-180 days", "180+ days"],
        "aov_bands": ["Low AOV", "Mid AOV", "High AOV", "Premium AOV"],
    }
    can_show_ai_risk = bool(
        behavior_columns_available
        and ai_behavior_validation.get("valid")
        and not ai_behavior_snapshot_df.empty
        and {"_customer_key", "ai_churn_estimate", "ai_risk_zone", "ai_recommended_action"}.issubset(set(ai_behavior_snapshot_df.columns))
    )
    if can_show_ai_risk:
        customer_summary_df = customer_summary_df.reset_index(drop=True)
        ai_customer_fields = ai_behavior_snapshot_df[["_customer_key", "ai_churn_estimate", "ai_risk_zone", "ai_recommended_action"]].copy()
        ai_customer_fields = ai_customer_fields.reset_index(drop=True)
        ai_customer_fields["ai_churn_estimate"] = pd.to_numeric(ai_customer_fields["ai_churn_estimate"], errors="coerce").round(1)
        ai_customer_fields["ai_risk_zone"] = ai_customer_fields["ai_risk_zone"].apply(_risk_zone_label)
        ai_customer_fields["ai_recommended_action"] = ai_customer_fields["ai_risk_zone"].apply(_ai_recommended_action)
        customer_summary_df = customer_summary_df.merge(
            ai_customer_fields,
            on="_customer_key",
            how="left",
        )
    else:
        customer_summary_df["ai_churn_estimate"] = None
        customer_summary_df["ai_risk_zone"] = None
        customer_summary_df["ai_recommended_action"] = None

    # Historical chart data is built with the dashboard payload and cached for repeat loads.
    ai_snapshot_response_columns = [
        "_customer_key",
        "customer_name",
        "customer_display_name",
        "customer_ref_id",
        "risk_zone",
        "risk_score_percent",
        "primary_product_category",
        "primary_payment_method",
        "recency_bucket",
        "aov_band",
        "model_churn_probability",
        "total_revenue",
    ]
    ai_behavior_snapshot_payload = ai_behavior_snapshot_df[
        [col for col in ai_snapshot_response_columns if col in ai_behavior_snapshot_df.columns]
    ].copy()

    ai_churn_analysis = {
        "summary": None,
        "source": "saved_customer_level_ai_behavior_snapshot",
        "metadata": ai_behavior_metadata,
        "validation": ai_behavior_validation,
        "cache_hit": ai_behavior_cache_hit,
        "filter_options": ai_filter_options,
        "ai_behavior_snapshot": ai_behavior_snapshot_payload.replace({np.nan: None}).to_dict(orient="records"),
        "insight": "AI scoring patterns are generated from one model-analyzed behavior profile per unique customer.",
        **ai_behavior_charts,
    }
    ai_churn_analysis = _json_safe(ai_churn_analysis)
    customer_summary_response_columns = [
        "customer_name",
        "customer_ref_id",
        "orders",
        "revenue",
        "aov",
        "last_order",
        "historical_status",
        "ai_churn_estimate",
        "ai_risk_zone",
        "ai_recommended_action",
        "categories",
        "payment_methods",
        "returns",
        "age",
        "gender",
    ]
    if include_customer_transactions and "transactions" in customer_summary_df.columns:
        customer_summary_response_columns.append("transactions")
    customer_summary_response_df = customer_summary_df[
        [col for col in customer_summary_response_columns if col in customer_summary_df.columns]
    ].copy()
    customer_summary_payload = _json_safe(customer_summary_response_df.replace({np.nan: None}).to_dict(orient='records'))
    customer_summary_preview_payload = customer_summary_payload[:1000] if customer_summary_payload else []
    response_churn_mode = _response_churn_mode(has_actual_churn_label)
    predictions_has_more = len(customer_summary_df) > 500 if fast_dashboard_response else len(predictions_df) > 500
    response_model_backend = (cached_model_metadata or {}).get("model_backend") or predictor.model_backend
    response_using_gpu = response_model_backend == "cuml_gpu"
    t_payload = time.perf_counter()
    print(f"[CHURN TIMING] response payload prep: {t_payload - t_ai_snapshot:.4f} sec")
    print(f"[CHURN TIMING] total route time: {t_payload - t_start:.4f} sec")

    return jsonify({
        'success': True,
        'prediction_id': prediction_id,
        'dataset_id': dataset_id,
        'user_email': user_email,
        'summary': summary,
        'chart_data': chart_data,
        'ai_churn_analysis': ai_churn_analysis,
        'customer_summary': customer_summary_payload,
        'customer_summary_preview': customer_summary_preview_payload,
        'dataset_bounds': dataset_date_bounds,
        'filter_options': filter_options,
        'churn_mode': response_churn_mode,
        'has_actual_churn_label': bool(has_actual_churn_label),
        'can_show_historical_status': bool(has_actual_churn_label),
        'can_show_ai_risk': bool(can_show_ai_risk),
        'can_evaluate_model': bool(can_evaluate_model),
        'ai_model_evaluation': ai_model_evaluation,
        'label_message': label_message,
        
        # Backward compatible fields
        'total_customers': total_transactions,  # Keeping original behavior for old UI
        'at_risk_customers': at_risk_customers,
        'safe_customers': safe_customers,
        'model_accuracy': float(model_accuracy) if model_accuracy is not None else None,
        'using_gpu': response_using_gpu,
        'gpu_attempted': predictor.gpu_attempted,
        'gpu_used': response_using_gpu,
        'model_backend': response_model_backend,
        'fallback_used': predictor.fallback_used,
        'feature_importance': drivers,
        'top_risk_driver': top_driver,
        'critical_alerts': critical_alerts,
        'predictions': display_df.head(500).to_dict(orient='records'),
        'has_more': predictions_has_more,
        'timestamp': pd.Timestamp.now().isoformat()
    }), 200


@churn_bp.route('/history/<dataset_id>', methods=['GET'])
@handle_errors
def get_churn_history(dataset_id):
    """Retrieve saved churn predictions (Isolated by user_email)"""
    user_email = request.args.get('email')
    saved = db.get_churn_predictions(dataset_id, user_email)
    return jsonify({
        'success': True,
        'data': saved
    }), 200


@churn_bp.route('/stats', methods=['GET'])
@handle_errors
def get_churn_stats():
    """Get ML model statistics"""
    return jsonify({
        'success': True,
        'model_type': 'Random Forest Classifier',
        'is_trained': predictor.is_trained,
        'last_trained': predictor.last_trained_date
    }), 200
