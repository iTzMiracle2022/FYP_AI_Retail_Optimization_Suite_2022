# 🌌 Retail AI Suite

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![ThreeJS](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)

Retail AI Suite is a full-stack, enterprise-grade decision support platform designed to optimize retail operations. It combines an asynchronous Flask/MongoDB backend, automated machine-learning pipelines, and an interactive Vite/React dashboard for predicting customer churn, forecasting inventory demand, NLP-enhanced marketing segmentation, and revenue reporting.

---

## 🏗️ System Architecture

The application is structured as a decoupled Single Page Application (SPA) communicating over a secure JSON REST API, backed by MongoDB for raw transactions and cache storage, and SQLite for lightweight ERP connections:

```mermaid
graph TD
    subgraph Frontend ["Vite + React 18 Client"]
        UI["Dashboard UI / Pages"]
        Charts["Recharts / ApexCharts"]
        API_Client["Axios API Client"]
        Three["Three.js 3D Interactive Canvas"]
    end

    subgraph Backend ["Flask REST API Service"]
        Auth["Auth Blueprint / JWT Credentials"]
        Routes["Module REST Blueprints"]
        ML_Pipelines["ML Pipelines / Predictors"]
        Cache["Model Inference Cache"]
    end

    subgraph Database ["Storage Layer"]
        MongoDB[("MongoDB Core DB")]
        SQLite[("erp_sample.db SQLite Demo")]
    end

    UI --> Charts
    UI --> Three
    UI --> API_Client
    API_Client <-->|HTTP REST / JSON| Routes
    Routes <--> ML_Pipelines
    ML_Pipelines <--> Cache
    Routes <--> MongoDB
    Routes <--> SQLite
    Auth <--> MongoDB
```

---

## ⚙️ Data & Machine Learning Workflow

The data workflow automates cleaning raw retail streams and deploying models to a local inference cache:

```mermaid
flowchart TD
    RawCSV[Raw CSV Datasets] --> Preprocess[data_preprocessing.py]
    Preprocess --> ProcessedCSV[Clean Processed CSVs]
    
    subgraph Model_Training ["ML Model Pipelines"]
        ProcessedCSV --> Churn[RandomForest Churn Predictor]
        ProcessedCSV --> Forecast[ARIMA Inventory Forecaster]
        ProcessedCSV --> NLP[NLP + KMeans Marketing Clustering]
    end
    
    Churn --> ChurnCache[("Churn Cache (.joblib)")]
    Forecast --> ForecastCache[("Forecast Cache (.json)")]
    NLP --> NLPCache[("NLP Cache (.json)")]
    
    subgraph API_Layer ["Flask REST API Blueprint"]
        ChurnCache --> ChurnRoutes[churn_routes.py]
        ForecastCache --> InvRoutes[inventory_routes.py]
        NLPCache --> MarkRoutes[marketing_routes.py]
    end

    subgraph UI_Layer ["Vite / React Dashboard"]
        ChurnRoutes --> ChurnUI[Churn Predictive List]
        InvRoutes --> InvUI[Inventory Demand UI]
        MarkRoutes --> MarkUI[Marketing Cohorts UI]
    end
```

---

## ⚡ Core Modules

- **🔮 Customer Churn Analytics:** Evaluates customer-level churn risk metrics using a `RandomForestClassifier` pipeline, generating retention risk signals, behavior summaries, and active CRM list filtering.
- **📈 Inventory Demand Forecasting:** Predicts upcoming inventory stock requirements using `ARIMA` time-series models, providing visual indicators of stockout risks, safety thresholds, and reorder signals.
- **🎯 Marketing Clustering & NLP:** Identifies customer clusters using `K-Means` clustering on Recency, Frequency, Monetary (RFM) metrics, paired with an NLP sentiment classifier analyzing feedback text.
- **📊 Revenue Analysis:** Processes transaction streams to generate sales analysis charts, sales trends, category performance, and enterprise ERP sync status.

---

## 📂 Project Directory Structure

```txt
fyp_codex_safe/
├── backend/
│   ├── api/             # Flask endpoints (Blueprints)
│   ├── database/        # DB connections and data seeders
│   ├── models/          # Churn, Inventory, and Marketing ML modules
│   ├── utils/           # Preprocessing and chart formatters
│   ├── data/            # Demo datasets (CSV)
│   ├── cache/           # Inference cache targets (.joblib/.json)
│   ├── reports/         # Detailed model audit & evaluation reports
│   └── app.py           # Application bootstrapper
├── frontend/
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── api/         # Axios API connectors
│   │   ├── components/  # Layouts, Auth, Tables, and Reusable charts
│   │   ├── context/     # App settings & authentication state
│   │   └── pages/       # Dashboards and marketing pages
│   ├── package.json     # Node configurations
│   └── vite.config.js   # Vite server settings
├── docs/
│   ├── architecture/    # System design guides & setups
│   ├── screenshots/     # Final UI screenshots
│   ├── SOFTWARE_TEST_PLAN.md
│   └── TEST_CASES.md
└── README.md
```

---

## 🚀 Getting Started

### Backend Setup (Flask)

1. Navigate to the backend directory and activate your virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```
2. Install the backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   python app.py
   ```
   *Note: Environment dependencies can be further refined with `requirements-gpu.txt` for GPU acceleration or `requirements-nlp.txt` for text parsing models.*

### Frontend Setup (Vite / React)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm modules:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
4. Build the production package:
   ```bash
   npm run build
   ```

---

## 🔒 Security & Ignored Artifacts
- **Secrets:** Raw credentials, JWT secret keys, and MongoDB URIs are configured in the root `.env` file (ignored by Git).
- **Databases:** Local SQLite databases (`*.db`, `*.sqlite`, `backend/erp_sample.db`) are excluded from repository history.
- **Cache:** Pre-trained model caches (`*.joblib`, `*.pkl`) are kept locally and not uploaded to GitHub.
