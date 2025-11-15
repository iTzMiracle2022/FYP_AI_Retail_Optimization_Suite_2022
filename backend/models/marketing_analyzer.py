import pandas as pd
import numpy as np
from sklearn.metrics import silhouette_score
from utils.data_preprocessing import MarketingPreprocessor
from utils.marketing_nlp_features import fit_transform_tfidf

# ── GPU ACCELERATION (NVIDIA RAPIDS)
try:
    import cudf
    import cuml
    from cuml.cluster import KMeans as cuKMeans
    GPU_AVAILABLE = True
    print("🚀 NVIDIA RAPIDS (cuML) detected! GPU acceleration enabled.")
except ImportError:
    GPU_AVAILABLE = False
    print("ℹ️ RAPIDS not found. Falling back to CPU (MiniBatchKMeans).")


class MarketingAnalyzer:
    """
    Marketing Intelligence: RFM numeric features + optional TF-IDF (NLP) on text
    columns, then K-Means segmentation (hybrid GPU/CPU).
    """

    # Semantic names will be assigned dynamically based on cluster centroids
    CLUSTER_FEATURE_COLUMNS = ['Total_Spend', 'Total_Purchases', 'Recency', 'Income', 'Response']

    def __init__(self):
        self.preprocessor = MarketingPreprocessor()
        self.kmeans = None
        self.is_trained = False
        self.silhouette = None
        self.cluster_centers = None
        self.n_clusters = None
        self.using_gpu = False
        self.gpu_attempted = False
        self.gpu_used = False
        self.fallback_reason = None
        self.model_backend = "Not trained"
        self._tfidf_vectorizer = None
        self.nlp_feature_dim = 0
        self.nlp_source_columns: list = []
        self.cluster_feature_columns: list = []

    def prepare_feature_matrix(self, df: pd.DataFrame, dataset_id: str = "unknown") -> dict:
        """
        Build the exact numeric + NLP feature matrix used by K-Means.
        Auto-K uses this lightweight prepared payload to evaluate candidates
        without building complete dashboard responses for every K.
        """
        df_work = df.copy().reset_index(drop=True)

        # ── NLP: TF-IDF on object/text columns (aligned with preprocessor row index)
        tfidf_full, self._tfidf_vectorizer, self.nlp_source_columns = fit_transform_tfidf(
            df_work, self._tfidf_vectorizer, fit=True
        )
        self.nlp_feature_dim = int(tfidf_full.shape[1]) if tfidf_full.size else 0
        if self.nlp_source_columns:
            print(f"  📝 NLP: TF-IDF on columns {self.nlp_source_columns} → {self.nlp_feature_dim} features")

        # Professional preprocessing (RFM + scaling; may drop outlier rows)
        processed = self.preprocessor.preprocess(df_work, fit=True, dataset_id=dataset_id)
        kept = self.preprocessor.last_kept_row_positions
        if kept is None:
            kept = np.arange(len(processed), dtype=int)

        if 'ID' in df_work.columns:
            original_ids = df_work['ID'].values[kept]
        else:
            original_ids = kept

        tfidf_kept = tfidf_full[kept] if tfidf_full.shape[1] > 0 else np.zeros((len(processed), 0), dtype=np.float32)
        sentiment_scores = tfidf_kept[:, -1] if tfidf_kept.shape[1] > 0 else np.zeros(len(processed), dtype=np.float32)

        cluster_columns = [col for col in self.CLUSTER_FEATURE_COLUMNS if col in processed.columns]
        if len(cluster_columns) < 3:
            cluster_columns = processed.columns.tolist()
        self.cluster_feature_columns = cluster_columns
        print(f"  🎯 K-Means feature space: {cluster_columns}")

        # K-Means uses a compact business/RFM feature set. Text feedback is kept
        # for sentiment display, but excluded from distance calculations.
        X = processed[cluster_columns].values.astype(np.float32)

        X_df = pd.DataFrame(X, columns=cluster_columns)

        # Log Preprocessing Run (ER Diagram)
        from database.mongodb_helper import db
        db.log_preprocessor_run(
            dataset_id=dataset_id,
            missing_value_handler='drop',
            normalization_method='MinMaxScaler',
            rows_before=len(df_work),
            rows_after=len(processed)
        )

        return {
            'df_work': df_work,
            'processed': processed,
            'kept': kept,
            'original_ids': original_ids,
            'tfidf_full': tfidf_full,
            'tfidf_kept': tfidf_kept,
            'sentiment_scores': sentiment_scores,
            'cluster_feature_columns': cluster_columns,
            'X': X,
            'X_df': X_df,
        }

    def segment_customers(self, df: pd.DataFrame, n_clusters: int = 4, dataset_id: str = "unknown", prepared: dict | None = None) -> pd.DataFrame:
        """
        Full pipeline: TF-IDF + VADER Sentiment → RFM preprocess → KMeans → segment labels.
        """
        print(f"🧠 MarketingAnalyzer: Segmenting into {n_clusters} clusters...")
        self.n_clusters = n_clusters
        self.using_gpu = False
        self.gpu_attempted = False
        self.gpu_used = False
        self.fallback_reason = None
        self.model_backend = "Not trained"

        prepared = prepared or self.prepare_feature_matrix(df, dataset_id=dataset_id)
        df_work = prepared['df_work']
        processed = prepared['processed']
        kept = prepared['kept']
        original_ids = prepared['original_ids']
        X = prepared['X']
        X_df = prepared['X_df']
        sentiment_scores = prepared.get('sentiment_scores')

        # ── KMeans Clustering (Hybrid GPU/CPU)
        if GPU_AVAILABLE:
            self.gpu_attempted = True
            try:
                print("🧠 Training cuML K-Means on GPU (RTX 3050)...")
                gdf = cudf.from_pandas(X_df)
                self.gpu_model = cuKMeans(n_clusters=n_clusters, random_state=42)
                self.gpu_model.fit(gdf)
                cluster_labels = self.gpu_model.labels_.to_numpy()
                self.cluster_centers = self.gpu_model.cluster_centers_.to_numpy().tolist()
                self.using_gpu = True
                self.gpu_used = True
                self.model_backend = "GPU cuML KMeans"
                print("✅ GPU K-Means complete.")
            except Exception as e:
                print(f"⚠️ GPU KMeans failed: {e}. Falling back to CPU...")
                self.fallback_reason = str(e)
                self._run_cpu_kmeans(X_df, n_clusters)
                cluster_labels = self.kmeans.labels_
                self.cluster_centers = self.kmeans.cluster_centers_.tolist()
        else:
            self._run_cpu_kmeans(X_df, n_clusters)
            cluster_labels = self.kmeans.labels_
            self.cluster_centers = self.kmeans.cluster_centers_.tolist()

        # ── Silhouette Score (combined feature space)
        if len(X_df) > 1:
            try:
                sample_limit = min(len(X_df), 10000)
                self.silhouette = float(silhouette_score(X_df, cluster_labels, sample_size=sample_limit, random_state=42))
                print(f"  📊 Silhouette Score (Sample N={sample_limit}): {self.silhouette:.4f}")
            except Exception as e:
                print(f"  ⚠️ Could not calculate silhouette: {e}")
                self.silhouette = 0.0
        else:
            self.silhouette = 0.0

        self.is_trained = True
        self._results = {
            'n_clusters': n_clusters,
            'silhouette_score': self.silhouette,
            'using_gpu': self.using_gpu,
            'gpu_attempted': self.gpu_attempted,
            'gpu_used': self.gpu_used,
            'model_backend': self.model_backend,
            'fallback_reason': self.fallback_reason,
            'nlp_feature_dim': self.nlp_feature_dim,
            'nlp_columns': self.nlp_source_columns,
        }

        # ── Attach results back
        result = pd.DataFrame({
            'customer_id': original_ids[:len(cluster_labels)],
            'cluster': cluster_labels.astype(int)
        })

        # Segment naming happens after re-attaching RFM columns

        # Methodology: Extract VADER Sentiment if NLP is used (it's the last column of X)
        if self.nlp_feature_dim > 0 and sentiment_scores is not None:
            result['sentiment'] = sentiment_scores[:len(cluster_labels)]
            self._results['avg_sentiment'] = float(result['sentiment'].mean())
        else:
            result['sentiment'] = 0.0
            self._results['avg_sentiment'] = 0.0

        # Re-attach key RFM columns for display and chart rendering
        rfm_cols = ['Total_Spend', 'Total_Purchases', 'Recency', 'Income', 'Age', 'Tenure_Days']
        
        # We must use the unscaled but CLEANED dataframe for UI display
        # The preprocessor scaler can inverse transform the processed numeric dataframe
        unscaled_arr = self.preprocessor.scaler.inverse_transform(processed)
        df_clean_unscaled = pd.DataFrame(unscaled_arr, columns=processed.columns)
        
        for col in rfm_cols:
            if col in df_clean_unscaled.columns:
                result[col.lower()] = df_clean_unscaled[col].values[:len(cluster_labels)]

        # Preserve campaign response as a display/aggregation field only.
        # It is not added to the clustering feature matrix.
        if 'Response' in df_work.columns:
            result['response'] = df_work['Response'].values[kept][:len(cluster_labels)]

        # ── Dynamic Segment Naming based on RFM profiles
        if 'total_spend' in result.columns and 'recency' in result.columns:
            centroids = result.groupby('cluster')[['total_spend', 'recency']].mean()
            
            # Rank clusters based on spend (descending) and recency (ascending)
            spend_ranks = centroids['total_spend'].rank(ascending=False)
            recency_ranks = centroids['recency'].rank(ascending=True)
            
            # Combined RFM score: low rank is better
            centroids['rfm_score'] = spend_ranks + recency_ranks
            
            dynamic_names = {}
            for c in centroids.index:
                s_rank = spend_ranks.loc[c]
                r_rank = recency_ranks.loc[c]
                
                if s_rank <= (n_clusters * 0.3) and r_rank <= (n_clusters * 0.3):
                    dynamic_names[c] = 'Champions'
                elif s_rank <= (n_clusters * 0.6) and r_rank <= (n_clusters * 0.5):
                    dynamic_names[c] = 'Loyal Customers'
                elif r_rank >= (n_clusters * 0.7) and s_rank >= (n_clusters * 0.6):
                    dynamic_names[c] = 'Lost Customers'
                elif r_rank >= (n_clusters * 0.5):
                    dynamic_names[c] = 'At-Risk Customers'
                elif s_rank >= (n_clusters * 0.7):
                    dynamic_names[c] = 'Recent Customers'
                else:
                    dynamic_names[c] = 'Potential Loyalists'
            
            result['segment_family'] = result['cluster'].map(lambda c: dynamic_names.get(c, f'Segment {c + 1}'))
        else:
            result['segment_family'] = result['cluster'].map(lambda c: f'Segment {c + 1}')

        family_clusters = {}
        for cluster_id, family in result[['cluster', 'segment_family']].drop_duplicates().sort_values('cluster').itertuples(index=False):
            family_clusters.setdefault(family, []).append(int(cluster_id))

        display_names = {}
        for family, cluster_ids in family_clusters.items():
            if len(cluster_ids) == 1:
                display_names[cluster_ids[0]] = family
            else:
                for idx, cluster_id in enumerate(cluster_ids):
                    suffix = chr(ord('A') + idx)
                    display_names[cluster_id] = f"{family} {suffix}"

        result['segment_name'] = result['segment_family']
        result['segment_display_name'] = result['cluster'].map(lambda c: display_names.get(int(c), f'Segment {int(c) + 1}'))

        print(f"  ✅ Clustered {len(result)} customers into {n_clusters} segments")
        return result.reset_index(drop=True)

    def _run_cpu_kmeans(self, X_df: pd.DataFrame, n_clusters: int):
        """High-performance CPU fallback using MiniBatchKMeans."""
        print("🧠 Training MiniBatchKMeans on CPU...")
        from sklearn.cluster import MiniBatchKMeans
        self.using_gpu = False
        self.gpu_used = False
        self.model_backend = "CPU MiniBatchKMeans"
        self.kmeans = MiniBatchKMeans(
            n_clusters=n_clusters,
            random_state=42,
            batch_size=2048,
            n_init=3
        )
        self.kmeans.fit(X_df)

    def get_cluster_summary(self) -> dict:
        """Return count and silhouette per cluster (for UI display)."""
        if not self.is_trained:
            return {
                'is_trained': False,
                'message': 'Model not yet trained. Run segment_customers first.'
            }
        return self._results
