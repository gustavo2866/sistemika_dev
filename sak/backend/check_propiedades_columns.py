"""
Verificar columnas de la tabla propiedades en producción
"""
import subprocess
from sqlalchemy import create_engine, text

def get_production_database_url():
    try:
        result = subprocess.run(
            ["powershell", "-Command", 
             "gcloud secrets versions access latest --secret=DATABASE_URL --project=sak-wcl"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {e}")
        return None

prod_db_url = get_production_database_url()
if prod_db_url:
    engine = create_engine(prod_db_url)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'propiedades' 
            ORDER BY ordinal_position
        """))
        print("\nColumnas de la tabla propiedades:")
        for row in result:
            print(f"  - {row[0]} ({row[1]})")
