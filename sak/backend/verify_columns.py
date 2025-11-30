"""Simple script to verify columns in crm_mensajes table."""
from alembic import op
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
import os

# Get database URL from environment or use default
db_url = os.getenv('DATABASE_URL', 'postgresql://crm_user:crm_pass@localhost:5432/crm_dev')

try:
    engine = create_engine(db_url)
    
    # Query directly for column information
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'crm_mensajes' 
            AND column_name IN ('contacto_nombre_propuesto', 'oportunidad_generar')
            ORDER BY column_name
        """))
        
        print("Checking crm_mensajes table for specific columns:")
        print("=" * 70)
        
        columns_found = []
        for row in result:
            col_name, data_type, nullable = row
            print(f"✓ {col_name:30} {data_type:20} {'NULL' if nullable == 'YES' else 'NOT NULL'}")
            columns_found.append(col_name)
        
        print("\n" + "=" * 70)
        if len(columns_found) == 2:
            print("✓ SUCCESS: Both columns exist in the database!")
        elif len(columns_found) == 1:
            missing = [c for c in ['contacto_nombre_propuesto', 'oportunidad_generar'] if c not in columns_found]
            print(f"⚠ WARNING: Found {columns_found[0]} but missing: {missing[0]}")
        else:
            print("✗ ERROR: Both columns are missing from the database")
            
except Exception as e:
    print(f"Error: {e}")
