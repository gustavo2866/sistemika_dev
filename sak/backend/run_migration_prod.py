"""
Script para ejecutar migración de Alembic en producción (Neon)
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import subprocess

# Cargar variables de entorno desde .env
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

def run_alembic_upgrade_prod():
    """Ejecutar alembic upgrade head en producción"""
    print("\n" + "="*70)
    print("EJECUTANDO MIGRACIÓN DE ALEMBIC EN PRODUCCIÓN (NEON)")
    print("="*70)
    
    # URL de Neon
    neon_url = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    
    print("\n⚠️  Estás a punto de ejecutar migraciones en PRODUCCIÓN")
    confirmacion = input("¿Deseas continuar? (escribe 'SI' para confirmar): ")
    
    if confirmacion.strip().upper() != 'SI':
        print("\n❌ Operación cancelada por el usuario")
        return
    
    # Configurar DATABASE_URL temporalmente para Alembic
    env = os.environ.copy()
    env['DATABASE_URL'] = neon_url
    
    try:
        # Verificar revisión actual
        print("\n📋 Verificando revisión actual...")
        result = subprocess.run(
            ["alembic", "current"],
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        
        # Ejecutar upgrade head
        print("\n🚀 Ejecutando alembic upgrade head...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        
        if result.stderr:
            print("Stderr:", result.stderr)
        
        print("\n✅ Migración ejecutada exitosamente en producción")
        
        # Verificar nueva revisión
        print("\n📋 Verificando nueva revisión...")
        result = subprocess.run(
            ["alembic", "current"],
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error al ejecutar migración: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        raise

if __name__ == "__main__":
    run_alembic_upgrade_prod()
