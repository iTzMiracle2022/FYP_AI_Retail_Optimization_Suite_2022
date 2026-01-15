"""
Utility to load datasets from files
"""
import pandas as pd
from pathlib import Path
from config import config
from utils.error_handlers import APIError

class DataLoader:
    """Load datasets from file system"""
    
    @staticmethod
    def load_csv(dataset_id):
        """Alias for load_dataset for backward compatibility"""
        return DataLoader.load_dataset(dataset_id)

    @staticmethod
    def load_dataset(dataset_id):
        """Load CSV or Excel dataset with auto-detection"""
        
        # Clean ID
        clean_id = dataset_id.replace('.csv', '').replace('.xlsx', '').replace('.xls', '')
        
        # Try finding the file with various extensions
        extensions = ['.csv', '.xlsx', '.xls']
        file_path = None
        
        for ext in extensions:
            # Check raw first
            raw_path = config.RAW_DATA_DIR / f"{clean_id}{ext}"
            if raw_path.exists():
                file_path = raw_path
                break
            # Then check processed
            proc_path = config.PROCESSED_DATA_DIR / f"{clean_id}{ext}"
            if proc_path.exists():
                file_path = proc_path
                break

        if not file_path:
            raise APIError(f'Dataset file not found: {dataset_id}', 404)
        
        ext = file_path.suffix.lower()
        
        try:
            if ext == '.csv':
                df = pd.read_csv(file_path, sep=None, engine='python', encoding='utf-8-sig')
            elif ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                raise APIError(f'Unsupported file format: {ext}', 400)
            
            if df.empty:
                raise APIError(f'Dataset is empty: {dataset_id}', 400)
            
            print(f"✅ Loaded {ext} dataset: {dataset_id} ({len(df)} rows)")
            return df
            
        except Exception as e:
            raise APIError(f'Error reading dataset: {str(e)}', 500)
    
    @staticmethod
    def save_csv(df, dataset_id, to_processed=False):
        """Save dataset to file"""
        folder = config.PROCESSED_DATA_DIR if to_processed else config.RAW_DATA_DIR
        file_path = folder / f"{dataset_id}.csv"
        
        try:
            df.to_csv(file_path, index=False)
            print(f"✅ Saved dataset: {dataset_id}")
            return file_path
        except Exception as e:
            raise APIError(f'Error saving dataset: {str(e)}', 500)
    
    @staticmethod
    def validate_columns(df, required_cols):
        """Check if dataset has required columns"""
        missing = [col for col in required_cols if col not in df.columns]
        
        if missing:
            raise APIError(f"Missing columns: {', '.join(missing)}", 400)
        
        return True