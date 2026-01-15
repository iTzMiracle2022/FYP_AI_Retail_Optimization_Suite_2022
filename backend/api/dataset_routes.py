from flask import Blueprint, request, jsonify
import pandas as pd
import os
from werkzeug.utils import secure_filename
from pathlib import Path

from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.error_handlers import handle_errors, APIError
from utils.validators import validate_dataset_columns
from config import config

dataset_bp = Blueprint('dataset', __name__, url_prefix='/api/datasets')
loader = DataLoader()

# Required columns per dataset type (for Validation Module step in diagram)
REQUIRED_COLUMNS = {
    'churn': ['Churn'],
    'marketing': ['Income', 'Recency'],
    'inventory': ['Quantity'],
}

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _detect_dataset_type(df: pd.DataFrame) -> str:
    """Auto-detect what kind of dataset this is from its columns."""
    cols_lower = [c.strip().lower() for c in df.columns]
    if 'churn' in cols_lower:
        return 'churn'
    if 'income' in cols_lower and 'recency' in cols_lower:
        return 'marketing'
    if 'quantity' in cols_lower or 'stock' in cols_lower:
        return 'inventory'
    return 'general'


@dataset_bp.route('/upload', methods=['POST'])
@handle_errors
def upload_dataset():
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

    # ── Step 4: Validation Module — detect type & validate columns
    dataset_type = _detect_dataset_type(df)
    required = REQUIRED_COLUMNS.get(dataset_type, [])
    missing = [col for col in required if col not in df.columns]
    if missing and dataset_type != 'general':
        raise APIError(
            f"Dataset validation failed. Missing required columns: {missing}. "
            f"Detected type: '{dataset_type}'",
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

    return jsonify({
        'success': True,
        'message': f'Dataset uploaded and validated successfully',
        'dataset_id': dataset_id,
        'file_name': filename,
        'dataset_type': dataset_type,
        'rows': len(df),
        'columns': df.columns.tolist(),
        'user_email': user_email
    }), 201


@dataset_bp.route('/', methods=['GET'])
@handle_errors
def list_datasets():
    """List all available datasets from MongoDB (Filtered by user_email)."""
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    
    # Manager and System Admin can see all datasets across the organization
    if requester_role in ['Manager', 'System Admin']:
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
    db.get_dataset_info(dataset_id, user_email)   # Will raise 404 if not found

    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', user_email)
    
    if requester_role != 'Manager':
        db.create_approval_request('DELETE_DATASET', {'dataset_id': dataset_id, 'user_email': user_email}, requester_email)
        return jsonify({'success': True, 'message': f'Delete request for {dataset_id} sent to Manager for approval.', 'pending': True})

    query = {'dataset_id': dataset_id}
    if user_email:
        query['user_email'] = user_email
    db.datasets.delete_many(query)

    return jsonify({
        'success': True,
        'message': f'Dataset {dataset_id} removed'
    }), 200
