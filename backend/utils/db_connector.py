import pandas as pd
from sqlalchemy import create_engine, inspect
import os
from pathlib import Path
from utils.error_handlers import APIError

class DatabaseConnector:
    """
    Enterprise Data Connector Hub.
    Supports SQLite, MySQL, PostgreSQL via SQLAlchemy.
    """

    def __init__(self):
        self.engines = {}

    def test_connection(self, db_type, host, port, user, password, database):
        """Test if a database is reachable."""
        try:
            url = self._build_url(db_type, host, port, user, password, database)
            engine = create_engine(url)
            with engine.connect() as conn:
                # Minimal query to test connection
                conn.execute("SELECT 1")
            return True, "Connection successful."
        except Exception as e:
            return False, str(e)

    def get_tables(self, db_type, host, port, user, password, database):
        """List all tables in the database."""
        try:
            url = self._build_url(db_type, host, port, user, password, database)
            engine = create_engine(url)
            inspector = inspect(engine)
            return inspector.get_table_names()
        except Exception as e:
            raise APIError(f"Failed to fetch tables: {str(e)}", 500)

    def fetch_data(self, db_type, host, port, user, password, database, table_name, query=None):
        """Fetch data from a table or custom query into a Pandas DataFrame."""
        try:
            url = self._build_url(db_type, host, port, user, password, database)
            engine = create_engine(url)
            
            if query:
                df = pd.read_sql(query, engine)
            else:
                df = pd.read_sql(f"SELECT * FROM {table_name}", engine)
            
            return df
        except Exception as e:
            raise APIError(f"Database fetch failed: {str(e)}", 500)

    def _build_url(self, db_type, host, port, user, password, database):
        """Construct SQLAlchemy connection string."""
        if db_type == 'sqlite':
            # For SQLite, the 'host' is the absolute path to the .db file
            db_path = Path(host)
            return f"sqlite:///{db_path}"
        
        if db_type == 'mysql':
            return f"mysql+pymysql://{user}:{password}@{host}:{port or 3306}/{database}"
        
        if db_type == 'postgresql':
            return f"postgresql://{user}:{password}@{host}:{port or 5432}/{database}"
            
        raise APIError(f"Unsupported database type: {db_type}", 400)

# Global Instance
connector = DatabaseConnector()
