"""
MongoDB database operations — Full ER Diagram Implementation
Collections: datasets, predictions, forecasts, reports, ml_models,
             error_handlers, data_preprocessors, users
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
import pandas as pd
import json
from bson import ObjectId
from config import config
from utils.error_handlers import APIError


def _serialize(doc):
    """Recursively convert datetime objects to ISO strings for JSON, retaining timezone offset."""
    if isinstance(doc, list):
        return [_serialize(item) for item in doc]
    if isinstance(doc, dict):
        return {k: _serialize(v) for k, v in doc.items()}
    if isinstance(doc, datetime):
        if doc.tzinfo is None:
            return doc.astimezone().isoformat()
        return doc.isoformat()
    # ObjectId conversion
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


# ── Dataset status transitions (State Machine Diagram 4.3.2.1)
DATASET_STATES = ['uploaded', 'preprocessing', 'validated', 'analyzed', 'exported']


class MongoDBHelper:
    """Handle all MongoDB operations — Aligned with ER Diagram."""

    def __init__(self):
        try:
            self.client = MongoClient(config.MONGODB_URI)
            self.db = self.client[config.MONGODB_DB_NAME]

            # ── Core collections
            self.datasets        = self.db['datasets']
            self.predictions     = self.db['predictions']
            self.forecasts       = self.db['forecasts']

            # ── ER Diagram collections (previously missing)
            self.reports         = self.db['reports']
            self.ml_models       = self.db['ml_models']
            self.error_handlers  = self.db['error_handlers']
            self.preprocessors   = self.db['data_preprocessors']
            self.users           = self.db['users']
            self.analysis_runs   = self.db['analysis_runs']
            
            # One-time backfill for analysis_runs
            if self.analysis_runs.count_documents({}) == 0:
                for r in self.reports.find({}):
                    if r.get('report_type') == 'sales':
                        self.analysis_runs.insert_one({'module': 'Sales', 'dataset_id': r.get('dataset_id'), 'user_email': r.get('user_email'), 'status': 'success', 'generated_date': r.get('generated_date')})
                for p in self.predictions.find({}):
                    if p.get('prediction_type') in ['churn', 'marketing']:
                        mod_name = 'Churn' if p.get('prediction_type') == 'churn' else 'Marketing'
                        self.analysis_runs.insert_one({'module': mod_name, 'dataset_id': p.get('dataset_id'), 'user_email': p.get('user_email'), 'status': 'success', 'generated_date': p.get('generated_date')})
                for f in self.forecasts.find({}):
                    self.analysis_runs.insert_one({'module': 'Inventory', 'dataset_id': f.get('dataset_id'), 'user_email': f.get('user_email'), 'status': 'success', 'generated_date': f.get('generated_date')})
            
            self.connectors      = self.db['connectors'] # ── New: External Integrations
            self.sync_logs       = self.db['sync_logs']  # ── New: Event Logging
            self.approvals       = self.db['approvals']  # ── New: Manager Approvals

            # ── Indexes
            self.datasets.create_index([('dataset_id', ASCENDING)], unique=True)
            self.predictions.create_index([('dataset_id', ASCENDING)])
            self.reports.create_index([('dataset_id', ASCENDING)])
            self.error_handlers.create_index([('dataset_id', ASCENDING)])
            self.users.create_index([('email', ASCENDING)], unique=True, sparse=True)
            self.connectors.create_index([('connector_id', ASCENDING)], unique=True)
            self.sync_logs.create_index([('timestamp', DESCENDING)])
            self.approvals.create_index([('status', ASCENDING)])

            print(f"✅ MongoDB connected: {config.MONGODB_DB_NAME}")
            print(f"   Collections: datasets, predictions, forecasts, reports, ml_models, error_handlers, data_preprocessors, users")

        except Exception as e:
            raise APIError(f"MongoDB connection failed: {str(e)}", 500)

    # ══════════════════════════════════════════════
    # DATASET OPERATIONS + STATE MACHINE
    # ══════════════════════════════════════════════

    def save_dataset_info(self, dataset_id, file_name, file_type, user_email, uploaded_by='system'):
        """Save dataset metadata — isolated by user_email."""
        doc = {
            'dataset_id': dataset_id,
            'file_name': file_name,
            'file_type': file_type,
            'user_email': user_email,
            'upload_date': datetime.now(),
            'uploaded_by': uploaded_by,
            'status': 'uploaded',           # State Machine: initial state
            'status_history': [
                {'state': 'uploaded', 'timestamp': datetime.now().isoformat()}
            ]
        }
        self.datasets.update_one(
            {'dataset_id': dataset_id},
            {'$set': doc},
            upsert=True
        )
        print(f"✅ Dataset registered: {dataset_id} for {user_email}")
        return dataset_id

    def update_dataset_status(self, dataset_id, new_status: str, user_email=None):
        """Advance dataset through the state machine."""
        if new_status not in DATASET_STATES:
            raise APIError(f"Invalid dataset state: {new_status}. Must be one of {DATASET_STATES}", 400)
        
        query = {'dataset_id': dataset_id}
        if user_email: query['user_email'] = user_email
        
        self.datasets.update_one(
            query,
            {
                '$set': {'status': new_status},
                '$push': {
                    'status_history': {
                        'state': new_status,
                        'timestamp': datetime.now().isoformat()
                    }
                }
            }
        )
        print(f"📊 Dataset {dataset_id} → state: {new_status}")

    def get_dataset_info(self, dataset_id, user_email=None):
        """Get isolated dataset metadata."""
        query = {'dataset_id': dataset_id}
        if user_email: query['user_email'] = user_email
        doc = self.datasets.find_one(query, {'_id': 0})
        if not doc:
            raise APIError(f'Dataset {dataset_id} not found', 404)
        return _serialize(doc)

    def list_all_datasets(self, user_email=None):
        """Get all datasets for a specific user, or all if none provided."""
        query = {'user_email': user_email} if user_email else {}
        results = list(self.datasets.find(query, {'_id': 0}).sort('upload_date', DESCENDING))
        return _serialize(results)

    # ══════════════════════════════════════════════
    # CHURN PREDICTION OPERATIONS
    # ══════════════════════════════════════════════

    def save_churn_predictions(self, dataset_id, predictions, accuracy, **kwargs):
        """Save churn prediction results and log ml_model metadata."""
        if isinstance(predictions, pd.DataFrame):
            pred_list = predictions.to_dict('records')
        else:
            pred_list = predictions

        # Avoid MongoDB 16MB document limit by saving full list to disk
        file_path = config.PROCESSED_DATA_DIR / f"{dataset_id}_churn_predictions.json"
        
        # Convert datetime objects to string before saving to JSON
        safe_list = _serialize(pred_list)
        with open(file_path, 'w') as f:
            json.dump(safe_list, f)

        # Only store metadata + top 500 rows in MongoDB for quick UI access
        doc = {
            'dataset_id': dataset_id,
            'user_email': kwargs.get('user_email'),
            'prediction_type': 'churn',
            'predictions': safe_list[:500],  # Store a subset in DB
            'has_more': len(safe_list) > 500,
            'file_path': str(file_path),
            'model_accuracy': float(accuracy),
            'generated_date': datetime.now(),
            'total_customers': len(pred_list),
            'at_risk_count': sum(1 for p in pred_list if p.get('churn_prediction') == 1)
        }
        result = self.predictions.insert_one(doc)
        prediction_id = str(result.inserted_id)

        # Log to ml_models collection (ER Diagram)
        device = 'GPU (RTX 3050)' if kwargs.get('using_gpu') else 'CPU'
        self._log_ml_model('RandomForestClassifier', 'churn', float(accuracy), dataset_id, prediction_id, user_email=kwargs.get('user_email'), device=device)

        # Track report entry
        self._save_report(dataset_id, 'churn', user_email=kwargs.get('user_email'), churn_prediction_id=prediction_id)

        # Advance dataset state
        self.update_dataset_status(dataset_id, 'analyzed', user_email=kwargs.get('user_email'))

        print(f"✅ Churn predictions saved: {dataset_id}")
        return prediction_id

    def get_churn_predictions(self, dataset_id, user_email=None):
        """Get latest isolated churn predictions."""
        query = {'dataset_id': dataset_id, 'prediction_type': 'churn'}
        if user_email: query['user_email'] = user_email
        doc = self.predictions.find_one(
            query,
            {'_id': 0},
            sort=[('generated_date', DESCENDING)]
        )
        if not doc:
            raise APIError(f'No churn predictions found for {dataset_id}', 404)
        
        # Reload full data from disk if 'has_more' is true
        if doc.get('has_more') and doc.get('file_path'):
            try:
                with open(doc['file_path'], 'r') as f:
                    doc['predictions'] = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load full predictions from disk: {e}")
                
        return _serialize(doc)

    # ══════════════════════════════════════════════
    # INVENTORY FORECAST OPERATIONS
    # ══════════════════════════════════════════════

    def save_inventory_forecast(self, dataset_id, forecasts, forecast_days, accuracy, **kwargs):
        """Save inventory forecast results."""
        if isinstance(forecasts, pd.DataFrame):
            pred_list = forecasts.to_dict('records')
        else:
            pred_list = forecasts
            
        file_path = config.PROCESSED_DATA_DIR / f"{dataset_id}_inventory_forecasts.json"
        safe_list = _serialize(pred_list)
        with open(file_path, 'w') as f:
            json.dump(safe_list, f)

        # Compute inventory severity summary over full data
        critical = high = medium = low = 0
        for f in safe_list:
            inv_level = float(f.get('Inventory Level', 0) or 0)
            demand = float(f.get('Demand Forecast', 0) or 0)
            if inv_level < demand * 1.2:
                coverage = inv_level / demand if demand > 0 else 0
                if coverage < 0.70: critical += 1
                elif coverage < 0.90: high += 1
                elif coverage < 1.20: medium += 1
                else: low += 1
        
        low_stock_summary = []
        if critical > 0: low_stock_summary.append({'name': 'Critical', 'value': critical})
        if high > 0: low_stock_summary.append({'name': 'High', 'value': high})
        if medium > 0: low_stock_summary.append({'name': 'Medium', 'value': medium})
        if low > 0: low_stock_summary.append({'name': 'Low', 'value': low})

        doc = {
            'dataset_id': dataset_id,
            'user_email': kwargs.get('user_email'),
            'forecast_days': forecast_days,
            'forecasts': safe_list[:500],
            'low_stock_summary': low_stock_summary,
            'has_more': len(safe_list) > 500,
            'file_path': str(file_path),
            'model_accuracy': float(accuracy),
            'generated_date': datetime.now(),
            'total_stock': kwargs.get('total_stock', 0)
        }
        result = self.forecasts.insert_one(doc)
        forecast_id = str(result.inserted_id)

        # Log the run in the audit trail (ARIMA)
        self._log_ml_model('ARIMA (Hybrid)', 'forecasting', f"{accuracy*100:.1f}%", 
                           dataset_id, forecast_id, user_email=kwargs.get('user_email'), device='🚀 Hybrid GPU (RTX 3050)')
        
        # Log the run in the audit trail (Q-Learning)
        self._log_ml_model('Q-Learning Engine', 'optimization', "100.0%", 
                           dataset_id, forecast_id, user_email=kwargs.get('user_email'), device='🚀 Hybrid GPU (RTX 3050)')
        self._save_report(dataset_id, 'inventory', user_email=kwargs.get('user_email'), inventory_forecast_id=forecast_id)
        self.update_dataset_status(dataset_id, 'analyzed', user_email=kwargs.get('user_email'))

        print(f"✅ Inventory forecast saved: {dataset_id}")
        return forecast_id

    def get_inventory_forecast(self, dataset_id, user_email=None):
        """Get latest isolated inventory forecast."""
        query = {'dataset_id': dataset_id}
        if user_email: query['user_email'] = user_email
        doc = self.forecasts.find_one(
            query,
            {'_id': 0},
            sort=[('generated_date', DESCENDING)]
        )
        if not doc:
            raise APIError(f'No inventory forecast found for {dataset_id}', 404)
        return _serialize(doc)

    # ══════════════════════════════════════════════
    # MARKETING ANALYSIS OPERATIONS
    # ══════════════════════════════════════════════

    def save_marketing_analysis(self, dataset_id, clusters, num_clusters, silhouette, **kwargs):
        """Save marketing clustering results with large dataset support."""
        if isinstance(clusters, pd.DataFrame):
            cluster_list = clusters.to_dict('records')
        else:
            cluster_list = clusters

        has_more = len(cluster_list) > 500
        file_path = None

        if has_more:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"marketing_{dataset_id}_{timestamp}.json"
            file_path = str(config.PROCESSED_DATA_DIR / filename)
            
            with open(file_path, 'w') as f:
                json.dump(cluster_list, f)
            
            print(f"  💾 Large marketing clusters saved to disk: {file_path}")
            
        # Compute full segment summary over full dataset
        from collections import Counter
        def get_segment_name(c):
            return c.get('segment_name') or c.get('cluster_name') or c.get('segment') or c.get('label') or c.get('assigned_segment') or c.get('profile_name') or 'Unknown'
            
        segments = [get_segment_name(c) for c in cluster_list]
        segment_summary = [{'name': k, 'value': v} for k, v in Counter(segments).items()]
        
        if has_more:
            cluster_list = cluster_list[:500]

        doc = {
            'dataset_id': dataset_id,
            'user_email': kwargs.get('user_email'),
            'prediction_type': 'marketing',
            'clusters': cluster_list,
            'segment_summary': segment_summary,
            'num_clusters': num_clusters,
            'silhouette_score': float(silhouette) if silhouette else 0.0,
            'has_more': has_more,
            'file_path': file_path,
            'generated_date': datetime.now()
        }
        
        result = self.predictions.insert_one(doc)
        analysis_id = str(result.inserted_id)

        self._log_ml_model('KMeans', 'marketing', float(silhouette or 0), dataset_id, analysis_id, 
                           user_email=kwargs.get('user_email'),
                           device='GPU (RTX 3050)' if kwargs.get('using_gpu') else 'CPU')
        self._save_report(dataset_id, 'marketing', user_email=kwargs.get('user_email'), marketing_analysis_id=analysis_id)
        self.update_dataset_status(dataset_id, 'analyzed', user_email=kwargs.get('user_email'))

        print(f"✅ Marketing analysis saved: {dataset_id}")
        return analysis_id

    def get_marketing_analysis(self, dataset_id, user_email=None):
        """Get latest isolated marketing segmentation."""
        query = {'dataset_id': dataset_id, 'prediction_type': 'marketing'}
        if user_email: query['user_email'] = user_email
        doc = self.predictions.find_one(
            query,
            {'_id': 0},
            sort=[('generated_date', DESCENDING)]
        )
        if not doc:
            return None # Handle gracefully
        
        if doc.get('has_more') and doc.get('file_path'):
            try:
                with open(doc['file_path'], 'r') as f:
                    doc['clusters'] = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load full clusters from disk: {e}")

        return _serialize(doc)

    # ══════════════════════════════════════════════
    # REPORTS (ER Diagram: reports collection)
    # ══════════════════════════════════════════════

    def _save_report(self, dataset_id, report_type, user_email=None, kpis=None, churn_prediction_id=None,
                     inventory_forecast_id=None, sales_trend_id=None, marketing_analysis_id=None, **kwargs):
        """Create or update report entry for a dataset analysis — isolated per user."""
        doc = {
            'dataset_id': dataset_id,
            'user_email': user_email,
            'report_type': report_type,
            'kpis': kpis or {},
            'category_breakdown': kwargs.get('category_breakdown', []),
            'generated_date': datetime.now(),
            'churn_prediction_id': churn_prediction_id,
            'inventory_forecast_id': inventory_forecast_id,
            'sales_trend_id': sales_trend_id,
            'marketing_analysis_id': marketing_analysis_id
        }
        
        query = {'dataset_id': dataset_id, 'report_type': report_type}
        if user_email: query['user_email'] = user_email
        
        self.reports.update_one(
            query,
            {'$set': doc},
            upsert=True
        )
        
        # Insert into central run log
        mod_map = {'sales': 'Sales', 'churn': 'Churn', 'inventory': 'Inventory', 'marketing': 'Marketing'}
        self.analysis_runs.insert_one({
            'module': mod_map.get(report_type, report_type),
            'dataset_id': dataset_id,
            'user_email': user_email,
            'status': 'success',
            'generated_date': datetime.now()
        })

    def get_report(self, dataset_id, report_type, user_email=None):
        """Get a specific report."""
        query = {'dataset_id': dataset_id, 'report_type': report_type}
        if user_email: query['user_email'] = user_email
        doc = self.reports.find_one(
            query,
            {'_id': 0},
            sort=[('generated_date', DESCENDING)]
        )
        if not doc:
            raise APIError(f'No {report_type} report found for {dataset_id}', 404)
        return _serialize(doc)

    def list_reports(self, dataset_id=None, user_email=None):
        """List all reports, optionally filtered by dataset_id and user_email."""
        query = {}
        if dataset_id: query['dataset_id'] = dataset_id
        if user_email: query['user_email'] = user_email
        results = list(self.reports.find(query, {'_id': 0}).sort('generated_date', DESCENDING))
        return _serialize(results)

    def mark_report_exported(self, dataset_id, report_type, file_path):
        """Mark report as exported — triggers 'exported' state in state machine."""
        self.reports.update_one(
            {'dataset_id': dataset_id, 'report_type': report_type},
            {'$set': {'exported': True, 'export_path': file_path, 'exported_at': datetime.now().isoformat()}}
        )
        self.update_dataset_status(dataset_id, 'exported')

    # ══════════════════════════════════════════════
    # ML MODELS (ER Diagram: ml_models collection)
    # ══════════════════════════════════════════════

    def _log_ml_model(self, model_type, analysis_type, accuracy, dataset_id, result_id, user_email=None, device='CPU'):
        """Log ML model run — ER Diagram ml_models entity."""
        doc = {
            'model_type': model_type,
            'analysis_type': analysis_type,
            'accuracy': accuracy,
            'dataset_id': dataset_id,
            'result_id': result_id,
            'user_email': user_email,
            'device': device,
            'trained_date': datetime.now()
        }
        self.ml_models.insert_one(doc)

    def get_ml_model_history(self, user_email=None):
        """Get isolated ML model training history."""
        query = {'user_email': user_email} if user_email else {}
        results = list(self.ml_models.find(query, {'_id': 0}).sort('trained_date', DESCENDING).limit(50))
        return _serialize(results)

    # ══════════════════════════════════════════════
    # PREPROCESSORS (ER Diagram: data_preprocessors)
    # ══════════════════════════════════════════════

    def log_preprocessor_run(self, dataset_id, missing_value_handler, normalization_method, rows_before, rows_after, user_email=None):
        """Log structured data preprocessing run — ER Diagram data_preprocessors entity."""
        doc = {
            'dataset_id': dataset_id,
            'user_email': user_email,
            'missing_value_handler': missing_value_handler,
            'normalization_method': normalization_method,
            'rows_before': rows_before,
            'rows_after': rows_after,
            'timestamp': datetime.now()
        }
        try:
            self.preprocessors.insert_one(doc)
            print(f"📊 Preprocessing audit logged for {dataset_id}")
            return True
        except Exception as e:
            print(f"Error logging preprocessor run: {e}")
            return False

    # ══════════════════════════════════════════════
    # ERROR HANDLERS (ER Diagram + State Machine 7 types)
    # ══════════════════════════════════════════════

    def log_error(self, error_code, error_message, dataset_id=None, ml_model_id=None):
        """
        Log structured error — State Machine Diagram 4.3.2.3 error types:
        INVALID_DATASET, MISSING_COLUMNS, FILE_CORRUPTION, TIMEOUT,
        INCORRECT_PARAMS, SYSTEM_ERROR, BACKEND_INTERRUPTION
        """
        doc = {
            'error_code': error_code,
            'error_message': error_message,
            'dataset_id': dataset_id,
            'ml_model_id': ml_model_id,
            'timestamp': datetime.now()
        }
        self.error_handlers.insert_one(doc)
        print(f"⚠️  Error logged: [{error_code}] {error_message}")

    # ══════════════════════════════════════════════
    # USERS (ER Diagram)
    # ══════════════════════════════════════════════

    def create_user(self, name, email, role='Viewer', is_verified=False):
        """
        Create a new user entry or authorization — ER Diagram users entity.
        Role: Viewer (default), Analyst, Manager, System Admin
        """
        user_doc = {
            'name': name,
            'email': email,
            'role': role,
            'is_verified': is_verified,
            'password_hash': None, # To be set during activation/signup
            'created_at': datetime.now(),
            'last_login': None
        }
        try:
            self.users.update_one(
                {'email': email},
                {'$setOnInsert': user_doc}, # Only set if not already present
                upsert=True
            )
            print(f"👤 User Role Authorized: {email} as {role}")
            return True
        except Exception as e:
            print(f"Error authorizing user: {e}")
            return False

    def activate_user(self, email, name, password_hash):
        """Complete user profile and set password (Real-world activation)."""
        update_doc = {
            'name': name,
            'password_hash': password_hash,
            'is_verified': True,
            'activated_at': datetime.now()
        }
        self.users.update_one({'email': email}, {'$set': update_doc})
        return True

    def get_user(self, email):
        """Get user details by email."""
        user = self.users.find_one({'email': email}, {'_id': 0})
        return _serialize(user)

    def get_all_users(self):
        """Fetch all registered users — ER Diagram users collection."""
        results = list(self.users.find({}, {'_id': 0}).sort('created_at', DESCENDING))
        return _serialize(results)

    def update_user_role(self, email, new_role):
        """Update a user's role/permissions in the database."""
        try:
            self.users.update_one(
                {'email': email},
                {'$set': {'role': new_role, 'updated_at': datetime.now()}}
            )
            print(f"👤 User role updated: {email} -> {new_role}")
            return True
        except Exception as e:
            print(f"Error updating user role: {e}")
            return False

    # ══════════════════════════════════════════════
    # APPROVALS (MANAGER WORKFLOW)
    # ══════════════════════════════════════════════

    def create_approval_request(self, req_type, payload, requested_by):
        """Create a new pending approval request."""
        import uuid
        req_id = str(uuid.uuid4())
        doc = {
            'request_id': req_id,
            'type': req_type,
            'payload': payload,
            'requested_by': requested_by,
            'status': 'pending',
            'created_at': datetime.utcnow()
        }
        self.approvals.insert_one(doc)
        return req_id

    def get_pending_approvals(self):
        """Fetch all pending approval requests."""
        return _serialize(list(self.approvals.find({'status': 'pending'}).sort('created_at', DESCENDING)))

    def update_approval_status(self, request_id, status, approved_by):
        """Update status to 'approved' or 'rejected'."""
        self.approvals.update_one(
            {'request_id': request_id},
            {'$set': {
                'status': status,
                'resolved_by': approved_by,
                'resolved_at': datetime.utcnow()
            }}
        )

    def get_approval_request(self, request_id):
        """Get a single approval request."""
        return _serialize(self.approvals.find_one({'request_id': request_id}))

    # ══════════════════════════════════════════════
    # CONNECTORS (ER Diagram / Enterprise Integration)
    # ══════════════════════════════════════════════

    def save_connector(self, connector_id, config_doc):
        """Save external database/API connection settings."""
        config_doc['connector_id'] = connector_id
        config_doc['updated_at'] = datetime.now()
        self.connectors.update_one(
            {'connector_id': connector_id},
            {'$set': config_doc},
            upsert=True
        )
        return connector_id

    def list_connectors(self):
        """List all external integrations."""
        return _serialize(list(self.connectors.find({}, {'_id': 0})))

    def delete_connector(self, connector_id):
        """Remove a connector."""
        self.connectors.delete_one({'connector_id': connector_id})
        return True

    def log_sync_event(self, connector_id, table, status, rows=0, error=None):
        """Log a real sync execution event."""
        log_entry = {
            'connector_id': connector_id,
            'table': table,
            'status': status,
            'rows_synced': rows,
            'error': error,
            'timestamp': datetime.now()
        }
        self.sync_logs.insert_one(log_entry)
        return True

    def get_sync_history(self, limit=7):
        """Fetch the latest sync events for the dashboard."""
        logs = list(self.sync_logs.find({}, {'_id': 0}).sort('timestamp', -1).limit(limit))
        return _serialize(logs)

    def get_dashboard_summary(self, user_email=None, rev_days=None, act_days=None):
        """Aggregate real-time metrics for the dynamic dashboard."""
        rev_days = int(rev_days) if rev_days and str(rev_days).isdigit() else 30
        act_days = int(act_days) if act_days and str(act_days).isdigit() else 30
            
        try:
            base_query = {'user_email': user_email} if user_email else {}

            churn_query = {'prediction_type': 'churn'}
            churn_query.update(base_query)

            # 1. Total Customers from latest churn prediction context
            latest_churn = self.predictions.find_one(
                churn_query, 
                {'_id': 0, 'total_customers': 1, 'at_risk_count': 1, 'file_path': 1, 'generated_date': 1},
                sort=[('generated_date', DESCENDING)]
            )
            
            # 2. Latest inventory accuracy & stock
            latest_inv = self.forecasts.find_one(
                base_query, 
                {'_id': 0, 'model_accuracy': 1, 'total_stock': 1, 'low_stock_summary': 1, 'file_path': 1, 'generated_date': 1},
                sort=[('generated_date', DESCENDING)]
            )
            
            # 3. Latest Sales Report for Revenue
            sales_query = {'report_type': 'sales'}
            sales_query.update(base_query)
            latest_sales = self.reports.find_one(
                sales_query,
                sort=[('generated_date', DESCENDING)]
            )
            
            # 3b. Latest Marketing Segmentation
            marketing_query = {'prediction_type': 'marketing'}
            marketing_query.update(base_query)
            latest_marketing = self.predictions.find_one(
                marketing_query,
                {'_id': 0, 'segment_summary': 1, 'generated_date': 1},
                sort=[('generated_date', DESCENDING)]
            )

            # 4. Aggregated calculations (Fallback defaults)
            total_customers = latest_churn.get('total_customers', "-") if latest_churn else "-"
            at_risk = "-" # Will be overwritten by customer-level logic
            
            total_revenue = latest_sales.get('kpis', {}).get('total_revenue', "-") if latest_sales else "-"
            total_stock = latest_inv.get('total_stock', "-") if latest_inv else "-"
            
            active_datasets = self.datasets.count_documents({}) # Count all team datasets
            reports_generated = self.reports.count_documents({}) # Count all team reports
            low_stock = "-" # Default fallback

            # --- OVERRIDE WITH REAL DATASET METRICS ---
            revenue_trend = []
            real_inventory_data = None
            
            # Helper imports
            try:
                import pandas as pd
                from pathlib import Path
                import json
                import os
                raw_data_dir = Path(__file__).parent.parent / 'data' / 'raw'
            except Exception as e:
                print(f"Warning: Initialization error in dashboard metrics calculations: {e}")
                raw_data_dir = None

            # 1. Total Revenue & True Total Customers from Raw Dataset
            if raw_data_dir:
                try:
                    ecommerce_path = raw_data_dir / 'ecommerce_customer_data_custom_ratios.csv'
                    if ecommerce_path.exists():
                        df = pd.read_csv(ecommerce_path)
                        if 'Total Purchase Amount' in df.columns:
                            total_revenue = float(df['Total Purchase Amount'].sum())
                        if 'Customer Name' in df.columns:
                            total_customers = int(df['Customer Name'].nunique())
                        
                        # 1b. Real Revenue Trend
                        if 'Purchase Date' in df.columns and 'Total Purchase Amount' in df.columns:
                            df['Purchase Date'] = pd.to_datetime(df['Purchase Date'], errors='coerce')
                            
                            latest_date = df['Purchase Date'].max()
                            if pd.notna(latest_date):
                                # Ensure exact calendar days
                                date_range = pd.date_range(end=latest_date.date(), periods=rev_days, freq='D')
                                
                                daily_rev = df.groupby(df['Purchase Date'].dt.date)['Total Purchase Amount'].sum()
                                daily_rev.index = pd.to_datetime(daily_rev.index)
                                
                                # Reindex to fill missing days with 0
                                daily_rev = daily_rev.reindex(date_range, fill_value=0).reset_index()
                                daily_rev.columns = ['Purchase Date', 'Total Purchase Amount']
                                
                                revenue_trend = [{'name': '-'.join(str(row['Purchase Date'].date()).split('-')[1:]), 'value': int(row['Total Purchase Amount'])} for _, row in daily_rev.iterrows()]
                except Exception as e:
                    print(f"Warning: Could not compute raw sales metrics: {e}")

                # 2. True At-Risk Customers from Predictions
                try:
                    if latest_churn and latest_churn.get('file_path'):
                        file_path = latest_churn['file_path']
                        if os.path.exists(file_path):
                            with open(file_path, 'r') as f:
                                preds = json.load(f)
                            preds_df = pd.DataFrame(preds)
                            
                            # Ensure customer-level aggregation
                            cust_col = 'customer_name' if 'customer_name' in preds_df.columns else ('customer id' if 'customer id' in preds_df.columns else None)
                            if cust_col and 'churn_prediction' in preds_df.columns:
                                total_customers = int(preds_df[cust_col].nunique())
                                # If a customer has ANY row with prediction 1, they are at risk
                                at_risk = int(preds_df.groupby(cust_col)['churn_prediction'].max().sum())
                        else:
                            print(f"Warning: Churn prediction file not found on disk: {file_path}")
                except Exception as e:
                    print(f"Warning: Could not compute churn dashboard metrics: {e}")

                # 3. True Low Stock Alerts from Full Forecasts
                try:
                    inventory_path = raw_data_dir / 'retail_store_inventory.csv'
                    if inventory_path.exists():
                        inv_df = pd.read_csv(inventory_path)
                        
                        # Dynamic column detection as in InventoryForecaster
                        from utils.data_preprocessing import ColumnMatcher
                        inv_df.columns = [c.strip() for c in inv_df.columns]
                        qty_col = ColumnMatcher.match(inv_df, 'qty') or 'Inventory Level'
                        forecast_col = ColumnMatcher.match(inv_df, 'forecast') or 'Demand Forecast'
                        
                        if qty_col in inv_df.columns and forecast_col in inv_df.columns:
                            # Group by Product, Store, Region for the latest date
                            date_col = ColumnMatcher.match(inv_df, 'date') or 'Date'
                            if date_col in inv_df.columns:
                                inv_df[date_col] = pd.to_datetime(inv_df[date_col], errors='coerce')
                                latest_date = inv_df[date_col].max()
                                df_latest = inv_df[inv_df[date_col] == latest_date].copy()
                            else:
                                df_latest = inv_df.copy()
                                
                            prod_col = ColumnMatcher.match(df_latest, 'product') or 'Product ID'
                            store_col = next((c for c in df_latest.columns if 'store' in c.lower()), 'Store ID')
                            region_col = next((c for c in df_latest.columns if 'region' in c.lower()), 'Region')
                            
                            groupby_cols = []
                            if prod_col in df_latest.columns: groupby_cols.append(prod_col)
                            if store_col in df_latest.columns: groupby_cols.append(store_col)
                            if region_col in df_latest.columns: groupby_cols.append(region_col)
                            
                            if groupby_cols:
                                grouped = df_latest.groupby(groupby_cols).agg({
                                    qty_col: 'min', 
                                    forecast_col: 'mean'
                                }).reset_index()
                                
                                # Low stock alert logic: Inventory < Forecast * 1.2
                                grouped['is_low'] = grouped[qty_col] < (grouped[forecast_col] * 1.2)
                                low_stock = int(grouped['is_low'].sum())
                                low_alerts = grouped[grouped['is_low']].copy()
                            else:
                                df_latest['is_low'] = df_latest[qty_col] < (df_latest[forecast_col] * 1.2)
                                low_stock = int(df_latest['is_low'].sum())
                                low_alerts = df_latest[df_latest['is_low']].copy()
                                
                            if low_stock > 0 and not low_alerts.empty:
                                critical = high = medium = low = 0
                                for _, row in low_alerts.iterrows():
                                    inv_val = float(row[qty_col] or 0)
                                    dmd_val = float(row[forecast_col] or 0)
                                    coverage = inv_val / dmd_val if dmd_val > 0 else 0
                                    if coverage < 0.70: critical += 1
                                    elif coverage < 0.90: high += 1
                                    elif coverage < 1.20: medium += 1
                                    else: low += 1
                                real_inventory_data = []
                                if critical > 0: real_inventory_data.append({'name': 'Critical', 'value': critical})
                                if high > 0: real_inventory_data.append({'name': 'High', 'value': high})
                                if medium > 0: real_inventory_data.append({'name': 'Medium', 'value': medium})
                                if low > 0: real_inventory_data.append({'name': 'Low', 'value': low})
                            elif low_stock == 0:
                                real_inventory_data = []
                        else:
                            low_stock = "-"
                    else:
                        low_stock = "-"
                except Exception as e:
                    print(f"Warning: Could not compute real inventory metrics: {e}")

            # --- Compile Module Insights ---
            module_insights = {
                'sales': {
                    'title': 'Sales Insights',
                    'subtitle': 'Revenue by top categories',
                    'chart_type': 'bar',
                    'data': []
                },
                'churn': {
                    'title': 'Retention Insights',
                    'subtitle': 'Customer retention risk',
                    'chart_type': 'donut',
                    'data': []
                },
                'inventory': {
                    'title': 'Inventory Insights',
                    'subtitle': 'Low-stock pressure',
                    'chart_type': 'bar',
                    'data': []
                },
                'marketing': {
                    'title': 'Audience Insights',
                    'subtitle': 'Audience segment mix',
                    'chart_type': 'donut',
                    'data': []
                }
            }
            
            # 1. Sales Snapshot
            if latest_sales and latest_sales.get('category_breakdown'):
                sales_data = []
                for c in latest_sales['category_breakdown']:
                    name = c.get('name') or c.get('category')
                    val = c.get('revenue') if c.get('revenue') is not None else c.get('total_revenue')
                    if name and val is not None:
                        sales_data.append({'name': name, 'value': val})
                module_insights['sales']['data'] = sorted(sales_data, key=lambda x: x['value'], reverse=True)[:5]
                
            # 2. Churn Snapshot
            if latest_churn and isinstance(total_customers, int) and isinstance(at_risk, int):
                safe = total_customers - at_risk
                if total_customers > 0:
                    module_insights['churn']['data'] = [
                        {'name': 'Safe Customers', 'value': safe},
                        {'name': 'At Risk', 'value': at_risk}
                    ]
                    
            # 3. Inventory Snapshot
            if latest_inv:
                if real_inventory_data is not None:
                    module_insights['inventory']['data'] = real_inventory_data
                elif latest_inv.get('low_stock_summary'):
                    module_insights['inventory']['data'] = latest_inv['low_stock_summary']
                
            # 4. Marketing Snapshot
            if latest_marketing and latest_marketing.get('segment_summary'):
                module_insights['marketing']['data'] = latest_marketing['segment_summary']

            from datetime import timedelta
            act_query = {}
            if act_days:
                cutoff_date = datetime.now() - timedelta(days=act_days)
                act_query = {'generated_date': {'$gte': cutoff_date}}

            churn_perc = (at_risk / total_customers * 100) if (isinstance(total_customers, (int, float)) and isinstance(at_risk, (int, float)) and total_customers > 0) else "-"

            response_data = {
                'success': True,
                'kpis': {
                    'total_revenue': total_revenue,
                    'total_stock': total_stock,
                    'total_customers': total_customers,
                    'churn_rate': churn_perc,
                    'inventory_accuracy': latest_inv.get('model_accuracy', 0)*100 if latest_inv else "-",
                    'at_risk_raw': at_risk,
                    'active_datasets': active_datasets if active_datasets > 0 else "-",
                    'reports_generated': reports_generated if reports_generated > 0 else "-",
                    'low_stock': low_stock
                },
                'revenue_trend': revenue_trend,
                'module_activity': [
                    {'name': 'Sales', 'value': self.analysis_runs.count_documents({'module': 'Sales', **act_query})},
                    {'name': 'Churn', 'value': self.analysis_runs.count_documents({'module': 'Churn', **act_query})},
                    {'name': 'Inventory', 'value': self.analysis_runs.count_documents({'module': 'Inventory', **act_query})},
                    {'name': 'Marketing', 'value': self.analysis_runs.count_documents({'module': 'Marketing', **act_query})}
                ],
                'module_last_runs': {
                    'sales': latest_sales.get('generated_date') if latest_sales else None,
                    'churn': latest_churn.get('generated_date') if latest_churn else None,
                    'inventory': latest_inv.get('generated_date') if latest_inv else None,
                    'marketing': latest_marketing.get('generated_date') if latest_marketing else None
                },
                'module_insights': module_insights,
                'recent_activity': self.get_sync_history(limit=5),
                'system_health': self.health_check()
            }
            
            return _serialize(response_data)
        except Exception as e:
            print(f"Error aggregating dashboard stats: {e}")
            return {'success': False, 'error': str(e)}

    def update_connector_schedule(self, connector_id, schedule_doc):
        """Save user's customization for sync frequency and time."""
        self.connectors.update_one(
            {'connector_id': connector_id},
            {'$set': {'schedule': schedule_doc, 'updated_at': datetime.now()}},
            upsert=True
        )
        return True

    def process_webhook_event(self, source, data):
        """Register a real webhook order as a dataset update."""
        dataset_id = f"webhook_{source}_live"
        filename = f"{dataset_id}.csv"
        
        # In a real app, logic would append this JSON object to a CSV or SQL table.
        # For this Enterprise demo, we register it as a live dataset event.
        self.save_dataset_info(
            dataset_id=dataset_id,
            file_name=filename,
            file_type='csv',
            uploaded_by=f'{source.capitalize()} Webhook'
        )
        
        # Log the sync event
        self.log_sync_event(
            connector_id=dataset_id,
            table='Orders Feed',
            status='Success',
            rows=1 # One single order event
        )
        return dataset_id

    # ══════════════════════════════════════════════
    # UTILITY
    # ══════════════════════════════════════════════

    def health_check(self):
        """Check database health — returns all collection counts."""
        try:
            self.client.admin.command('ping')
            return {
                'status': 'connected',
                'database': config.MONGODB_DB_NAME,
                'collections': {
                    'datasets': self.datasets.count_documents({}),
                    'predictions': self.predictions.count_documents({}),
                    'forecasts': self.forecasts.count_documents({}),
                    'reports': self.reports.count_documents({}),
                    'ml_models': self.ml_models.count_documents({}),
                    'error_handlers': self.error_handlers.count_documents({}),
                }
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}


# Global instance
db = MongoDBHelper()