from flask import Blueprint, request, jsonify
import pandas as pd
import os
from werkzeug.utils import secure_filename
from pathlib import Path

from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.error_handlers import handle_errors, APIError
from utils.dataset_classifier import classify_dataset
from utils.validators import validate_dataset_columns
from config import config
from utils.audit_logger import log_activity

dataset_bp = Blueprint('dataset', __name__, url_prefix='/api/datasets')
loader = DataLoader()

# Required columns per dataset type are now evaluated dynamically by the classifier confidence engine
REQUIRED_COLUMNS = {}

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _detect_dataset_type(df: pd.DataFrame) -> tuple[str, str]:
    """Auto-detect what kind of dataset this is from its columns and values using the hybrid scoring classifier."""
    res = classify_dataset(df)
    return res['dataset_type'], res['suitability']


@dataset_bp.route('/upload', methods=['POST'])
@handle_errors
def upload_dataset():
    requester_role = request.headers.get('X-User-Role')
    if not requester_role or requester_role not in ['System Admin', 'Manager', 'Analyst']:
        return jsonify({'success': False, 'message': 'Unauthorized. Role not allowed to upload datasets.'}), 403

    """
    DIAGRAM 4.3.1.1 — Upload Offline Dataset pipeline:
    1. Receive multipart file from UI
    2. Validate file format
    3. Send to Validation Module (column checks)
    4. Clean and store to Local File Storage (data/raw/)
    5. Register metadata in MongoDB
    6. Return success/error
    """

    # ── Step 1: Check file was attached
    if 'file' not in request.files:
        raise APIError("No file attached. Please upload a CSV file.", 400)

    file = request.files['file']

    if file.filename == '':
        raise APIError("No file selected.", 400)

    if not _allowed_file(file.filename):
        raise APIError(f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}", 400)

    # ── Step 2: Safe filename (Werkzeug security)
    filename = secure_filename(file.filename)
    dataset_id = Path(filename).stem   # filename without extension

    # ── Step 3: Read into pandas for validation
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file, sep=None, engine='python')  # auto-detect separator
        else:
            df = pd.read_excel(file)
    except Exception as e:
        raise APIError(f"Could not read file: {str(e)}", 400)

    if df.empty:
        raise APIError("Uploaded file is empty.", 400)

    # ── Step 4: Validation Module — detect type & validate columns using classifier confidence
    classification = classify_dataset(df)
    dataset_type = classification['dataset_type']
    winning_module = classification.get('winning_module', dataset_type)
    suitability = classification['suitability']
    confidence = classification['confidence']
    secondary_suggestion = classification['secondary_suggestion']
    matched_columns = classification.get('matched_columns', {})
    
    # Reject only when confidence is genuinely too low across all modules (winning_module is 'general')
    if winning_module == 'general':
        raise APIError(
            "Dataset validation failed. Could not classify the dataset into any analysis module. "
            "Confidence score too low across all modules.",
            400
        )

    # ── Step 5: Clean & store to Local File Storage (data/raw/)
    save_path = config.RAW_DATA_DIR / filename
    if filename.endswith('.csv'):
        df.to_csv(save_path, index=False)
    else:
        df.to_csv(save_path.with_suffix('.csv'), index=False)
        dataset_id = Path(filename).stem
        filename = dataset_id + '.csv'

    # ── Step 6: Register metadata in MongoDB (Isolated by user_email)
    user_email = request.form.get('email')
    uploaded_by = request.form.get('uploaded_by', 'system')
    
    db.save_dataset_info(
        dataset_id=dataset_id,
        file_name=filename,
        file_type='csv',
        user_email=user_email,
        uploaded_by=uploaded_by
    )

    # Log activity
    requester_role = request.headers.get('X-User-Role')
    log_activity(
        user_email,
        requester_role,
        "dataset.upload",
        status="SUCCESS",
        details={
            "dataset_id": dataset_id,
            "file_name": filename,
            "dataset_type": dataset_type,
            "rows": len(df)
        }
    )

    return jsonify({
        'success': True,
        'message': f'Dataset uploaded and validated successfully',
        'dataset_id': dataset_id,
        'file_name': filename,
        'dataset_type': dataset_type,
        'suitability': suitability,
        'confidence': confidence,
        'secondary_suggestion': secondary_suggestion,
        'matched_columns': matched_columns,
        'rows': len(df),
        'columns': df.columns.tolist(),
        'user_email': user_email
    }), 201


@dataset_bp.route('', methods=['GET'])
@handle_errors
def list_datasets():
    """List all available datasets from MongoDB (Filtered by user_email)."""
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    
    # Manager, System Admin, Analyst, and Viewer can see all datasets across the organization
    if requester_role in ['Manager', 'System Admin', 'Analyst', 'Viewer']:
        user_email = None
        
    datasets = db.list_all_datasets(user_email)
    return jsonify({
        'success': True,
        'count': len(datasets),
        'datasets': datasets
    }), 200


@dataset_bp.route('/<string:dataset_id>', methods=['GET'])
@handle_errors
def get_dataset(dataset_id):
    """Get metadata for a specific dataset (Isolated)."""
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    
    if requester_role in ['Manager', 'System Admin', 'Analyst', 'Viewer']:
        user_email = None
        
    dataset = db.get_dataset_info(dataset_id, user_email)
    return jsonify({
        'success': True,
        'dataset': dataset
    }), 200


@dataset_bp.route('/<string:dataset_id>', methods=['DELETE'])
@handle_errors
def delete_dataset(dataset_id):
    """Remove dataset metadata from MongoDB."""
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', user_email)

    target_user_email = user_email
    if requester_role in ['Manager', 'System Admin']:
        target_user_email = None

    db.get_dataset_info(dataset_id, target_user_email)   # Will raise 404 if not found

    if requester_role not in ['Manager', 'System Admin']:
        db.create_approval_request('DELETE_DATASET', {'dataset_id': dataset_id, 'user_email': user_email}, requester_email)
        log_activity(requester_email, requester_role, "dataset.delete_request", status="SUCCESS", details={"dataset_id": dataset_id, "target_owner": user_email})
        return jsonify({'success': True, 'message': f'Delete request for {dataset_id} sent to Manager for approval.', 'pending': True})

    query = {'dataset_id': dataset_id}
    if target_user_email:
        query['user_email'] = target_user_email
    db.datasets.delete_many(query)
    
    log_activity(requester_email, requester_role, "dataset.delete", status="SUCCESS", details={"dataset_id": dataset_id, "target_owner": user_email})

    return jsonify({
        'success': True,
        'message': f'Dataset {dataset_id} removed'
    }), 200
