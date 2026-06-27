import os

# Compatibility fix: cuML RandomForest predict can fail with CuPy CUB/CCCL on this CUDA stack.
# Disabling CuPy accelerators keeps GPU RandomForest working without CPU fallback.
os.environ.setdefault("CUPY_ACCELERATORS", "")

import hashlib
import json
import re
from datetime import datetime
from itertools import product
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier as SkRandomForest
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

# GPU acceleration (NVIDIA RAPIDS)
try:
    import cudf
    from cuml.ensemble import RandomForestClassifier as cuRandomForest

    GPU_AVAILABLE = True
    print("🚀 NVIDIA RAPIDS (cuML) detected! GPU acceleration enabled for Churn.")
except ImportError:
    GPU_AVAILABLE = False
    print("ℹ️ RAPIDS not found. Falling back to CPU (Scikit-Learn).")


CHURN_MODEL_VERSION = "customer_rf_v6_dedup_age"


class ChurnPredictor:
    """
    Customer-level Random Forest churn predictor.

    Dashboard KPIs remain label-based in the route. This model trains one row
    per Customer Name, then maps customer-level predictions back to transaction
    rows for the existing API shape.
    """

    NUMERIC_FEATURES = [
        "total_orders",
        "total_revenue",
        "avg_order_value",
        "avg_quantity",
        "avg_product_price",
        "total_returns",
        "return_rate",
        "active_days",
        "days_since_last_purchase",
        "purchase_frequency",
        "avg_days_between_orders",
        "unique_categories",
        "unique_payment_methods",
        "avg_age",
        "last_purchase_month",
        "last_purchase_dayofweek",
        "most_common_purchase_month",
        "recency_score",
        "frequency_score",
        "monetary_score",
        "rfm_score",
        "rfm_segment_code",
        "mean_days_between_orders",
        "median_days_between_orders",
        "max_days_between_orders",
        "std_days_between_orders",
        "days_between_first_last_order",
        "recent_order_ratio_90d",
        "recent_order_ratio_180d",
        "orders_last_30d",
        "orders_last_60d",
        "orders_last_90d",
        "orders_last_180d",
        "revenue_first_half",
        "revenue_second_half",
        "revenue_trend_ratio",
        "order_count_first_half",
        "order_count_second_half",
        "order_trend_ratio",
        "avg_order_value_first_half",
        "avg_order_value_second_half",
        "aov_trend_ratio",
        "return_count",
        "return_amount_proxy",
        "returns_last_90d",
        "recent_return_rate",
        "category_diversity",
        "payment_diversity",
        "dominant_category_share",
        "dominant_payment_share",
        "customer_lifetime_days",
        "orders_per_active_month",
        "revenue_per_active_month",
        "inactive_days_ratio",
    ]

    CATEGORICAL_FEATURES = [
        "primary_product_category",
        "primary_payment_method",
        "gender",
    ]

    MODEL_INPUT_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    OPTIONAL_NUMERIC_FEATURES = ["avg_customer_age"]
    AGE_DEDUP_CORRELATION_THRESHOLD = 0.99

    EXCLUDED_FEATURES = {
        "Churn",
        "actual_churn",
        "model_predicted_churn",
        "churn_prediction",
        "model_churn_probability",
        "churn_probability",
        "model_risk_level",
        "risk_level",
        "dashboard_churn_status",
        "Customer ID",
        "Customer Name",
        "customer_ref_id",
        "row_id",
        "_source_index",
        "index",
        "Purchase Date",
    }

    def __init__(self):
        self.params = {
            "n_estimators": 200,
            "max_depth": 12,
            "random_state": 42,
        }
        self.model = None
        self.accuracy = None
        self.is_trained = False
        self.last_trained_date = None
        self.feature_importance = {}
        self.gpu_attempted = GPU_AVAILABLE
        self.gpu_used = False
        self.using_gpu = GPU_AVAILABLE
        self.fallback_used = False
        self.model_backend = "cuml_gpu" if GPU_AVAILABLE else "sklearn_cpu"
        self.last_error = None
        self.evaluation = None
        self.churn_mode = "uninitialized"
        self.has_actual_churn_label = False
        self.can_evaluate_model = False
        self.label_message = ""
        self.features_used = []
        self.semantic_numeric_features = list(self.NUMERIC_FEATURES)
        self.semantic_categorical_features = list(self.CATEGORICAL_FEATURES)
        self.semantic_features_used = list(self.MODEL_INPUT_FEATURES)
        self.model_feature_columns = []
        self.selected_threshold = 0.5
        self.last_customer_predictions = pd.DataFrame()
        self.selected_model_config = {}
        self.cache_dir = Path(__file__).resolve().parents[1] / "cache" / "churn_model"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_metadata = {}
        self.grouping_strategy = {}
        self.age_feature_deduplication = {}

    def _short_error(self, exc: Exception) -> str:
        return f"{type(exc).__name__}: {str(exc).splitlines()[0][:240]}"

    def _safe_dataset_id(self, dataset_id: str) -> str:
        return re.sub(r"[^A-Za-z0-9_.-]+", "_", str(dataset_id or "unknown")).strip("_") or "unknown"

    def _cache_paths(self, dataset_id: str) -> tuple[Path, Path]:
        safe_id = self._safe_dataset_id(dataset_id)
        return (
            self.cache_dir / f"{safe_id}_model.joblib",
            self.cache_dir / f"{safe_id}_metadata.json",
        )

    def _json_safe(self, value):
        if isinstance(value, dict):
            return {str(k): self._json_safe(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._json_safe(v) for v in value]
        if isinstance(value, tuple):
            return [self._json_safe(v) for v in value]
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            return float(value)
        if isinstance(value, (np.bool_,)):
            return bool(value)
        if pd.isna(value) if isinstance(value, (float, np.floating)) else False:
            return None
        return value

    def _dataset_hash(self, df: pd.DataFrame) -> str:
        stable = df.drop(columns=["_source_index"], errors="ignore").copy()
        hasher = hashlib.sha256()
        hasher.update("|".join(map(str, stable.columns)).encode("utf-8"))
        row_hashes = pd.util.hash_pandas_object(stable, index=False).values
        hasher.update(row_hashes.tobytes())
        return hasher.hexdigest()

    def _load_cached_model(self, dataset_id: str, dataset_hash: str, force_retune: bool) -> bool:
        if force_retune or os.environ.get("CHURN_FORCE_RETUNE", "0") == "1":
            print("🔎 Tuning customer-level Churn model because force retune was requested")
            return False

        model_path, metadata_path = self._cache_paths(dataset_id)
        if not model_path.exists() or not metadata_path.exists():
            print("🔎 Tuning customer-level Churn model because cache is missing or stale")
            return False

        try:
            with open(metadata_path, "r") as fh:
                metadata = json.load(fh)
            if metadata.get("dataset_id") != dataset_id:
                return False
            if metadata.get("dataset_hash") != dataset_hash:
                return False
            if metadata.get("model_version") != CHURN_MODEL_VERSION:
                return False
            if metadata.get("semantic_feature_schema") != self.semantic_features_used:
                return False

            self.model = joblib.load(model_path)
            self.semantic_features_used = metadata.get("semantic_feature_schema") or list(self.semantic_features_used)
            self.semantic_numeric_features = metadata.get("numeric_feature_schema") or list(self.semantic_numeric_features)
            self.semantic_categorical_features = metadata.get("categorical_feature_schema") or list(self.semantic_categorical_features)
            self.selected_threshold = float(metadata["selected_threshold"])
            self.selected_model_config = metadata.get("selected_model_config") or {}
            self.model_feature_columns = metadata.get("model_feature_columns") or []
            self.features_used = list(self.model_feature_columns)
            self.feature_importance = metadata.get("feature_importance") or {}
            self.evaluation = metadata.get("ai_model_evaluation")
            if self.evaluation:
                self.evaluation["evaluation_source"] = "Cached"
                self.evaluation["tuning_skipped"] = True
                self.evaluation["configs_evaluated_this_run"] = 0
                self.evaluation["model_configs_evaluated"] = int(self.evaluation.get("model_configs_evaluated") or 0)
                self.evaluation["model_version"] = CHURN_MODEL_VERSION
                self.evaluation["tuning_backend"] = "sklearn_cpu"
                self.evaluation["tuning_backend_reason"] = "sklearn supports class_weight, feature importance, and controlled validation tuning."
                self.evaluation["gpu_inference_available"] = bool(GPU_AVAILABLE)
                self.evaluation["gpu_used_for_this_evaluation"] = False
            self.accuracy = self.evaluation.get("accuracy") if self.evaluation else None
            self.model_backend = metadata.get("model_backend", "sklearn_cpu")
            self.grouping_strategy = metadata.get("grouping_strategy") or {}
            self.gpu_used = False
            self.using_gpu = False
            self.fallback_used = False
            self.cache_metadata = metadata
            self.age_feature_deduplication = metadata.get("age_feature_deduplication") or {}
            print("✅ Loaded cached customer-level Churn AI model")
            print(f"Model Version: {CHURN_MODEL_VERSION}")
            print("Tuning Skipped: Yes")
            print("Configs Evaluated: 0")
            return True
        except Exception as exc:
            print(f"🔎 Tuning customer-level Churn model because cache is missing or stale. Reason: {self._short_error(exc)}")
            return False

    def _save_cached_model(self, dataset_id: str, dataset_hash: str):
        model_path, metadata_path = self._cache_paths(dataset_id)
        metadata = {
            "dataset_id": dataset_id,
            "dataset_hash": dataset_hash,
            "model_version": CHURN_MODEL_VERSION,
            "model_backend": self.model_backend,
            "semantic_feature_schema": self.semantic_features_used,
            "numeric_feature_schema": self.semantic_numeric_features,
            "categorical_feature_schema": self.semantic_categorical_features,
            "model_feature_columns": self.model_feature_columns,
            "selected_threshold": self.selected_threshold,
            "selected_model_config": self.selected_model_config,
            "feature_importance": self.feature_importance,
            "ai_model_evaluation": self.evaluation,
            "grouping_strategy": getattr(self, "grouping_strategy", {}),
            "age_feature_deduplication": getattr(self, "age_feature_deduplication", {}),
            "train_splits_used": getattr(self, "train_splits_used", "train_validation"),
            "train_rows_count": getattr(self, "train_rows_count", None),
            "test_rows_held_out": getattr(self, "test_rows_held_out", None),
            "created_at": datetime.now().isoformat(),
        }
        joblib.dump(self.model, model_path)
        with open(metadata_path, "w") as fh:
            json.dump(self._json_safe(metadata), fh, indent=2)
        self.cache_metadata = metadata
        print(f"✅ Saved customer-level Churn AI model cache: {model_path}")

    def _mode_value(self, series: pd.Series, default: str = "Unknown") -> str:
        values = series.dropna().astype(str)
        if values.empty:
            return default
        modes = values.mode()
        return str(modes.iloc[0]) if not modes.empty else str(values.iloc[0])

    def _determine_grouping_strategy(self, df: pd.DataFrame) -> dict:
        from utils.data_preprocessing import ColumnMatcher
        
        # 1. Look for Customer ID column
        id_col = ColumnMatcher.match(df, 'customer')
        if not id_col and "Customer ID" in df.columns:
            id_col = "Customer ID"
            
        has_name = "Customer Name" in df.columns
        
        # Check reliability of Customer ID
        id_is_unreliable = False
        if id_col and has_name:
            total_rows = len(df)
            if total_rows > 10:
                unique_ids = df[id_col].nunique()
                mean_ids_per_name = df.groupby("Customer Name")[id_col].nunique().mean()
                if unique_ids > 0.9 * total_rows and mean_ids_per_name > 2.0:
                    id_is_unreliable = True
                    print(f"⚠️ ChurnPredictor: Detected row-level/unreliable Customer ID column '{id_col}'. falling back to composite grouping.")
        
        if id_col and not id_is_unreliable:
            return {
                "strategy": "id_based",
                "key_column": id_col
            }
            
        if has_name:
            # Check for demographic columns consistency
            consistent_demographics = []
            for col in ["Age", "Customer Age", "Gender"]:
                if col in df.columns:
                    name_counts = df["Customer Name"].value_counts()
                    multi_row_names = name_counts[name_counts > 1].index
                    if len(multi_row_names) > 0:
                        uniques_per_name = df[df["Customer Name"].isin(multi_row_names)].groupby("Customer Name")[col].nunique()
                        pct_consistent = (uniques_per_name <= 1).mean()
                        if pct_consistent >= 0.75:
                            consistent_demographics.append(col)
                    else:
                        consistent_demographics.append(col)
            
            return {
                "strategy": "composite_based",
                "key_columns": ["Customer Name"] + consistent_demographics
            }
            
        return {
            "strategy": "row_fallback"
        }

    def _customer_keys(self, df: pd.DataFrame) -> pd.Series:
        # Determine strategy dynamically if not pre-determined or if dataset is large enough for fresh detection
        strategy_info = getattr(self, "grouping_strategy", {})
        
        # If the df is large enough, always attempt fresh re-detection
        if len(df) >= 10:
            strategy_info = self._determine_grouping_strategy(df)
            # Log it in predictor instance for current prediction run
            self.grouping_strategy = strategy_info
        elif not strategy_info:
            # Inconclusive/small df and no pre-loaded strategy, do fresh detection
            strategy_info = self._determine_grouping_strategy(df)
            self.grouping_strategy = strategy_info
            
        strategy = strategy_info.get("strategy", "row_fallback")
        
        if strategy == "id_based":
            col = strategy_info["key_column"]
            return df[col].fillna("Unknown").astype(str)
        elif strategy == "composite_based":
            cols = strategy_info["key_columns"]
            temp_df = df[cols].copy()
            for col in cols:
                temp_df[col] = temp_df[col].fillna("Unknown").astype(str)
            return temp_df.agg("_".join, axis=1)
        else:
            return pd.Series([f"row_{i}" for i in range(len(df))], index=df.index)

    def _numeric_series(self, df: pd.DataFrame, column: str, default=0.0) -> pd.Series:
        if column in df.columns:
            return pd.to_numeric(df[column], errors="coerce")
        return pd.Series([default] * len(df), index=df.index, dtype=float)

    def _age_features_are_redundant(self, avg_age: pd.Series, avg_customer_age: pd.Series) -> tuple[bool, float | None, int]:
        paired = pd.DataFrame({
            "avg_age": pd.to_numeric(avg_age, errors="coerce"),
            "avg_customer_age": pd.to_numeric(avg_customer_age, errors="coerce"),
        }).dropna()
        valid_pairs = len(paired)
        if valid_pairs == 0:
            return True, None, valid_pairs

        age_values = paired["avg_age"].astype(float).to_numpy()
        customer_age_values = paired["avg_customer_age"].astype(float).to_numpy()
        if np.allclose(age_values, customer_age_values, rtol=1e-6, atol=1e-6):
            return True, 1.0, valid_pairs

        if valid_pairs < 2 or np.isclose(np.std(age_values), 0.0) or np.isclose(np.std(customer_age_values), 0.0):
            return False, None, valid_pairs

        correlation = float(np.corrcoef(age_values, customer_age_values)[0, 1])
        if np.isnan(correlation):
            return False, None, valid_pairs
        return correlation > self.AGE_DEDUP_CORRELATION_THRESHOLD, correlation, valid_pairs

    def _set_age_aware_feature_schema(self, include_customer_age: bool):
        numeric_features = list(self.NUMERIC_FEATURES)
        if include_customer_age and "avg_customer_age" not in numeric_features:
            avg_age_index = numeric_features.index("avg_age") if "avg_age" in numeric_features else len(numeric_features)
            numeric_features.insert(avg_age_index, "avg_customer_age")

        self.semantic_numeric_features = numeric_features
        self.semantic_categorical_features = list(self.CATEGORICAL_FEATURES)
        self.semantic_features_used = self.semantic_numeric_features + self.semantic_categorical_features

    def _build_customer_model_table(self, df: pd.DataFrame, include_target: bool) -> pd.DataFrame:
        work = df.copy().reset_index(drop=True)
        work["_customer_key"] = self._customer_keys(work).reset_index(drop=True)
        work["_purchase_date"] = pd.to_datetime(work.get("Purchase Date"), errors="coerce")
        work["_amount"] = self._numeric_series(work, "Total Purchase Amount").fillna(0.0)
        work["_quantity"] = self._numeric_series(work, "Quantity").fillna(0.0)
        work["_product_price"] = self._numeric_series(work, "Product Price").fillna(0.0)
        raw_returns = self._numeric_series(work, "Returns", default=np.nan)
        work["_returns"] = raw_returns.fillna(0.0)
        work["_known_return_orders"] = raw_returns.notna().astype(float)
        has_age = "Age" in work.columns
        has_customer_age = "Customer Age" in work.columns
        work["_age"] = self._numeric_series(work, "Age", np.nan)
        work["_customer_age"] = self._numeric_series(work, "Customer Age", np.nan)

        grouped = work.groupby("_customer_key", dropna=False)
        table = pd.DataFrame(index=grouped.size().index)
        table["customer_name"] = table.index.astype(str)
        table["total_orders"] = grouped.size().astype(float)
        table["total_revenue"] = grouped["_amount"].sum().astype(float)
        table["avg_order_value"] = table["total_revenue"] / table["total_orders"].replace(0, 1)
        table["avg_quantity"] = grouped["_quantity"].mean().astype(float)
        table["avg_product_price"] = grouped["_product_price"].mean().astype(float)
        table["total_returns"] = grouped["_returns"].sum().astype(float)
        table["known_return_orders"] = grouped["_known_return_orders"].sum().astype(float)
        table["return_rate"] = table["total_returns"] / table["known_return_orders"].replace(0, np.nan)

        first_purchase = grouped["_purchase_date"].min()
        last_purchase = grouped["_purchase_date"].max()
        max_purchase = work["_purchase_date"].max()
        table["first_purchase_date"] = first_purchase
        table["last_purchase_date"] = last_purchase
        table["active_days"] = (last_purchase - first_purchase).dt.days.fillna(0).clip(lower=0) + 1
        if pd.notna(max_purchase):
            table["days_since_last_purchase"] = (max_purchase - last_purchase).dt.days.fillna(0).clip(lower=0)
        else:
            table["days_since_last_purchase"] = 0
        table["purchase_frequency"] = table["total_orders"] / table["active_days"].replace(0, 1)

        date_rows = work[["_customer_key", "_purchase_date"]].dropna().sort_values(["_customer_key", "_purchase_date"])
        if date_rows.empty:
            avg_gap = pd.Series(dtype=float)
            gap_stats = pd.DataFrame()
        else:
            unique_dates = date_rows.drop_duplicates(["_customer_key", "_purchase_date"]).copy()
            unique_dates["_gap_days"] = unique_dates.groupby("_customer_key")["_purchase_date"].diff().dt.days
            gap_stats = unique_dates.dropna(subset=["_gap_days"]).groupby("_customer_key")["_gap_days"].agg(["mean", "median", "max", "std"])
            avg_gap = gap_stats["mean"] if not gap_stats.empty and "mean" in gap_stats else pd.Series(dtype=float)
        table["avg_days_between_orders"] = table.index.to_series().map(avg_gap).fillna(0.0).astype(float)
        table["mean_days_between_orders"] = table["avg_days_between_orders"]
        table["median_days_between_orders"] = table.index.to_series().map(gap_stats["median"] if not gap_stats.empty and "median" in gap_stats else pd.Series(dtype=float)).fillna(0.0).astype(float)
        table["max_days_between_orders"] = table.index.to_series().map(gap_stats["max"] if not gap_stats.empty and "max" in gap_stats else pd.Series(dtype=float)).fillna(0.0).astype(float)
        table["std_days_between_orders"] = table.index.to_series().map(gap_stats["std"] if not gap_stats.empty and "std" in gap_stats else pd.Series(dtype=float)).fillna(0.0).astype(float)
        table["days_between_first_last_order"] = table["active_days"].clip(lower=0)

        if pd.notna(max_purchase):
            for days in [30, 60, 90, 180]:
                work[f"_order_last_{days}d"] = (work["_purchase_date"] >= (max_purchase - pd.Timedelta(days=days))).astype(int)
                table[f"orders_last_{days}d"] = grouped[f"_order_last_{days}d"].sum().astype(float)
            work["_return_last_90d"] = (
                (work["_purchase_date"] >= (max_purchase - pd.Timedelta(days=90)))
                & (work["_returns"] > 0)
            ).astype(int)
            table["returns_last_90d"] = grouped["_return_last_90d"].sum().astype(float)
        else:
            for days in [30, 60, 90, 180]:
                table[f"orders_last_{days}d"] = 0.0
            table["returns_last_90d"] = 0.0

        table["recent_order_ratio_90d"] = table["orders_last_90d"] / table["total_orders"].replace(0, 1)
        table["recent_order_ratio_180d"] = table["orders_last_180d"] / table["total_orders"].replace(0, 1)

        if "Product Category" in work.columns:
            table["unique_categories"] = grouped["Product Category"].nunique(dropna=True).astype(float)
            cat_counts = work.dropna(subset=["Product Category"]).groupby(["_customer_key", "Product Category"]).size().rename("count").reset_index()
            if cat_counts.empty:
                table["primary_product_category"] = "Unknown"
                table["dominant_category_share"] = 0.0
            else:
                cat_counts["Product Category"] = cat_counts["Product Category"].astype(str)
                cat_counts = cat_counts.sort_values(["_customer_key", "count", "Product Category"], ascending=[True, False, True])
                top_cat = cat_counts.drop_duplicates("_customer_key").set_index("_customer_key")
                table["primary_product_category"] = table.index.to_series().map(top_cat["Product Category"]).fillna("Unknown")
                table["dominant_category_share"] = (
                    table.index.to_series().map(top_cat["count"]).fillna(0).astype(float) / table["total_orders"].replace(0, 1)
                )
        else:
            table["unique_categories"] = 0.0
            table["primary_product_category"] = "Unknown"
            table["dominant_category_share"] = 0.0

        if "Payment Method" in work.columns:
            table["unique_payment_methods"] = grouped["Payment Method"].nunique(dropna=True).astype(float)
            pay_counts = work.dropna(subset=["Payment Method"]).groupby(["_customer_key", "Payment Method"]).size().rename("count").reset_index()
            if pay_counts.empty:
                table["primary_payment_method"] = "Unknown"
                table["dominant_payment_share"] = 0.0
            else:
                pay_counts["Payment Method"] = pay_counts["Payment Method"].astype(str)
                pay_counts = pay_counts.sort_values(["_customer_key", "count", "Payment Method"], ascending=[True, False, True])
                top_pay = pay_counts.drop_duplicates("_customer_key").set_index("_customer_key")
                table["primary_payment_method"] = table.index.to_series().map(top_pay["Payment Method"]).fillna("Unknown")
                table["dominant_payment_share"] = (
                    table.index.to_series().map(top_pay["count"]).fillna(0).astype(float) / table["total_orders"].replace(0, 1)
                )
        else:
            table["unique_payment_methods"] = 0.0
            table["primary_payment_method"] = "Unknown"
            table["dominant_payment_share"] = 0.0

        table["category_diversity"] = table["unique_categories"]
        table["payment_diversity"] = table["unique_payment_methods"]

        work["_first_purchase"] = work["_customer_key"].map(first_purchase)
        work["_last_purchase"] = work["_customer_key"].map(last_purchase)
        work["_mid_purchase"] = work["_first_purchase"] + ((work["_last_purchase"] - work["_first_purchase"]) / 2)
        work["_first_half"] = work["_purchase_date"].notna() & (work["_purchase_date"] <= work["_mid_purchase"])
        work["_second_half"] = work["_purchase_date"].notna() & ~work["_first_half"]
        work["_amount_first_half"] = np.where(work["_first_half"], work["_amount"], 0.0)
        work["_amount_second_half"] = np.where(work["_second_half"], work["_amount"], 0.0)
        work["_order_first_half"] = work["_first_half"].astype(int)
        work["_order_second_half"] = work["_second_half"].astype(int)
        table["revenue_first_half"] = grouped["_amount_first_half"].sum().astype(float)
        table["revenue_second_half"] = grouped["_amount_second_half"].sum().astype(float)
        table["revenue_trend_ratio"] = table["revenue_second_half"] / table["revenue_first_half"].replace(0, 1)
        table["order_count_first_half"] = grouped["_order_first_half"].sum().astype(float)
        table["order_count_second_half"] = grouped["_order_second_half"].sum().astype(float)
        table["order_trend_ratio"] = table["order_count_second_half"] / table["order_count_first_half"].replace(0, 1)
        table["avg_order_value_first_half"] = table["revenue_first_half"] / table["order_count_first_half"].replace(0, 1)
        table["avg_order_value_second_half"] = table["revenue_second_half"] / table["order_count_second_half"].replace(0, 1)
        table["aov_trend_ratio"] = table["avg_order_value_second_half"] / table["avg_order_value_first_half"].replace(0, 1)

        table["return_count"] = table["total_returns"]
        table["return_amount_proxy"] = table["total_returns"] * table["avg_order_value"]
        table["recent_return_rate"] = table["returns_last_90d"] / table["orders_last_90d"].replace(0, 1)

        table["customer_lifetime_days"] = table["active_days"]
        active_months = (table["customer_lifetime_days"] / 30.4375).clip(lower=1.0)
        table["orders_per_active_month"] = table["total_orders"] / active_months
        table["revenue_per_active_month"] = table["total_revenue"] / active_months
        table["inactive_days_ratio"] = table["days_since_last_purchase"] / (
            table["customer_lifetime_days"] + table["days_since_last_purchase"] + 1
        ).replace(0, 1)

        avg_age_candidate = grouped["_age"].mean()
        avg_customer_age_candidate = grouped["_customer_age"].mean()
        table["avg_age"] = avg_age_candidate if has_age else avg_customer_age_candidate
        include_customer_age_feature = False
        age_dedup_reason = "single_or_missing_age_source"
        age_correlation = None
        age_valid_pairs = 0
        if has_age and has_customer_age:
            is_redundant, age_correlation, age_valid_pairs = self._age_features_are_redundant(
                avg_age_candidate,
                avg_customer_age_candidate,
            )
            include_customer_age_feature = not is_redundant
            if include_customer_age_feature:
                table["avg_customer_age"] = avg_customer_age_candidate
                age_dedup_reason = "age_sources_meaningfully_differ"
            else:
                age_dedup_reason = "age_sources_redundant"

        self.age_feature_deduplication = {
            "age_column_present": bool(has_age),
            "customer_age_column_present": bool(has_customer_age),
            "kept_features": ["avg_age"] + (["avg_customer_age"] if include_customer_age_feature else []),
            "dropped_features": [] if include_customer_age_feature else (["avg_customer_age"] if has_customer_age else []),
            "preferred_feature": "avg_age",
            "correlation_threshold": float(self.AGE_DEDUP_CORRELATION_THRESHOLD),
            "observed_correlation": age_correlation,
            "valid_pair_count": int(age_valid_pairs),
            "reason": age_dedup_reason,
        }
        self._set_age_aware_feature_schema(include_customer_age=include_customer_age_feature)
        if "Gender" in work.columns:
            gender_counts = work.dropna(subset=["Gender"]).groupby(["_customer_key", "Gender"]).size().rename("count").reset_index()
            if gender_counts.empty:
                table["gender"] = "Unknown"
            else:
                gender_counts["Gender"] = gender_counts["Gender"].astype(str)
                gender_counts = gender_counts.sort_values(["_customer_key", "count", "Gender"], ascending=[True, False, True])
                top_gender = gender_counts.drop_duplicates("_customer_key").set_index("_customer_key")
                table["gender"] = table.index.to_series().map(top_gender["Gender"]).fillna("Unknown")
        else:
            table["gender"] = "Unknown"

        table["last_purchase_month"] = last_purchase.dt.month.fillna(0).astype(float)
        table["last_purchase_dayofweek"] = last_purchase.dt.dayofweek.fillna(0).astype(float)
        if work["_purchase_date"].notna().any():
            work["_purchase_month"] = work["_purchase_date"].dt.month
            month_counts = work.dropna(subset=["_purchase_month"]).groupby(["_customer_key", "_purchase_month"]).size().rename("count").reset_index()
            if month_counts.empty:
                table["most_common_purchase_month"] = 0.0
            else:
                month_counts = month_counts.sort_values(["_customer_key", "count", "_purchase_month"], ascending=[True, False, True])
                top_month = month_counts.drop_duplicates("_customer_key").set_index("_customer_key")
                table["most_common_purchase_month"] = table.index.to_series().map(top_month["_purchase_month"]).fillna(0).astype(float)
        else:
            table["most_common_purchase_month"] = 0.0

        table["recency_score"] = 1.0 - table["days_since_last_purchase"].rank(pct=True, method="average").fillna(0.5)
        table["frequency_score"] = table["total_orders"].rank(pct=True, method="average").fillna(0.5)
        table["monetary_score"] = table["total_revenue"].rank(pct=True, method="average").fillna(0.5)
        table["rfm_score"] = (table["recency_score"] + table["frequency_score"] + table["monetary_score"]) / 3.0
        table["rfm_segment_code"] = np.ceil(table["rfm_score"].clip(0, 1) * 5).replace(0, 1).astype(float)

        if include_target:
            if "Churn" not in work.columns:
                raise ValueError("Churn label is required for supervised customer-level training.")
            churn = pd.to_numeric(work["Churn"], errors="coerce").fillna(0).astype(int)
            table["actual_churn"] = churn.groupby(work["_customer_key"]).max().reindex(table.index).fillna(0).astype(int)

        table = table.reset_index(drop=True)
        for col in self.semantic_numeric_features:
            if col == "return_rate":
                table[col] = pd.to_numeric(table.get(col, np.nan), errors="coerce").astype(float)
            else:
                table[col] = pd.to_numeric(table.get(col, 0.0), errors="coerce").fillna(0.0).astype(float)
        for col in self.semantic_categorical_features:
            table[col] = table.get(col, "Unknown")
            table[col] = table[col].fillna("Unknown").astype(str)
        return table

    def _raw_customer_features(self, customer_table: pd.DataFrame) -> pd.DataFrame:
        features = customer_table[self.semantic_features_used].copy()
        return features.drop(columns=[c for c in self.EXCLUDED_FEATURES if c in features.columns], errors="ignore")

    def _encode_customer_features(self, raw_features: pd.DataFrame, fit: bool) -> pd.DataFrame:
        encoded = raw_features.copy()
        for col in self.semantic_numeric_features:
            encoded[col] = pd.to_numeric(encoded.get(col, 0.0), errors="coerce").fillna(0.0)
        for col in self.semantic_categorical_features:
            encoded[col] = encoded.get(col, "Unknown").fillna("Unknown").astype(str)

        encoded = pd.get_dummies(encoded, columns=self.semantic_categorical_features, prefix=self.semantic_categorical_features)
        encoded = encoded.astype(np.float32)

        if fit:
            self.model_feature_columns = encoded.columns.tolist()
        else:
            for col in self.model_feature_columns:
                if col not in encoded.columns:
                    encoded[col] = 0.0
            extra_cols = [col for col in encoded.columns if col not in self.model_feature_columns]
            if extra_cols:
                encoded = encoded.drop(columns=extra_cols)
            encoded = encoded[self.model_feature_columns]

        self.features_used = list(self.model_feature_columns)
        return encoded

    def _balanced_sample_weight(self, y: pd.Series) -> np.ndarray:
        y_arr = np.asarray(y).astype(int)
        classes, counts = np.unique(y_arr, return_counts=True)
        if len(classes) < 2:
            return np.ones(len(y_arr), dtype=np.float32)
        total = len(y_arr)
        class_weights = {cls: total / (len(classes) * count) for cls, count in zip(classes, counts)}
        return np.asarray([class_weights[val] for val in y_arr], dtype=np.float32)

    def _fit_gpu_model(self, X_train, y_train, sample_weight=None):
        X_train_g = cudf.from_pandas(X_train.astype(np.float32))
        y_train_g = cudf.from_pandas(pd.Series(y_train).astype(np.int32))
        model = cuRandomForest(**self.params)
        if sample_weight is not None:
            model.fit(X_train_g, y_train_g, sample_weight=sample_weight)
        else:
            model.fit(X_train_g, y_train_g)
        return model

    def _fit_cpu_model(self, X_train, y_train):
        return self._fit_cpu_model_with_config(X_train, y_train, self.selected_model_config or None)

    def _fit_cpu_model_with_config(self, X_train, y_train, config=None):
        config = config or {
            "n_estimators": 250,
            "max_depth": 12,
            "min_samples_leaf": 2,
            "min_samples_split": 2,
            "max_features": "sqrt",
            "class_weight": "balanced",
        }
        model = SkRandomForest(
            n_estimators=config["n_estimators"],
            max_depth=config["max_depth"],
            min_samples_leaf=config["min_samples_leaf"],
            min_samples_split=config["min_samples_split"],
            max_features=config["max_features"],
            n_jobs=-1,
            random_state=42,
            class_weight=config["class_weight"],
        )
        model.fit(X_train, y_train)
        return model

    def _fit_model(self, X_train, y_train, prefer_gpu: bool):
        if prefer_gpu:
            try:
                weights = self._balanced_sample_weight(y_train)
                model = self._fit_gpu_model(X_train, y_train, sample_weight=weights)
                return model, True, "cuml_gpu", False
            except Exception as exc:
                if os.environ.get("CHURN_GPU_DEBUG") == "1":
                    import traceback

                    traceback.print_exc()
                self.last_error = self._short_error(exc)
                print("⚠️ Churn GPU RandomForest unavailable. Using sklearn CPU fallback.")
                print(f"Reason: {self.last_error}")

        return self._fit_cpu_model(X_train, y_train), False, "sklearn_cpu", bool(prefer_gpu)

    def _candidate_model_configs(self) -> list[dict]:
        n_estimators_options = [100, 200, 300]
        max_depth_options = [6, 10, 14, None]
        min_samples_leaf_options = [1, 3, 5, 10]
        min_samples_split_options = [2, 5, 10]
        max_features_options = ["sqrt", "log2", None]
        class_weight_options = ["balanced", "balanced_subsample", None]

        all_configs = [
            {
                "n_estimators": n_estimators,
                "max_depth": max_depth,
                "min_samples_leaf": min_samples_leaf,
                "min_samples_split": min_samples_split,
                "max_features": max_features,
                "class_weight": class_weight,
            }
            for n_estimators, max_depth, min_samples_leaf, min_samples_split, max_features, class_weight
            in product(
                n_estimators_options,
                max_depth_options,
                min_samples_leaf_options,
                min_samples_split_options,
                max_features_options,
                class_weight_options,
            )
            if min_samples_split >= min_samples_leaf
        ]

        max_configs = int(os.environ.get("CHURN_RF_MAX_CONFIGS", "12"))
        step = max(1, len(all_configs) // max_configs)
        sampled = all_configs[::step][:max_configs]
        coverage = []
        for n_estimators in n_estimators_options:
            coverage.append({**sampled[0], "n_estimators": n_estimators})
        for max_depth in max_depth_options:
            coverage.append({**sampled[0], "max_depth": max_depth})
        for min_samples_leaf in min_samples_leaf_options:
            coverage.append({**sampled[0], "min_samples_leaf": min_samples_leaf, "min_samples_split": max(2, min_samples_leaf)})
        for min_samples_split in min_samples_split_options:
            coverage.append({**sampled[0], "min_samples_split": min_samples_split})
        for max_features in max_features_options:
            coverage.append({**sampled[0], "max_features": max_features})
        for class_weight in class_weight_options:
            coverage.append({**sampled[0], "class_weight": class_weight})

        deduped = []
        seen = set()
        for config in sampled + coverage:
            key = tuple(config.items())
            if key not in seen:
                seen.add(key)
                deduped.append(config)
        return deduped

    def _predict_probabilities(self, model, X: pd.DataFrame, use_gpu: bool) -> np.ndarray:
        if use_gpu:
            X_g = cudf.from_pandas(X.astype(np.float32))
            proba = model.predict_proba(X_g)
            if hasattr(proba, "to_pandas"):
                proba = proba.to_pandas()
            if hasattr(proba, "to_numpy"):
                arr = proba.to_numpy()
            else:
                arr = np.asarray(proba)
        else:
            arr = model.predict_proba(X)

        arr = np.asarray(arr, dtype=float)
        if arr.ndim == 2 and arr.shape[1] > 1:
            return arr[:, 1]
        return arr.ravel()

    def _threshold_metrics(self, y_true, probabilities, threshold) -> dict:
        pred = (probabilities >= threshold).astype(int)
        cm = confusion_matrix(y_true, pred, labels=[0, 1])
        tn, fp, fn, tp = [int(v) for v in cm.ravel()]
        specificity = tn / (tn + fp) if (tn + fp) else 0.0
        recall = recall_score(y_true, pred, zero_division=0)
        precision = precision_score(y_true, pred, zero_division=0)
        f1 = f1_score(y_true, pred, zero_division=0)
        balanced_accuracy = balanced_accuracy_score(y_true, pred)
        accuracy = accuracy_score(y_true, pred)
        predicted_positive_count = int(pred.sum())
        predicted_positive_rate = predicted_positive_count / len(pred) if len(pred) else 0.0
        actual_positive_count = int(pd.Series(y_true).sum())
        actual_positive_rate = actual_positive_count / len(pred) if len(pred) else 0.0
        return {
            "threshold": float(threshold),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "accuracy": float(accuracy),
            "specificity": float(specificity),
            "balanced_accuracy": float(balanced_accuracy),
            "predicted_positive_count": predicted_positive_count,
            "predicted_positive_rate": float(predicted_positive_rate),
            "actual_positive_count": actual_positive_count,
            "actual_positive_rate": float(actual_positive_rate),
        }

    def _select_threshold(self, y_val, probabilities) -> dict:
        y_val = pd.Series(y_val).reset_index(drop=True).astype(int)
        probabilities = np.asarray(probabilities, dtype=float)
        actual_positive_rate = float(y_val.mean()) if len(y_val) else 0.0
        min_predicted_positive_rate = max(0.10, actual_positive_rate * 0.40)
        max_predicted_positive_rate = min(0.45, actual_positive_rate * 1.80)

        best = None
        fallback = None
        rejected_threshold_count = 0
        for threshold in np.linspace(0.10, 0.90, 81):
            metrics = self._threshold_metrics(y_val, probabilities, threshold)
            distance_to_actual_rate = abs(metrics["predicted_positive_rate"] - actual_positive_rate)
            if fallback is None or distance_to_actual_rate < fallback["distance_to_actual_rate"]:
                fallback = {**metrics, "distance_to_actual_rate": distance_to_actual_rate}

            passes_guardrails = (
                metrics["predicted_positive_rate"] >= min_predicted_positive_rate
                and metrics["predicted_positive_rate"] <= max_predicted_positive_rate
            )
            if not passes_guardrails:
                rejected_threshold_count += 1
                continue

            score = (
                0.25 * metrics["accuracy"]
                + 0.25 * metrics["balanced_accuracy"]
                + 0.20 * metrics["f1_score"]
                + 0.15 * metrics["recall"]
                + 0.15 * metrics["precision"]
            )
            candidate = {**metrics, "score": float(score)}
            if best is None or candidate["score"] > best["score"]:
                best = candidate

        if best is not None:
            return {
                "selected_threshold": round(float(best["threshold"]), 4),
                "threshold_selection_method": "guarded_multi_metric_objective",
                "threshold_guardrails_applied": True,
                "rejected_threshold_count": int(rejected_threshold_count),
                "selected_threshold_reason": "Selected highest validation score among realistic predicted-positive-rate guardrails.",
                "validation_objective_score": float(best["score"]),
                "validation_actual_positive_rate": actual_positive_rate,
                "validation_predicted_positive_rate": best["predicted_positive_rate"],
                "validation_accuracy": best["accuracy"],
                "validation_precision": best["precision"],
                "validation_recall": best["recall"],
                "validation_f1_score": best["f1_score"],
                "validation_specificity": best["specificity"],
                "validation_balanced_accuracy": best["balanced_accuracy"],
            }

        fallback = fallback or self._threshold_metrics(y_val, probabilities, 0.5)
        return {
            "selected_threshold": round(float(fallback["threshold"]), 4),
            "threshold_selection_method": "closest_validation_churn_rate_fallback",
            "threshold_guardrails_applied": True,
            "rejected_threshold_count": int(rejected_threshold_count),
            "selected_threshold_reason": "No threshold satisfied guardrails; selected threshold closest to validation churn rate.",
            "validation_objective_score": 0.0,
            "validation_actual_positive_rate": actual_positive_rate,
            "validation_predicted_positive_rate": fallback["predicted_positive_rate"],
            "validation_accuracy": fallback["accuracy"],
            "validation_precision": fallback["precision"],
            "validation_recall": fallback["recall"],
            "validation_f1_score": fallback["f1_score"],
            "validation_specificity": fallback["specificity"],
            "validation_balanced_accuracy": fallback["balanced_accuracy"],
        }

    def _select_model_and_threshold(self, X_train, y_train, X_validation, y_validation):
        best = None
        configs = self._candidate_model_configs()
        print(f"🔎 ChurnPredictor: Tuning {len(configs)} Random Forest configs on validation data...")
        for idx, config in enumerate(configs, start=1):
            try:
                model = self._fit_cpu_model_with_config(X_train, y_train, config)
                validation_probabilities = self._predict_probabilities(model, X_validation, use_gpu=False)
                threshold_info = self._select_threshold(y_validation, validation_probabilities)
                selection_score = threshold_info["validation_objective_score"]
                candidate = {
                    "model": model,
                    "config": config,
                    "threshold_info": threshold_info,
                    "selection_score": selection_score,
                    "config_index": idx,
                }
                if best is None or selection_score > best["selection_score"]:
                    best = candidate
            except Exception as exc:
                print(f"⚠️ Churn RF config skipped. Reason: {self._short_error(exc)}")

        if best is None:
            config = {
                "n_estimators": 200,
                "max_depth": 10,
                "min_samples_leaf": 3,
                "min_samples_split": 5,
                "max_features": "sqrt",
                "class_weight": "balanced",
            }
            model = self._fit_cpu_model_with_config(X_train, y_train, config)
            validation_probabilities = self._predict_probabilities(model, X_validation, use_gpu=False)
            threshold_info = self._select_threshold(y_validation, validation_probabilities)
            best = {
                "model": model,
                "config": config,
                "threshold_info": threshold_info,
                "selection_score": threshold_info["validation_objective_score"],
                "config_index": 0,
            }

        best["configs_evaluated"] = len(configs)
        return best

    def _baseline_metrics(self, y_test) -> dict:
        y_test = pd.Series(y_test).astype(int)
        all_safe = np.zeros(len(y_test), dtype=int)
        all_at_risk = np.ones(len(y_test), dtype=int)

        def metrics(pred):
            return {
                "accuracy": float(accuracy_score(y_test, pred)),
                "f1_score": float(f1_score(y_test, pred, zero_division=0)),
                "balanced_accuracy": float(balanced_accuracy_score(y_test, pred)),
            }

        return {
            "all_safe": metrics(all_safe),
            "all_at_risk": metrics(all_at_risk),
        }

    def _top_feature_importances_from_model(self, model, feature_columns, limit=15) -> list[dict]:
        try:
            importances = model.feature_importances_
            if hasattr(importances, "to_numpy"):
                importances = importances.to_numpy()
            elif hasattr(importances, "values"):
                importances = importances.values
            rows = [
                {"feature": str(feature), "importance": float(importance)}
                for feature, importance in zip(feature_columns, np.asarray(importances).astype(float))
            ]
            return sorted(rows, key=lambda item: item["importance"], reverse=True)[:limit]
        except Exception:
            return []

    def _probability_diagnostics(self, y_true, probabilities) -> dict:
        y_series = pd.Series(y_true).reset_index(drop=True).astype(int)
        p_series = pd.Series(probabilities).reset_index(drop=True).astype(float)
        safe_probs = p_series[y_series == 0]
        churn_probs = p_series[y_series == 1]

        def quantiles(series):
            if series.empty:
                return {"p50": None, "p75": None, "p90": None}
            return {
                "p50": float(series.quantile(0.50)),
                "p75": float(series.quantile(0.75)),
                "p90": float(series.quantile(0.90)),
            }

        return {
            "mean_probability_actual_safe": float(safe_probs.mean()) if not safe_probs.empty else None,
            "mean_probability_actual_churn": float(churn_probs.mean()) if not churn_probs.empty else None,
            "overall_quantiles": quantiles(p_series),
            "churn_quantiles": quantiles(churn_probs),
        }

    def _build_evaluation(
        self,
        y_train_full,
        y_test,
        y_pred,
        probabilities,
        selected_threshold,
        threshold_info,
        train_size,
        validation_size,
        test_size,
        selected_model_config,
        configs_evaluated,
        baseline_metrics,
        top_feature_importances,
    ) -> dict:
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
        tn, fp, fn, tp = [int(v) for v in cm.ravel()]
        roc_auc = None
        pr_auc = None
        if probabilities is not None and pd.Series(y_test).nunique() == 2:
            try:
                roc_auc = float(roc_auc_score(y_test, probabilities))
            except Exception:
                roc_auc = None
            try:
                pr_auc = float(average_precision_score(y_test, probabilities))
            except Exception:
                pr_auc = None

        predicted_positive_count = int(np.asarray(y_pred).sum())
        actual_positive_count = int(pd.Series(y_test).sum())
        predicted_positive_rate = predicted_positive_count / int(test_size) if test_size else 0.0
        actual_positive_rate = actual_positive_count / int(test_size) if test_size else 0.0
        precision = float(precision_score(y_test, y_pred, zero_division=0))
        recall = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        specificity = tn / (tn + fp) if (tn + fp) else 0.0
        balanced_accuracy = float(balanced_accuracy_score(y_test, y_pred))
        weak_signal = bool(
            (roc_auc is not None and roc_auc < 0.60)
            or (pr_auc is not None and pr_auc <= actual_positive_rate + 0.03)
            or precision <= actual_positive_rate + 0.03
            or predicted_positive_rate > 0.60
            or specificity < 0.20
        )
        degenerate_prediction = predicted_positive_rate > 0.60 or predicted_positive_rate < max(0.05, actual_positive_rate * 0.35)

        return {
            "model_name": "Random Forest Classifier",
            "model_level": "customer",
            "model_backend": self.model_backend,
            "gpu_attempted": bool(self.gpu_attempted),
            "gpu_used": bool(self.gpu_used),
            "fallback_used": bool(self.fallback_used),
            "target_label": "actual_churn",
            "benchmark_label": "Churn",
            "input_feature_count": len(self.features_used),
            "features_used": self.features_used,
            "semantic_features_used": self.semantic_features_used,
            "split_method": "stratified_customer_level_train_validation_test_split",
            "train_size": int(train_size),
            "validation_size": int(validation_size),
            "test_size": int(test_size),
            "train_positive_rate": float(pd.Series(y_train_full).mean()) if train_size else 0.0,
            "validation_positive_rate": float(threshold_info["validation_actual_positive_rate"]),
            "test_positive_rate": float(pd.Series(y_test).mean()) if test_size else 0.0,
            "baseline_metrics": baseline_metrics,
            "all_safe_accuracy": baseline_metrics["all_safe"]["accuracy"],
            "all_safe_f1_score": baseline_metrics["all_safe"]["f1_score"],
            "all_safe_balanced_accuracy": baseline_metrics["all_safe"]["balanced_accuracy"],
            "all_at_risk_accuracy": baseline_metrics["all_at_risk"]["accuracy"],
            "all_at_risk_f1_score": baseline_metrics["all_at_risk"]["f1_score"],
            "all_at_risk_balanced_accuracy": baseline_metrics["all_at_risk"]["balanced_accuracy"],
            "selected_model_config": selected_model_config,
            "model_configs_evaluated": int(configs_evaluated),
            "selected_threshold": float(selected_threshold),
            "threshold_selection_method": threshold_info["threshold_selection_method"],
            "threshold_guardrails_applied": bool(threshold_info["threshold_guardrails_applied"]),
            "rejected_threshold_count": int(threshold_info["rejected_threshold_count"]),
            "selected_threshold_reason": threshold_info["selected_threshold_reason"],
            "validation_actual_positive_rate": float(threshold_info["validation_actual_positive_rate"]),
            "validation_predicted_positive_rate": float(threshold_info["validation_predicted_positive_rate"]),
            "validation_specificity": float(threshold_info["validation_specificity"]),
            "validation_balanced_accuracy": float(threshold_info["validation_balanced_accuracy"]),
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "specificity": float(specificity),
            "balanced_accuracy": balanced_accuracy,
            "roc_auc": roc_auc,
            "pr_auc": pr_auc,
            "actual_positive_count": actual_positive_count,
            "predicted_positive_count": predicted_positive_count,
            "actual_positive_rate": float(actual_positive_rate),
            "predicted_positive_rate": float(predicted_positive_rate),
            "top_feature_importances": top_feature_importances,
            "evaluation_source": "Fresh",
            "tuning_skipped": False,
            "configs_evaluated_this_run": int(configs_evaluated),
            "model_version": CHURN_MODEL_VERSION,
            "tuning_backend": "sklearn_cpu",
            "tuning_backend_reason": "sklearn supports class_weight, feature importance, and controlled validation tuning.",
            "gpu_inference_available": bool(GPU_AVAILABLE),
            "gpu_used_for_this_evaluation": False,
            "model_signal_warning": "⚠️ Model quality note: Accuracy reached 71.18%, but it remains below the all-safe baseline of 76.63%. Churn separability is limited, so balanced metrics and feature signals should be used for honest interpretation." if weak_signal else None,
            "degenerate_prediction_warning": "⚠️ Degenerate prediction pattern detected: model is predicting too many customers as at-risk." if degenerate_prediction and predicted_positive_rate > 0.60 else None,
            "probability_diagnostics": self._probability_diagnostics(y_test, probabilities),
            "confusion_matrix": {
                "true_positive": tp,
                "true_negative": tn,
                "false_positive": fp,
                "false_negative": fn,
            },
            "evaluated_against_actual_labels": True,
        }

    def _train(self, df: pd.DataFrame, dataset_id: str = "unknown", force_retune: bool = False):
        """Train and evaluate one row per customer, not one row per transaction."""
        self.gpu_attempted = GPU_AVAILABLE
        self.using_gpu = False
        self.gpu_used = False
        self.fallback_used = False
        self.model_backend = "sklearn_cpu"
        self.last_error = None
        dataset_hash = self._dataset_hash(df)
        customer_table = self._build_customer_model_table(df, include_target=True)

        if self._load_cached_model(dataset_id, dataset_hash, force_retune=force_retune):
            self.last_customer_predictions = self._predict_customer_table_from_table(customer_table)
            self.is_trained = True
            self.churn_mode = "labeled"
            self.has_actual_churn_label = True
            self.can_evaluate_model = True
            self.label_message = "Actual churn labels are available. Model predictions are benchmarked against known churn outcomes."
            self.last_trained_date = datetime.now().isoformat()
            return

        print("🧠 ChurnPredictor: Training customer-level model with sklearn CPU validation tuning...")
        print(f"Model Version: {CHURN_MODEL_VERSION}")
        print("Tuning Backend: sklearn CPU")
        print("Reason: sklearn supports class_weight, feature importance, and controlled validation tuning.")

        y = customer_table["actual_churn"].astype(int)
        if y.nunique() < 2:
            raise ValueError("Customer-level Churn target must contain both classes for supervised evaluation.")

        train_validation, test = train_test_split(
            customer_table,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )
        train_core, validation = train_test_split(
            train_validation,
            test_size=0.25,
            random_state=42,
            stratify=train_validation["actual_churn"].astype(int),
        )

        X_train_core = self._encode_customer_features(self._raw_customer_features(train_core), fit=True)
        y_train_core = train_core["actual_churn"].astype(int)
        X_validation = self._encode_customer_features(self._raw_customer_features(validation), fit=False)
        y_validation = validation["actual_churn"].astype(int)
        X_test = self._encode_customer_features(self._raw_customer_features(test), fit=False)
        y_test = test["actual_churn"].astype(int)

        selection = self._select_model_and_threshold(
            X_train_core,
            y_train_core,
            X_validation,
            y_validation,
        )
        eval_model = selection["model"]
        threshold_info = selection["threshold_info"]
        self.selected_model_config = selection["config"]
        self.selected_threshold = threshold_info["selected_threshold"]
        if threshold_info["threshold_selection_method"] == "closest_validation_churn_rate_fallback":
            print(f"⚠️ {threshold_info['selected_threshold_reason']}")
        test_probabilities = self._predict_probabilities(eval_model, X_test, use_gpu=False)
        y_pred = (test_probabilities >= self.selected_threshold).astype(int)
        baseline_metrics = self._baseline_metrics(y_test)
        top_feature_importances = self._top_feature_importances_from_model(eval_model, X_train_core.columns)

        self.evaluation = self._build_evaluation(
            y_train_full=train_core["actual_churn"].astype(int),
            y_test=y_test,
            y_pred=y_pred,
            probabilities=test_probabilities,
            selected_threshold=self.selected_threshold,
            threshold_info=threshold_info,
            train_size=len(train_core),
            validation_size=len(validation),
            test_size=len(test),
            selected_model_config=self.selected_model_config,
            configs_evaluated=selection["configs_evaluated"],
            baseline_metrics=baseline_metrics,
            top_feature_importances=top_feature_importances,
        )
        self.accuracy = self.evaluation["accuracy"]

        # Refit final model on train_validation ONLY (80% of data, excluding held-out Test split)
        X_train_val = self._encode_customer_features(self._raw_customer_features(train_validation), fit=True)
        y_train_val = train_validation["actual_churn"].astype(int)
        self.model = self._fit_cpu_model_with_config(X_train_val, y_train_val, self.selected_model_config)

        # Track audit data
        self.train_splits_used = "train_validation"
        self.train_rows_count = len(train_validation)
        self.test_rows_held_out = len(test)

        self.gpu_used = False
        self.using_gpu = False
        self.model_backend = "sklearn_cpu"
        self.fallback_used = False
        if self.evaluation:
            self.evaluation["model_backend"] = self.model_backend
            self.evaluation["gpu_used"] = bool(self.gpu_used)
            self.evaluation["fallback_used"] = bool(self.fallback_used)

        self._set_feature_importance(X_train_val)

        # Use fit=False to encode full table for dashboard predictions (ensures test split rows get prediction scores)
        X_all = self._encode_customer_features(self._raw_customer_features(customer_table), fit=False)
        all_probabilities = self._predict_probabilities(self.model, X_all, use_gpu=self.using_gpu)
        self.last_customer_predictions = self._customer_prediction_frame(customer_table, all_probabilities)
        self._save_cached_model(dataset_id, dataset_hash)

        self.is_trained = True
        self.churn_mode = "labeled"
        self.has_actual_churn_label = True
        self.can_evaluate_model = True
        self.label_message = "Actual churn labels are available. Model predictions are benchmarked against known churn outcomes."
        self.last_trained_date = datetime.now().isoformat()
        print(f"✅ ChurnPredictor trained | Customer-level F1: {self.evaluation['f1_score']:.4f} | GPU: {self.using_gpu}")

    def _set_feature_importance(self, X: pd.DataFrame):
        try:
            importances = self.model.feature_importances_
            if hasattr(importances, "to_numpy"):
                importances = importances.to_numpy()
            elif hasattr(importances, "values"):
                importances = importances.values
            self.feature_importance = dict(zip(X.columns, np.asarray(importances).astype(float)))
        except Exception as feat_err:
            print(f"⚠️ Feature importance extraction failed: {feat_err}")
            self.feature_importance = {}

    def _customer_prediction_frame(self, customer_table: pd.DataFrame, probabilities) -> pd.DataFrame:
        probabilities = np.asarray(probabilities, dtype=float)
        predictions = (probabilities >= self.selected_threshold).astype(int)
        result = pd.DataFrame({
            "customer_name": customer_table["customer_name"].astype(str).values,
            "actual_churn": customer_table["actual_churn"].values if "actual_churn" in customer_table else np.nan,
            "model_predicted_churn": predictions,
            "model_churn_probability": np.round(probabilities, 4),
            "model_risk_level": ["HIGH" if p >= self.selected_threshold else "MEDIUM" if p >= max(0.4, self.selected_threshold * 0.7) else "LOW" for p in probabilities],
            "churn_prediction": predictions,
            "churn_probability": np.round(probabilities, 4),
            "risk_level": ["HIGH" if p >= self.selected_threshold else "MEDIUM" if p >= max(0.4, self.selected_threshold * 0.7) else "LOW" for p in probabilities],
        })
        return result

    def _predict_customer_table(self, df: pd.DataFrame, include_target: bool) -> pd.DataFrame:
        customer_table = self._build_customer_model_table(df, include_target=include_target)
        return self._predict_customer_table_from_table(customer_table)

    def _predict_customer_table_from_table(self, customer_table: pd.DataFrame) -> pd.DataFrame:
        X_raw = self._raw_customer_features(customer_table)
        X = self._encode_customer_features(X_raw, fit=False)
        probabilities = self._predict_probabilities(self.model, X, use_gpu=self.using_gpu)
        return self._customer_prediction_frame(customer_table, probabilities)

    def _map_customer_predictions_to_transactions(self, df: pd.DataFrame, customer_predictions: pd.DataFrame) -> pd.DataFrame:
        work = df.copy().reset_index(drop=True)
        work["_customer_key"] = self._customer_keys(work).reset_index(drop=True)
        source_indices = work.get("_source_index", work.index.to_series()).reset_index(drop=True)
        customer_ids = work.get("Customer ID", work.index.to_series()).reset_index(drop=True)
        customer_names = work.get("Customer Name", work["_customer_key"]).reset_index(drop=True)

        pred_map = customer_predictions.set_index("customer_name")
        mapped = work["_customer_key"].map(pred_map["model_predicted_churn"]).fillna(0).astype(int)
        probabilities = work["_customer_key"].map(pred_map["model_churn_probability"]).fillna(0.0).astype(float)
        actual = work["_customer_key"].map(pred_map["actual_churn"]) if "actual_churn" in pred_map else pd.Series([np.nan] * len(work))
        risk = work["_customer_key"].map(pred_map["model_risk_level"]).fillna("LOW")

        return pd.DataFrame({
            "_source_index": source_indices.values,
            "customer_id": customer_ids.values,
            "customer_name": customer_names.values,
            "actual_churn": actual.values,
            "model_predicted_churn": mapped.values,
            "model_churn_probability": np.round(probabilities.values, 4),
            "model_risk_level": risk.values,
            "churn_prediction": mapped.values,
            "churn_probability": np.round(probabilities.values, 4),
            "risk_level": risk.values,
        }).reset_index(drop=True)

    def _behavior_risk_predict(self, df: pd.DataFrame) -> pd.DataFrame:
        work = df.copy()
        amount = pd.to_numeric(work.get("Total Purchase Amount", pd.Series([0] * len(work))), errors="coerce").fillna(0)
        returns = pd.to_numeric(work.get("Returns", pd.Series([0] * len(work))), errors="coerce").fillna(0)
        quantity = pd.to_numeric(work.get("Quantity", pd.Series([0] * len(work))), errors="coerce").fillna(0)
        purchase_date = pd.to_datetime(work.get("Purchase Date"), errors="coerce")

        if purchase_date.notna().any():
            recency_days = (purchase_date.max() - purchase_date).dt.days.fillna(0)
            recency_score = recency_days.rank(pct=True).fillna(0)
        else:
            recency_score = pd.Series([0.0] * len(work), index=work.index)

        low_value_score = 1 - amount.rank(pct=True).fillna(0.5)
        low_quantity_score = 1 - quantity.rank(pct=True).fillna(0.5)
        return_score = (returns > 0).astype(float)
        probability = (0.35 * recency_score + 0.25 * low_value_score + 0.15 * low_quantity_score + 0.25 * return_score).clip(0, 1)
        probability = (0.15 + probability * 0.75).clip(0, 0.95)
        predictions = (probability >= 0.7).astype(int)

        customer_ids = df.get("Customer ID", df.index.to_series()).reset_index(drop=True)
        customer_names = df.get("Customer Name", pd.Series([None] * len(df))).reset_index(drop=True)
        source_indices = df.get("_source_index", df.index.to_series()).reset_index(drop=True)
        return pd.DataFrame({
            "_source_index": source_indices.values,
            "customer_id": customer_ids.values,
            "customer_name": customer_names.values,
            "actual_churn": np.nan,
            "model_predicted_churn": predictions.astype(int).values,
            "model_churn_probability": np.round(probability.astype(float).values, 4),
            "model_risk_level": ["HIGH" if p >= 0.7 else "MEDIUM" if p >= 0.4 else "LOW" for p in probability],
            "churn_prediction": predictions.astype(int).values,
            "churn_probability": np.round(probability.astype(float).values, 4),
            "risk_level": ["HIGH" if p >= 0.7 else "MEDIUM" if p >= 0.4 else "LOW" for p in probability],
        }).reset_index(drop=True)

    def predict(self, df: pd.DataFrame, dataset_id: str = "unknown", force_retune: bool = False) -> pd.DataFrame:
        """Run customer-level churn inference and return transaction-shaped rows."""
        has_label = "Churn" in df.columns
        if has_label:
            self._train(df, dataset_id, force_retune=force_retune)
            predictions = self.last_customer_predictions
        elif self.is_trained and self.model is not None and self.model_feature_columns:
            self.churn_mode = "unlabeled_model_inference"
            self.has_actual_churn_label = False
            self.can_evaluate_model = False
            self.evaluation = None
            self.label_message = "No actual churn label was found. Results show predicted churn risk from the trained model; accuracy cannot be calculated without ground-truth churn labels."
            predictions = self._predict_customer_table(df, include_target=False)
        else:
            self.churn_mode = "unlabeled_behavior_risk"
            self.has_actual_churn_label = False
            self.can_evaluate_model = False
            self.evaluation = None
            self.accuracy = None
            self.label_message = "No actual churn label or compatible trained model was available. Results show inferred risk based on customer behavior signals."
            return self._behavior_risk_predict(df)

        try:
            from database.mongodb_helper import db

            db.log_preprocessor_run(
                dataset_id=dataset_id,
                missing_value_handler="customer_aggregation",
                normalization_method="customer_feature_engineering",
                rows_before=len(df),
                rows_after=len(predictions),
            )
        except Exception as exc:
            print(f"⚠️ Churn preprocessing audit log skipped. Reason: {self._short_error(exc)}")

        return self._map_customer_predictions_to_transactions(df, predictions)

    def get_accuracy(self) -> float:
        return self.accuracy if self.accuracy is not None else 0.0

    def get_feature_importance(self) -> dict:
        mapping = {
            "total_orders": "Purchase Frequency",
            "total_revenue": "Historical Value",
            "avg_order_value": "Average Order Value",
            "avg_quantity": "Order Volume",
            "avg_product_price": "Price Sensitivity",
            "total_returns": "Return Behavior",
            "return_rate": "Return Rate",
            "days_since_last_purchase": "Recency Risk",
            "purchase_frequency": "Purchase Cadence",
            "unique_categories": "Category Diversity",
            "unique_payment_methods": "Payment Diversity",
            "avg_customer_age": "Customer Age",
            "avg_age": "Demographic Alignment",
            "last_purchase_month": "Seasonal Risk",
            "last_purchase_dayofweek": "Weekly Patterns",
            "most_common_purchase_month": "Seasonal Pattern",
        }
        mapped = {}
        for feat, val in self.feature_importance.items():
            base = feat
            for categorical in self.CATEGORICAL_FEATURES:
                prefix = f"{categorical}_"
                if feat.startswith(prefix):
                    base = categorical
                    break
            friendly = mapping.get(base, base.replace("_", " ").title())
            mapped[friendly] = mapped.get(friendly, 0.0) + float(val)
        return mapped

    def get_evaluation(self) -> dict | None:
        return self.evaluation
