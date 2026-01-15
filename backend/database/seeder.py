import os
from pathlib import Path
from database.mongodb_helper import db
from config import config

def seed_database():
    """Seed missing ER Diagram entities (Error Handlers) if empty."""
    print("🌱 Skipping User seeds (Using Real Auth Engine).")
    
    # Error Handler Seed (Dummy log for UI)
    if db.error_handlers.count_documents({}) == 0:
        db.log_error('marketing', 'KMeansConvergenceWarning', 'Model took longer than expected but converged.')
        print("  ⚠️  Seeded sample error log.")

def auto_register_datasets():
    """Scan data/raw/ and register any CSV files that are not yet in MongoDB."""
    raw_dir = Path(config.RAW_DATA_DIR)
    registered = 0
    # Scan for CSV and Excel
    if not raw_dir.exists():
        raw_dir.mkdir(parents=True, exist_ok=True)
        
    for csv_file in list(raw_dir.glob('*.csv')) + list(raw_dir.glob('*.xlsx')) + list(raw_dir.glob('*.xls')):
        dataset_id = csv_file.stem
        file_name  = csv_file.name
        try:
            db.get_dataset_info(dataset_id)  # already exists → skip
        except Exception:
            db.save_dataset_info(
                dataset_id=dataset_id,
                file_name=file_name,
                file_type='csv',
                user_email='system@retail-ai.com'
            )
            registered += 1
            print(f"  📁 Auto-registered dataset: {file_name}")
    
    if registered:
        print(f"✅ Auto-registered {registered} dataset(s) from data/raw/")
    else:
        print("ℹ️  All datasets already registered in MongoDB")

def run_all_seeds():
    """Run all seeding and registration tasks"""
    seed_database()
    auto_register_datasets()
