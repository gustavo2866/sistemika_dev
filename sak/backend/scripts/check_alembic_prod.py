"""
Verificar estado de migraciones en GCP Production
"""
import os
import subprocess
import json

def get_database_url():
    """Obtener DATABASE_URL desde GCP Secret Manager"""
    print("Obteniendo DATABASE_URL de GCP Secret Manager...")
    try:
        result = subprocess.run(
            ["gcloud", "secrets", "versions", "access", "latest", 
             "--secret=DATABASE_URL", "--project=sak-wcl"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al obtener DATABASE_URL: {e}")
        return None

def check_alembic_current():
    """Verificar versión actual de Alembic en producción"""
    database_url = get_database_url()
    if not database_url:
        return
    
    print("\n" + "="*70)
    print("ESTADO DE MIGRACIONES EN PRODUCCIÓN (GCP)")
    print("="*70)
    
    # Establecer variable de entorno temporalmente
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    try:
        # Verificar versión actual
        print("\n📌 Versión actual:")
        result = subprocess.run(
            ["alembic", "current"],
            capture_output=True,
            text=True,
            cwd=r"c:\Users\gpalmieri\source\sistemika\sak\backend",
            env=env
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        # Mostrar historial
        print("\n📋 Historial de migraciones:")
        result = subprocess.run(
            ["alembic", "history", "--verbose"],
            capture_output=True,
            text=True,
            cwd=r"c:\Users\gpalmieri\source\sistemika\sak\backend",
            env=env
        )
        print(result.stdout)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_alembic_current()
