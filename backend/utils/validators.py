import pandas as pd
from utils.error_handlers import APIError

def validate_dataset_columns(df: pd.DataFrame, dataset_type: str = 'general'):
    """
    Validates that the provided DataFrame contains the required columns
    based on the dataset_type using classifier confidence.
    """
    from utils.dataset_classifier import classify_dataset
    classification = classify_dataset(df)
    winning_module = classification.get('winning_module', classification['dataset_type'])
    
    if winning_module == 'general':
        raise APIError(
            "Dataset validation failed. Could not classify the dataset into any analysis module. "
            "Confidence score too low across all modules.",
            400
        )
    
    return True
