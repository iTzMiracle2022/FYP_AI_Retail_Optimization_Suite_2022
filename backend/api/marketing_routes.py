from flask import Blueprint, request, jsonify
import pandas as pd
import time
from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.error_handlers import handle_errors, APIError
from models.marketing_analyzer import MarketingAnalyzer
from utils.marketing_cache import build_cache_key, get as cache_get, put as cache_put
from utils.marketing_k_selection import recommend_marketing_k
from utils.marketing_nlp_intelligence import analyze_feedback_intelligence, print_nlp_console_summary
from config import config

marketing_bp = Blueprint('marketing', __name__, url_prefix='/api/marketing')
analyzer = MarketingAnalyzer()
loader = DataLoader()

PRODUCT_SPEND_COLUMNS = {
    'MntWines': 'wines',
    'MntFruits': 'fruits',
    'MntMeatProducts': 'meat',
    'MntFishProducts': 'fish',
    'MntSweetProducts': 'sweets',
    'MntGoldProds': 'gold',
}

CHANNEL_PURCHASE_COLUMNS = {
    'NumWebPurchases': 'web_purchases',
    'NumCatalogPurchases': 'catalog_purchases',
    'NumStorePurchases': 'store_purchases',
    'NumDealsPurchases': 'deal_purchases',
}


def _to_number(value):
    if value is None or pd.isna(value):
        return None
    return float(value)


def _series_mean(frame, column):
    if column not in frame.columns:
        return None
    numeric = pd.to_numeric(frame[column], errors='coerce')
    if numeric.dropna().empty:
        return None
    return float(numeric.mean())


def _series_sum(frame, column):
    if column not in frame.columns:
        return None
    numeric = pd.to_numeric(frame[column], errors='coerce')
    if numeric.dropna().empty:
        return None
    return float(numeric.sum())


def _segment_sentiment_metrics(group):
    nlp_score = _series_mean(group, 'nlp_sentiment_score')
    if nlp_score is not None:
        return {
            'sentiment_score': nlp_score,
            'avg_sentiment': (nlp_score / 50.0) - 1.0,
            'sentiment_source': 'nlp_feedback',
        }

    avg_sentiment = _series_mean(group, 'sentiment')
    return {
        'sentiment_score': ((avg_sentiment + 1) / 2) * 100 if avg_sentiment is not None else None,
        'avg_sentiment': avg_sentiment,
        'sentiment_source': 'legacy_feedback',
    }


def _preserve_reporting_columns(clusters, source_df):
    """Attach raw reporting fields for aggregate display without changing model inputs."""
    if 'ID' not in source_df.columns or 'customer_id' not in clusters.columns:
        return clusters

    enriched = clusters.copy()
    source_columns = ['ID']
    rename_map = {'ID': 'customer_id'}

    if 'response' not in enriched.columns and 'Response' in source_df.columns:
        source_columns.append('Response')
        rename_map['Response'] = 'response'

    for col in [*PRODUCT_SPEND_COLUMNS.keys(), *CHANNEL_PURCHASE_COLUMNS.keys()]:
        if col in source_df.columns and col not in enriched.columns:
            source_columns.append(col)

    if len(source_columns) == 1:
        return enriched

    reporting_lookup = source_df[source_columns].rename(columns=rename_map)
    return enriched.merge(reporting_lookup, on='customer_id', how='left')


def _build_segment_profiles(clusters, segment_field):
    total_rows = len(clusters)
    response_col = 'response' if 'response' in clusters.columns else 'Response' if 'Response' in clusters.columns else None
    profiles = []

    for segment_name, group in clusters.groupby(segment_field, dropna=False):
        customer_count = int(len(group))
        sentiment_metrics = _segment_sentiment_metrics(group)
        response_rate = None
        if response_col:
            response_avg = _series_mean(group, response_col)
            response_rate = response_avg * 100 if response_avg is not None else None

        segment_family = None
        if 'segment_family' in group.columns and not group['segment_family'].dropna().empty:
            segment_family = str(group['segment_family'].dropna().mode().iloc[0])

        profiles.append({
            'segment_display_name': str(segment_name),
            'segment_family': segment_family,
            'customer_count': customer_count,
            'share_pct': (customer_count / total_rows * 100) if total_rows else None,
            'avg_spend': _series_mean(group, 'total_spend'),
            'total_spend': _to_number(pd.to_numeric(group.get('total_spend'), errors='coerce').sum()) if 'total_spend' in group.columns else None,
            'avg_purchases': _series_mean(group, 'total_purchases'),
            'avg_recency': _series_mean(group, 'recency'),
            'sentiment_score': sentiment_metrics['sentiment_score'],
            'avg_sentiment': sentiment_metrics['avg_sentiment'],
            'sentiment_source': sentiment_metrics['sentiment_source'],
            'response_rate': response_rate,
            'avg_income': _series_mean(group, 'income'),
            'avg_age': _series_mean(group, 'age')
        })

    return sorted(profiles, key=lambda p: p['customer_count'], reverse=True)


def _quantile(values, q):
    valid = [float(v) for v in values if v is not None and not pd.isna(v)]
    if not valid:
        return None
    return float(pd.Series(valid).quantile(q))


def _build_segment_recommendations(segment_profiles):
    spend_values = [p.get('avg_spend') for p in segment_profiles]
    recency_values = [p.get('avg_recency') for p in segment_profiles]
    sentiment_values = [p.get('sentiment_score') for p in segment_profiles]
    response_values = [p.get('response_rate') for p in segment_profiles]

    high_spend = _quantile(spend_values, 0.75)
    low_spend = _quantile(spend_values, 0.25)
    low_recency = _quantile(recency_values, 0.25)
    high_recency = _quantile(recency_values, 0.75)
    low_sentiment = _quantile(sentiment_values, 0.25)
    high_response = _quantile(response_values, 0.75)

    recommendations = []
    for profile in segment_profiles:
        avg_spend = profile.get('avg_spend')
        avg_recency = profile.get('avg_recency')
        sentiment_score = profile.get('sentiment_score')
        response_rate = profile.get('response_rate')

        category = 'Engagement'
        action = 'Use personalized product recommendations to increase engagement.'
        rationale = 'Default action for segments without a stronger spend, recency, sentiment, or response signal.'

        if (
            high_spend is not None and low_recency is not None and
            avg_spend is not None and avg_recency is not None and sentiment_score is not None and
            avg_spend >= high_spend and avg_recency <= low_recency and sentiment_score >= 50
        ):
            category = 'Retention'
            action = 'Retain with loyalty rewards and exclusive offers.'
            rationale = 'High average spend, recent activity, and medium or stronger audience sentiment.'
        elif (
            high_spend is not None and high_recency is not None and
            avg_spend is not None and avg_recency is not None and
            avg_spend >= high_spend and avg_recency >= high_recency
        ):
            category = 'Win-back'
            action = 'Launch a personalized win-back offer for high-value customers.'
            rationale = 'High average spend paired with elevated recency risk.'
        elif (
            low_sentiment is not None and sentiment_score is not None and
            sentiment_score <= low_sentiment
        ):
            category = 'Experience recovery'
            action = 'Improve customer experience before sending promotional offers.'
            rationale = 'Audience sentiment is low compared with the other segments.'
        elif (
            high_response is not None and response_rate is not None and
            high_response > 0 and response_rate >= high_response
        ):
            category = 'Campaign targeting'
            action = 'Prioritize this segment for campaign offers.'
            rationale = 'Campaign response rate is high compared with the other segments.'
        elif (
            low_spend is not None and high_recency is not None and
            avg_spend is not None and avg_recency is not None and
            avg_spend <= low_spend and avg_recency >= high_recency
        ):
            category = 'Reactivation'
            action = 'Use a low-cost reactivation campaign before increasing spend.'
            rationale = 'Low average spend paired with elevated recency risk.'

        recommendations.append({
            'segment_display_name': profile.get('segment_display_name'),
            'action_category': category,
            'recommended_action': action,
            'rationale': rationale
        })

    return recommendations


def _build_segment_aggregates(clusters, segment_field):
    response_col = 'response' if 'response' in clusters.columns else 'Response' if 'Response' in clusters.columns else None
    spend_by_segment = []
    campaign_response_by_segment = []
    recency_by_segment = []
    sentiment_by_segment = []
    product_spend_by_segment = []
    channel_mix_by_segment = []

    for segment_name, group in clusters.groupby(segment_field, dropna=False):
        segment_display_name = str(segment_name)
        customer_count = int(len(group))
        sentiment_metrics = _segment_sentiment_metrics(group)

        spend_by_segment.append({
            'segment_display_name': segment_display_name,
            'total_spend': _series_sum(group, 'total_spend'),
            'avg_spend': _series_mean(group, 'total_spend'),
            'customer_count': customer_count,
        })

        response_rate = None
        responded_customers = None
        if response_col:
            response_sum = _series_sum(group, response_col)
            response_avg = _series_mean(group, response_col)
            responded_customers = int(response_sum) if response_sum is not None else None
            response_rate = response_avg * 100 if response_avg is not None else None

        campaign_response_by_segment.append({
            'segment_display_name': segment_display_name,
            'response_rate': response_rate,
            'responded_customers': responded_customers,
            'customer_count': customer_count,
        })

        recency_by_segment.append({
            'segment_display_name': segment_display_name,
            'avg_recency': _series_mean(group, 'recency'),
            'customer_count': customer_count,
        })

        sentiment_by_segment.append({
            'segment_display_name': segment_display_name,
            'sentiment_score': sentiment_metrics['sentiment_score'],
            'avg_sentiment': sentiment_metrics['avg_sentiment'],
            'sentiment_source': sentiment_metrics['sentiment_source'],
            'customer_count': customer_count,
        })

        product_row = {'segment_display_name': segment_display_name}
        for raw_col, output_col in PRODUCT_SPEND_COLUMNS.items():
            product_row[output_col] = _series_sum(group, raw_col)
        product_spend_by_segment.append(product_row)

        channel_row = {'segment_display_name': segment_display_name}
        for raw_col, output_col in CHANNEL_PURCHASE_COLUMNS.items():
            channel_row[output_col] = _series_sum(group, raw_col)
        channel_mix_by_segment.append(channel_row)

    sort_key = lambda item: item.get('customer_count', 0) if 'customer_count' in item else 0
    return {
        'spend_by_segment': sorted(spend_by_segment, key=sort_key, reverse=True),
        'campaign_response_by_segment': sorted(campaign_response_by_segment, key=sort_key, reverse=True),
        'recency_by_segment': sorted(recency_by_segment, key=sort_key, reverse=True),
        'sentiment_by_segment': sorted(sentiment_by_segment, key=sort_key, reverse=True),
        'product_spend_by_segment': product_spend_by_segment,
        'channel_mix_by_segment': channel_mix_by_segment,
    }


def _resolve_dataset_path(dataset_id: str):
    """Return the Path of the dataset file, or None if not found."""
    clean_id = dataset_id.replace('.csv', '').replace('.xlsx', '').replace('.xls', '')
    for ext in ['.csv', '.xlsx', '.xls']:
        for folder in [config.RAW_DATA_DIR, config.PROCESSED_DATA_DIR]:
            p = folder / f"{clean_id}{ext}"
            if p.exists():
                return p
    return None


def _parse_cluster_request(data: dict) -> tuple[str, int | str, int | None]:
    raw_mode = str(data.get('cluster_mode', '')).strip().lower()
    raw_clusters = data.get('n_clusters', data.get('num_clusters', 4))
    auto_requested = (
        raw_mode == 'auto'
        or str(raw_clusters).strip().lower() == 'auto'
        or data.get('auto_k') is True
    )

    if auto_requested:
        return 'auto', 'auto', None

    try:
        n_clusters = int(raw_clusters)
    except (TypeError, ValueError):
        raise APIError("n_clusters must be an integer between 2 and 8, or use cluster_mode='auto'.", 400)

    if n_clusters < 2 or n_clusters > 8:
        raise APIError("n_clusters must be between 2 and 8.", 400)

    return 'manual', n_clusters, n_clusters


def _fmt_log_value(value, digits=4):
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def _print_auto_k_console_summary(result: dict | None, *, cache_status: str, print_candidates: bool = False):
    if not result or result.get("cluster_mode") != "auto":
        return

    k_selection = result.get("k_selection") or {}
    candidate_scores = k_selection.get("candidate_scores") or []
    selected_k = result.get("selected_k", result.get("n_clusters"))
    selected_candidate = next((candidate for candidate in candidate_scores if candidate.get("k") == selected_k), {})
    gpu_used = "Yes" if result.get("gpu_used") or result.get("using_gpu") else "No"

    print("================ MARKETING AUTO-K SUMMARY ================")
    print(f"Dataset: {result.get('dataset_id', 'unknown')}")
    print("Cluster Mode: AUTO")
    print(f"Cache Status: {cache_status}")
    print(f"Selected K: {selected_k}")
    print(f"Segment Count: {result.get('n_clusters', selected_k)}")
    print(f"Customers Clustered: {int(result.get('total_customers') or 0):,}")
    print(f"GPU Used: {gpu_used}")
    print(f"K-Means Feature Space: {result.get('cluster_feature_columns', ['Total_Spend', 'Total_Purchases', 'Recency', 'Income', 'Response'])}")
    print(f"Final Silhouette: {_fmt_log_value(result.get('silhouette_score'))}")
    print(f"Best Candidate Validation: {_fmt_log_value(selected_candidate.get('validation_score'))}")
    print(f"Business Usability: {_fmt_log_value(selected_candidate.get('business_usability_score'), digits=2)}")
    print(f"Davies-Bouldin: {_fmt_log_value(selected_candidate.get('davies_bouldin_score'))}")
    print(f"Calinski-Harabasz: {_fmt_log_value(selected_candidate.get('calinski_harabasz_score'))}")
    print(f"Reason: {k_selection.get('reason', 'Auto-K selected the best practical segmentation balance.')}")
    print("==========================================================")

    if print_candidates and candidate_scores:
        print("Auto-K Candidates:")
        for candidate in candidate_scores:
            selected_marker = " | SELECTED" if candidate.get("k") == selected_k else ""
            print(
                f"K={candidate.get('k')} | "
                f"Silhouette={_fmt_log_value(candidate.get('silhouette_score'))} | "
                f"DB={_fmt_log_value(candidate.get('davies_bouldin_score'))} | "
                f"Validation={_fmt_log_value(candidate.get('validation_score'))} | "
                f"Balance={candidate.get('balance_status', 'N/A')}"
                f"{selected_marker}"
            )


def _print_kmeans_console_summary(result: dict | None, *, cache_status: str):
    if not result or result.get("cluster_mode") == "auto":
        return

    gpu_used = "Yes" if result.get("gpu_used") or result.get("using_gpu") else "No"
    print("================ MARKETING K-MEANS SUMMARY ================")
    print(f"Dataset: {result.get('dataset_id', 'unknown')}")
    print("Cluster Mode: MANUAL")
    print(f"Cache Status: {cache_status}")
    print(f"Requested K: {result.get('requested_clusters', result.get('n_clusters'))}")
    print(f"Segment Count: {result.get('n_clusters')}")
    print(f"Customers Clustered: {int(result.get('total_customers') or 0):,}")
    print(f"GPU Used: {gpu_used}")
    print(f"K-Means Feature Space: {result.get('cluster_feature_columns', ['Total_Spend', 'Total_Purchases', 'Recency', 'Income', 'Response'])}")
    print(f"Final Silhouette: {_fmt_log_value(result.get('silhouette_score'))}")
    print("Reason: Manual customer segment count was used for this run.")
    print("==========================================================")


@marketing_bp.route('/analyze', methods=['POST'])
@handle_errors
def analyze_customers():
    """Segment customers using ML Clustering — with two-layer response cache."""
    t_request = time.perf_counter()

    data = request.get_json()

    if not data or 'dataset_id' not in data:
        raise APIError("dataset_id is required", 400)

    dataset_id = data['dataset_id']
    cluster_mode, requested_clusters, n_clusters = _parse_cluster_request(data)
    force_refresh = data.get('force_refresh') is True

    # ── Auth / ownership check (unchanged) ──
    user_email = data.get('email')
    requester_role = request.headers.get('X-User-Role')
    dataset_owner_email = None if requester_role and requester_role.lower() in ['manager', 'system admin'] else user_email
    db.get_dataset_info(dataset_id, dataset_owner_email)

    # ── Build cache key ──
    dataset_path = _resolve_dataset_path(dataset_id)
    cache_key = build_cache_key(
        dataset_path,
        n_clusters,
        cluster_mode=cluster_mode,
        candidate_range=(2, 8),
    ) if dataset_path else None

    # ── Cache lookup ──
    if force_refresh and cache_key:
        print({
            "module": "marketing",
            "cache": "BYPASS / FORCE_REFRESH",
            "cache_key": cache_key,
            "cluster_mode": cluster_mode,
        })

    if cache_key and not force_refresh:
        cached = cache_get(cache_key)
        if cached is not None:
            t_hit = time.perf_counter()
            k_selection = cached.get("k_selection") or {}
            print({
                "module": "marketing",
                "cache": "HIT",
                "cache_key": cache_key,
                "cluster_mode": cached.get("cluster_mode", cluster_mode),
                "selected_k": cached.get("selected_k", cached.get("n_clusters")),
                "silhouette_score": cached.get("silhouette_score"),
                "quality_label": k_selection.get("quality_label"),
                "reason": k_selection.get("reason"),
                "total_ms": round((t_hit - t_request) * 1000, 1),
            })
            _print_auto_k_console_summary(cached, cache_status="HIT", print_candidates=bool(k_selection.get("candidate_scores")))
            _print_kmeans_console_summary(cached, cache_status="HIT")
            print_nlp_console_summary(cached.get("nlp_insights"), dataset_id=cached.get("dataset_id", dataset_id), cache_status="HIT")
            return jsonify(cached), 200

    # ─────────────────────────────────────────────────────────────
    # CACHE MISS — run the full pipeline (timing instrumented)
    # ─────────────────────────────────────────────────────────────
    t0 = time.perf_counter()

    # 1. Load dataset
    df = loader.load_csv(dataset_id)
    t_load = time.perf_counter()

    # 2. Run clustering (Auto-K evaluates candidates, then final segmentation runs once)
    k_selection = None
    prepared = None
    if cluster_mode == 'auto':
        prepared = analyzer.prepare_feature_matrix(df, dataset_id=dataset_id)
        k_selection = recommend_marketing_k(
            prepared['X_df'],
            min_k=2,
            max_k=8,
            business_min_k=3,
            business_max_k=6,
        )
        n_clusters = int(k_selection['selected_k'])
    else:
        k_selection = {
            'selected_k': n_clusters,
            'manual_override': True,
            'selection_method': 'manual_override',
            'reason': f'User selected {n_clusters} groups manually. Use Auto to compare candidate group counts.',
            'candidate_scores': []
        }

    clusters = analyzer.segment_customers(df, n_clusters=n_clusters, dataset_id=dataset_id, prepared=prepared)
    clusters = _preserve_reporting_columns(clusters, df)
    t_kmeans = time.perf_counter()

    clusters, nlp_insights = analyze_feedback_intelligence(
        df,
        clusters,
        dataset_id=dataset_id,
        force_refresh=force_refresh,
    )
    t_nlp = time.perf_counter()

    # 3. Save to MongoDB (unchanged behaviour)
    db.save_marketing_analysis(
        dataset_id,
        clusters,
        n_clusters,
        analyzer.silhouette,
        user_email=user_email,
        using_gpu=analyzer.using_gpu
    )

    # 4. Build response fields
    segment_field = 'segment_display_name' if 'segment_display_name' in clusters.columns else 'segment_name'
    sentiment_source_col = 'nlp_sentiment_score' if 'nlp_sentiment_score' in clusters.columns else 'sentiment'
    segment_sentiments = clusters.groupby(segment_field)[sentiment_source_col].mean().to_dict() if sentiment_source_col in clusters.columns else {}
    segment_distribution = clusters[segment_field].value_counts().to_dict()
    segment_family_distribution = clusters['segment_family'].value_counts().to_dict() if 'segment_family' in clusters.columns else {}
    segment_profiles = _build_segment_profiles(clusters, segment_field)
    segment_recommendations = _build_segment_recommendations(segment_profiles)
    segment_aggregates = _build_segment_aggregates(clusters, segment_field)

    total_customer_spend = _to_number(pd.to_numeric(clusters.get('total_spend'), errors='coerce').sum()) if 'total_spend' in clusters.columns else None
    avg_spend_per_customer = (total_customer_spend / len(clusters)) if total_customer_spend is not None and len(clusters) else None
    response_col = 'response' if 'response' in clusters.columns else 'Response' if 'Response' in clusters.columns else None
    response_mean = _series_mean(clusters, response_col) if response_col else None
    campaign_response_rate = response_mean * 100 if response_mean is not None else None
    high_value_customer_count = None
    if 'total_spend' in clusters.columns:
        spend_values = pd.to_numeric(clusters['total_spend'], errors='coerce')
        if not spend_values.dropna().empty:
            high_value_threshold = spend_values.quantile(0.75)
            high_value_customer_count = int((spend_values >= high_value_threshold).sum())

    # Clean NaN values before jsonify
    import math
    full_clusters = []
    for c in clusters.to_dict(orient='records'):
        clean_c = {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in c.items()}
        full_clusters.append(clean_c)

    clusters_preview = full_clusters[:500]
    t_response_built = time.perf_counter()

    result = {
        'success': True,
        'dataset_id': dataset_id,
        'user_email': user_email,
        'n_clusters': n_clusters,
        'cluster_mode': cluster_mode,
        'requested_clusters': requested_clusters,
        'selected_k': n_clusters,
        'k_selection': k_selection,
        'silhouette_score': analyzer.silhouette,
        'total_customers': len(clusters),
        'total_processed_rows': len(clusters),
        'displayed_rows': len(full_clusters),
        'avg_sentiment': analyzer._results.get('avg_sentiment', 0.0),
        'total_customer_spend': total_customer_spend,
        'avg_spend_per_customer': avg_spend_per_customer,
        'campaign_response_rate': campaign_response_rate,
        'high_value_customer_count': high_value_customer_count,
        'nlp_insights': nlp_insights,
        'segment_profiles': segment_profiles,
        'segment_recommendations': segment_recommendations,
        'spend_by_segment': segment_aggregates['spend_by_segment'],
        'campaign_response_by_segment': segment_aggregates['campaign_response_by_segment'],
        'recency_by_segment': segment_aggregates['recency_by_segment'],
        'sentiment_by_segment': segment_aggregates['sentiment_by_segment'],
        'product_spend_by_segment': segment_aggregates['product_spend_by_segment'],
        'channel_mix_by_segment': segment_aggregates['channel_mix_by_segment'],
        'segment_sentiments': segment_sentiments,
        'segment_distribution': segment_distribution,
        'segment_family_distribution': segment_family_distribution,
        'clusters': full_clusters,
        'clusters_preview': clusters_preview,
        'has_more': len(clusters) > 500,
        'using_gpu': analyzer.using_gpu,
        'gpu_attempted': analyzer.gpu_attempted,
        'gpu_used': analyzer.gpu_used,
        'model_backend': analyzer.model_backend,
        'fallback_reason': analyzer.fallback_reason,
        'nlp_feature_dim': getattr(analyzer, 'nlp_feature_dim', 0),
        'nlp_columns': getattr(analyzer, 'nlp_source_columns', []),
        'cluster_feature_columns': getattr(analyzer, 'cluster_feature_columns', []),
        'timestamp': pd.Timestamp.now().isoformat()
    }

    t_end = time.perf_counter()

    # ── Timing report (Phase 2) ──
    print({
        "module": "marketing",
        "cache": "MISS",
        "cluster_mode": cluster_mode,
        "selected_k": n_clusters,
        "dataset_load_ms": round((t_load - t0) * 1000, 1),
        "kmeans_pipeline_ms": round((t_kmeans - t_load) * 1000, 1),
        "nlp_pipeline_ms": round((t_nlp - t_kmeans) * 1000, 1),
        "response_build_ms": round((t_response_built - t_nlp) * 1000, 1),
        "total_ms": round((t_end - t0) * 1000, 1),
    })
    if cluster_mode == "auto":
        _print_auto_k_console_summary(
            result,
            cache_status="FORCE_REFRESH" if force_refresh else "MISS",
            print_candidates=True,
        )
    else:
        _print_kmeans_console_summary(
            result,
            cache_status="FORCE_REFRESH" if force_refresh else "MISS",
        )
    print_nlp_console_summary(
        nlp_insights,
        dataset_id=dataset_id,
        cache_status=nlp_insights.get("cache_status") if isinstance(nlp_insights, dict) else None,
    )

    # ── Store in cache (only on success) ──
    if cache_key:
        cache_put(cache_key, result)

    return jsonify(result), 200
