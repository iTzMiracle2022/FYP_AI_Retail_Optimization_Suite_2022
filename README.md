# 🌌 Retail AI Suite

<p align="center">
  <b>AI-Powered Retail Optimization Dashboard</b><br/>
  Customer Churn Prediction • Inventory Forecasting • Marketing Segmentation • Sales Analytics
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Vite-Frontend-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-Backend-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-AI%20%26%20Data-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Database-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Scikit--Learn-ML-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white" />
  <img src="https://img.shields.io/badge/Pandas-Data%20Processing-150458?style=for-the-badge&logo=pandas&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Visuals-000000?style=for-the-badge&logo=three.js&logoColor=white" />
</p>

---

## 📌 Project Overview

**Retail AI Suite** is a full-stack AI-based decision support platform designed to optimize retail business operations. It combines a **Flask backend**, **MongoDB-based application storage**, **CSV-powered analytics datasets**, automated **machine learning pipelines**, and an interactive **Vite + React dashboard**.

The system helps retail businesses analyze sales performance, predict customer churn, forecast inventory demand, and segment customers for marketing decisions.

---

## ✨ Key Features

* 🔮 **Customer Churn Prediction**
  Identifies safe and at-risk customers using machine learning and customer behavior analysis.

* 📦 **Inventory Demand Forecasting**
  Forecasts product demand, detects low-stock risks, and supports reorder planning.

* 🎯 **Marketing Segmentation**
  Groups customers into meaningful segments using K-Means clustering and customer profile analysis.

* 📊 **Sales Analytics**
  Provides revenue insights, sales trends, category performance, and dashboard-ready KPIs.

* 📁 **CSV Dataset Processing**
  Reads, cleans, preprocesses, and analyzes retail datasets.

* ⚡ **Model Caching**
  Stores reusable model outputs and inference results to improve performance.

* 🔐 **Authentication System**
  Supports login, registration, protected routes, and user-based access flow.

* 📈 **Interactive Dashboard**
  Displays KPIs, charts, tables, reports, and business insights using a modern React interface.

---

## 🏗️ System Architecture

The application is structured as a decoupled Single Page Application that communicates with a Flask backend using JSON-based REST APIs. MongoDB is used for application and user-related data, SQLite is used for lightweight ERP/sample integration, and CSV datasets are used for analytics and machine-learning workflows.

```mermaid
flowchart TD
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px,color:#111;
    classDef layer fill:#f4f7f9,stroke:#005A9C,stroke-width:2px,color:#005A9C,font-weight:bold;
    classDef module fill:#eef9ff,stroke:#007acc,stroke-width:1.5px,color:#007acc;

    subgraph Frontend ["Vite + React 18 Client"]
        direction LR
        UI["Dashboard UI / Pages"]
        Axios["Axios API Client"]
        Charts["Recharts Charts"]
        Three["Three.js Landing Visuals"]
        UI ~~~ Axios ~~~ Charts ~~~ Three
    end

    HTTP["HTTP REST / JSON"]

    subgraph Backend ["Flask REST API Service"]
        direction TB

        subgraph CoreServices ["Core Services"]
            direction LR
            Auth["Auth Routes / JWT Credentials"]
            Blueprints["Module REST Blueprints"]
            Reports["Reports / Export APIs"]
            Auth ~~~ Blueprints ~~~ Reports
        end

        subgraph Routes ["REST Route Files"]
            direction LR
            SalesRoutes["sales_routes.py"]
            ChurnRoutes["churn_routes.py"]
            InvRoutes["inventory_routes.py"]
            MarkRoutes["marketing_routes.py"]
            SalesRoutes ~~~ ChurnRoutes ~~~ InvRoutes ~~~ MarkRoutes
        end

        subgraph MLCache ["ML Pipeline & Cache"]
            direction LR
            ML["ML Pipelines / Predictors"]
            Cache["Model Inference Cache"]
            ML --> Cache
        end

        Blueprints --> Routes
        Routes --> ML
    end

    subgraph Storage ["Storage Layer"]
        direction LR
        Mongo["MongoDB Core DB"]
        SQLite["erp_sample.db SQLite Demo"]
        CSV["CSV Datasets"]
    end

    subgraph AI_Modules ["AI / Business Modules"]
        direction LR
        SalesMod["Sales Analytics"]
        ChurnMod["Churn Prediction"]
        InvMod["Inventory Forecasting"]
        MarkMod["Marketing Segmentation"]
    end

    Frontend --> HTTP
    HTTP --> Backend
    Backend --> Storage
    Backend --> AI_Modules

    class Frontend,Backend,CoreServices,Routes,MLCache,Storage,AI_Modules layer;
    class UI,Axios,Charts,Three,HTTP,Auth,Blueprints,Reports,SalesRoutes,ChurnRoutes,InvRoutes,MarkRoutes,ML,Cache,Mongo,SQLite,CSV,SalesMod,ChurnMod,InvMod,MarkMod module;
```

---

## ⚙️ Data & Machine Learning Workflow

The data workflow starts from raw CSV datasets, applies preprocessing, runs module-specific analytics or machine-learning pipelines, stores reusable inference outputs in local cache files, and returns dashboard-ready KPIs, charts, tables, and reports through Flask API routes.

```mermaid
flowchart TD
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px,color:#111;
    classDef layer fill:#f4f7f9,stroke:#005A9C,stroke-width:2px,color:#005A9C,font-weight:bold;
    classDef module fill:#eef9ff,stroke:#007acc,stroke-width:1.5px,color:#007acc;

    Start["Raw CSV Datasets"] --> Preprocess["backend/utils/data_preprocessing.py"]
    Preprocess --> CleanDF["Clean / Processed DataFrames"]

    subgraph Model_Pipelines ["Model / Processing Pipelines"]
        direction LR
        SalesEngine["Sales Analytics Engine"]
        ChurnPredictor["Random Forest Churn Predictor"]
        InvForecaster["Inventory Demand Forecaster"]
        MarkClustering["NLP + K-Means Marketing Clustering"]
        SalesEngine ~~~ ChurnPredictor ~~~ InvForecaster ~~~ MarkClustering
    end

    CleanDF --> SalesEngine
    CleanDF --> ChurnPredictor
    CleanDF --> InvForecaster
    CleanDF --> MarkClustering

    subgraph API_Cache_Layer ["Flask REST API Blueprints + Cache Layer"]
        direction LR

        subgraph SalesGroup ["Sales"]
            direction TB
            SalesCache["Sales KPI Cache"]
            SalesRoutes2["sales_routes.py"]
            SalesCache --> SalesRoutes2
        end

        subgraph ChurnGroup ["Churn"]
            direction TB
            ChurnCache["Churn Cache (.joblib)"]
            ChurnRoutes2["churn_routes.py"]
            ChurnCache --> ChurnRoutes2
        end

        subgraph InvGroup ["Inventory"]
            direction TB
            ForecastCache["Forecast Cache (.json)"]
            InvRoutes2["inventory_routes.py"]
            ForecastCache --> InvRoutes2
        end

        subgraph MarkGroup ["Marketing"]
            direction TB
            NLPCache["NLP Cache (.json)"]
            MarkRoutes2["marketing_routes.py"]
            NLPCache --> MarkRoutes2
        end
    end

    SalesEngine --> SalesCache
    ChurnPredictor --> ChurnCache
    InvForecaster --> ForecastCache
    MarkClustering --> NLPCache

    subgraph Dashboard_Layer ["Vite / React Dashboard"]
        direction LR
        SalesUI["Sales Analytics UI"]
        ChurnUI["Churn Risk Dashboard"]
        InvUI["Inventory Demand UI"]
        MarkUI["Marketing Segmentation Dashboard"]
        SalesUI ~~~ ChurnUI ~~~ InvUI ~~~ MarkUI
    end

    SalesRoutes2 --> SalesUI
    ChurnRoutes2 --> ChurnUI
    InvRoutes2 --> InvUI
    MarkRoutes2 --> MarkUI

    subgraph Output_Data ["Dashboard Outputs"]
        direction LR
        KPIs["KPIs"]
        SalesTrends["Sales Trends"]
        ChurnRisk["Customer Risk Insights"]
        Tables["Tables"]
        InvForecast["Inventory Demand Forecast"]
        Reports2["Reports"]
        MarkSegments["Marketing Customer Segments"]
        Charts2["Charts (Recharts)"]
    end

    SalesUI --> KPIs
    SalesUI --> SalesTrends

    ChurnUI --> ChurnRisk
    ChurnUI --> Tables

    InvUI --> InvForecast
    InvUI --> Reports2

    MarkUI --> MarkSegments
    MarkUI --> Charts2

    class Model_Pipelines,API_Cache_Layer,SalesGroup,ChurnGroup,InvGroup,MarkGroup,Dashboard_Layer,Output_Data layer;
    class Start,Preprocess,CleanDF,SalesEngine,ChurnPredictor,InvForecaster,MarkClustering,SalesCache,SalesRoutes2,ChurnCache,ChurnRoutes2,ForecastCache,InvRoutes2,NLPCache,MarkRoutes2,SalesUI,ChurnUI,InvUI,MarkUI,KPIs,SalesTrends,ChurnRisk,Tables,InvForecast,Reports2,MarkSegments,Charts2 module;
```

---

## 🧠 AI & Analytics Modules

### 🔮 Customer Churn Prediction

The churn module analyzes customer transaction behavior and identifies customers who are safe or at risk of churn.

**Main capabilities:**

* Customer-level churn classification
* Safe vs at-risk customer analysis
* Churn rate calculation
* Risk driver insights
* Customer filtering and dashboard list
* Cached model execution for faster repeated analysis

**Model / technique used:**

* Random Forest Classifier
* Customer-level grouping
* Feature-based churn behavior analysis

---

### 📦 Inventory Demand Forecasting

The inventory module predicts product demand and helps identify future stock risks.

**Main capabilities:**

* Demand forecasting
* Current stock analysis
* Low-stock alert detection
* Reorder suggestion logic
* Forecast KPIs and inventory charts
* Store, product, and region-based inventory insights

**Model / technique used:**

* Demand forecasting logic
* Time-based inventory analysis
* Stock and demand comparison

---

### 🎯 Marketing Segmentation

The marketing module groups customers into meaningful segments based on purchasing behavior and campaign response data.

**Main capabilities:**

* Customer segmentation
* Auto-K cluster selection
* Customer profile analysis
* Campaign response analysis
* Segment-based marketing insights
* NLP-assisted sentiment/display analysis

**Model / technique used:**

* K-Means Clustering
* RFM-style feature analysis
* NLP-based sentiment support

---

### 📊 Sales Analytics

The sales module provides business performance insights from retail transaction data.

**Main capabilities:**

* Revenue analysis
* Sales trend visualization
* Category performance
* Product performance
* KPI cards and dashboard charts
* Business reporting support

**Model / technique used:**

* Data aggregation
* KPI calculation
* Trend and category analysis

---

## 📊 Sample Dataset Highlights

| Module                 | Dataset Purpose                        | Key Output                                               |
| ---------------------- | -------------------------------------- | -------------------------------------------------------- |
| Customer Churn         | Customer transactions and churn labels | Safe customers, at-risk customers, churn percentage      |
| Inventory Forecasting  | Store, product, stock, and demand data | Demand forecast, low-stock alerts, reorder suggestions   |
| Marketing Segmentation | Campaign and customer profile data     | Customer groups, response insights, segment profiles     |
| Sales Analytics        | Retail sales transactions              | Revenue KPIs, sales trends, product/category performance |

---

## 🛠️ Tech Stack

### Frontend

| Technology       | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| React 18         | User interface and dashboard pages             |
| Vite             | Fast frontend development and production build |
| JavaScript / JSX | Frontend logic and components                  |
| CSS              | Styling, layout, and responsiveness            |
| Recharts         | Dashboard charts and data visualizations       |
| Three.js         | Landing page visual elements                   |
| Framer Motion    | Smooth UI animations and transitions           |
| Axios            | API communication with Flask backend           |

### Backend

| Technology       | Purpose                                       |
| ---------------- | --------------------------------------------- |
| Python           | Backend, data processing, and AI logic        |
| Flask            | REST API service                              |
| Flask Blueprints | Modular API route structure                   |
| MongoDB          | User, authentication, and application data    |
| SQLite           | Lightweight ERP/sample database integration   |
| Pandas           | CSV reading, preprocessing, and data analysis |
| NumPy            | Numerical processing                          |
| Scikit-learn     | Machine learning models and evaluation        |
| Joblib           | Model serialization and caching               |

---

## 📂 Project Directory Structure

```txt
fyp_codex_safe/
├── backend/
│   ├── api/                 # Flask API endpoints and route blueprints
│   ├── cache/               # Model and inference cache files
│   ├── data/                # CSV datasets used by AI modules
│   ├── database/            # Database connections and seeders
│   ├── models/              # ML and analytics logic
│   ├── reports/             # Audit reports and exported outputs
│   ├── utils/               # Preprocessing, mappers, and helper utilities
│   └── app.py               # Flask application entry point
│
├── frontend/
│   ├── public/              # Static frontend assets
│   ├── src/
│   │   ├── api/             # Axios API connectors
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # App/auth/settings context
│   │   ├── pages/           # Dashboard and module pages
│   │   └── App.jsx          # Main React application
│   ├── package.json         # Frontend dependencies and scripts
│   └── vite.config.js       # Vite configuration
│
├── docs/
│   ├── architecture/        # Architecture and design documents
│   ├── screenshots/         # UI screenshots
│   ├── SOFTWARE_TEST_PLAN.md
│   └── TEST_CASES.md
│
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd fyp_codex_safe
```

---

### 2. Backend Setup

Navigate to the backend folder:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Run the Flask server:

```bash
python app.py
```

The backend will start the Flask REST API service.

---

### 3. Frontend Setup

Open a new terminal and navigate to the frontend folder:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Run the Vite development server:

```bash
npm run dev
```

Build the production version:

```bash
npm run build
```

---

## 🔐 Security & Ignored Artifacts

The project is configured to keep sensitive and machine-generated files out of version control.

Ignored or local-only artifacts include:

* `.env` files
* JWT secret keys
* MongoDB connection strings
* Local SQLite database files
* Model cache files such as `.joblib`, `.pkl`, and generated cache outputs
* Temporary logs and build artifacts

---

## 📈 Project Outcome

Retail AI Suite provides a complete AI-powered retail dashboard that supports:

* Better customer retention decisions
* Improved inventory planning
* Smarter marketing segmentation
* Faster sales performance analysis
* Centralized AI-based retail insights

The system is designed as a modular full-stack application where each AI module can be extended, improved, or replaced independently.

---

## 🎓 Final Year Project Context

This project was developed as a Final Year Project to demonstrate the use of modern full-stack development, machine learning, data preprocessing, dashboard visualization, and AI-assisted business decision support in the retail domain.

---

## 📜 License

This project is developed for academic and demonstration purposes.

---

<p align="center">
  <b>Retail AI Suite</b><br/>
  AI-Powered Decision Support for Modern Retail Operations
</p>
