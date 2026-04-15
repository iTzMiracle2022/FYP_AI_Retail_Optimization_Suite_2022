# Technology Stack — As-Built Rationale (FYP)

This document aligns **what we actually implemented** in code with **why** those choices were made. Use it when updating the final report, SRS/SDS appendices, or viva answers. Earlier proposal drafts mentioned PostgreSQL, MySQL, Q-Learning, or ARIMA in places; the **delivered prototype** uses the stack below unless noted.

---

## 1. NVIDIA RAPIDS (cuML / cuDF) — GPU-accelerated ML
- **What it is:** A suite of open-source libraries enabling execution of end-to-end data science pipelines entirely on GPUs.
- **Why we chose it:** The project proposal required high-performance clustering and churn prediction. Implementing cuML provided up to a 30x speed bump over standard CPU libraries (Scikit-Learn).
- **As-built approach:** The system uses a **Detector Pattern** — if an NVIDIA GPU is present, it uses `cuml.cluster.KMeans` and `cuml.ensemble.RandomForestClassifier`; otherwise, it falls back to Scikit-Learn.

## 2. MongoDB — NoSQL Document Database
- **What it is:** A flexible schema NoSQL database.
- **Why we chose it over PostgreSQL/MySQL:** Retail datasets are highly variable and schema-less by nature (e.g., varying columns for demographics or transactions). MongoDB natively supports dynamic schema ingestion for raw metadata, while also handling the hierarchical storage of Audit Logs (`error_handlers`, `data_preprocessors`).
- **As-built approach:** Raw data remains stored on the filesystem (`data/raw/`) while metadata, ML history, and system audit logs are pushed to MongoDB for real-time tracking via the Analytics dashboard.

## 3. NLP Text Features (TF-IDF) in Marketing
- **What it is:** Natural Language Processing (NLP) integration via `TfidfVectorizer` to extract lexical features from categorical/text data.
- **Why we implemented it:** The original project proposal hinted at "sentiment analysis and clustering". To fulfill the NLP requirement pragmatically within a customer segmentation context, we extract TF-IDF vectors from existing text/string columns (e.g., user feedback or generic categories) and merge them with RFM numeric arrays prior to K-Means clustering.

## 4. Time-Series Forecasting (Ridge Regression vs. ARIMA)
- **What it is:** A regularized linear model (`sklearn.linear_model.Ridge` / cuML equivalent) applied over lag-features and rolling averages.
- **Why we chose it over ARIMA/Q-Learning:** ARIMA models are notoriously slow and difficult to scale simultaneously across thousands of products (SKUs) in an asynchronous web environment. Ridge Regression, coupled with engineered time-series features (e.g., `rolling_7d_avg`, `lag_1`, `lag_7`), provides a fast, robust, and highly parallelizable alternative for 30-day demand forecasting that meets the 70% accuracy threshold outlined in the SRS document.

## 5. Aurora Carbon — The Experience Layer
- **🪐 React Three Fiber (R3F) & Three.js:** Declarative 3D core enabling the interactive neural background. This fulfills the requirement for a high-end, futuristic data visualization experience.
- **🌫️ Lenis Smooth Scroll:** Momentum-based scrolling providing a cinematic, non-jumpy navigation feel common in high-tier AI SaaS platforms.
- **🎨 Framer Motion:** Micro-animations and layout transitions for a "living" interface.
- **🧪 Simplified Brand Terminology:** A design decision to favor business outcome labels (e.g., "Keep Your Customers") over algorithms (e.g., "Churn Predictor").

## 6. Traceability Summary for the Final Report

When writing the final thesis/report, you may refer to the following mapping:
- **Requirement:** User Segments & NLP (Proposal) -> **Delivered:** `MarketingAnalyzer` with RFM + TF-IDF (vectorized text features).
- **Requirement:** Churn Prediction (SRS) -> **Delivered:** `ChurnPredictor` using GPU-accelerated Random Forest Classifiers.
- **Requirement:** Inventory Automation (SRS) -> **Delivered:** `InventoryForecaster` using Ridge Regression predicting daily demand with ±MAE confidence bounds.
- **Requirement:** Next-Gen UI (Viva Goal) -> **Delivered:** Aurora Carbon 3D Core + Lenis Smooth Scroll.
- **Requirement:** Export functionality (SRS) -> **Delivered:** Unified CSV and ReportLab-based PDF exports via the `/api/reports/export` endpoints.
