# 📘 API Reference — AI Retail Optimization Suite

Authoritative copy of the backend API. **Base URL:** `http://localhost:5000`

> This copy is kept under `docs/architecture/` after repository cleanup.

---

## System

- **GET** `/api/health` — Health and DB check.
- **GET** `/api/analytics/stats` — Audit logs / analytics aggregates.

## Datasets

- **POST** `/api/datasets/upload` — `multipart/form-data` (CSV/Excel).
- **GET** `/api/datasets/` — List datasets.
- **GET** `/api/datasets/<dataset_id>` — Dataset metadata.
- **DELETE** `/api/datasets/<dataset_id>` — Delete dataset and file.

## Churn

- **POST** `/api/churn/predict` — Body: `{ "dataset_id": "<id>" }`.
- **GET** `/api/churn/history/<dataset_id>` — History.
- **GET** `/api/churn/stats` — Model stats.

## Inventory

- **POST** `/api/inventory/forecast` — Body: `{ "dataset_id": "<id>", "forecast_days": 30 }`.
- **GET** `/api/inventory/history/<dataset_id>` — History.
- **GET** `/api/inventory/alerts` — Alerts.

## Marketing (RFM + TF-IDF NLP + K-Means)

- **POST** `/api/marketing/analyze` — Body: `{ "dataset_id": "<id>", "n_clusters": 4 }` (`num_clusters` accepted as alias).

## Sales

- **POST** `/api/sales/trends` — Body: `{ "dataset_id": "<id>", "category": null, "time_period": "30d" }`.
- **GET** `/api/sales/categories/<dataset_id>` — Category list.

## Reports

- **POST** `/api/reports/export/<type>/<format>` — `csv` or `pdf`; body includes `data` array.
- **GET** `/api/reports/list` — Optional `?dataset_id=`.
- **GET** `/api/reports/ml-history` — Optional `?dataset_id=`.
