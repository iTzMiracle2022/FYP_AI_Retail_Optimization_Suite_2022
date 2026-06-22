import pandas as pd
from utils.error_handlers import APIError

def validate_dataset_columns(df: pd.DataFrame, dataset_type: str = 'general'):
    """
    Validates that the provided DataFrame contains the required columns
    based on the dataset_type.
    """
    REQUIRED_COLUMNS = {
        'churn': ['Churn'],
        'marketing': ['Income', 'Recency'],
        'inventory': ['Quantity'],
        'general': []
    }
    
    required = REQUIRED_COLUMNS.get(dataset_type, [])
    missing = [c for c in required if c not in df.columns]
    
    if missing:
        raise APIError(f"Missing required columns for {dataset_type}: {missing}", 400)
    
    return True
