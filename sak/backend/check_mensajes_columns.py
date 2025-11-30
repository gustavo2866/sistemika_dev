import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, inspect
from app.core.config import settings

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
inspector = inspect(engine)

print("Checking crm_mensajes table for specific columns:")
print("=" * 60)
columns = inspector.get_columns('crm_mensajes')

# Check for our two columns
found_columns = []
for col in columns:
    if col['name'] in ['contacto_nombre_propuesto', 'oportunidad_generar']:
        nullable = "NULL" if col['nullable'] else "NOT NULL"
        print(f"✓ {col['name']:30} {str(col['type']):20} {nullable}")
        found_columns.append(col['name'])

print("\n" + "=" * 60)
if 'contacto_nombre_propuesto' in found_columns and 'oportunidad_generar' in found_columns:
    print("✓ Both columns exist in the database!")
elif 'contacto_nombre_propuesto' in found_columns:
    print("⚠ Only contacto_nombre_propuesto exists (oportunidad_generar missing)")
elif 'oportunidad_generar' in found_columns:
    print("⚠ Only oportunidad_generar exists (contacto_nombre_propuesto missing)")
else:
    print("✗ Both columns are missing from the database")

