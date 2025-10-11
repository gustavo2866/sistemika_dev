"""
Script para eliminar la tabla clientes
"""
from sqlalchemy import text
from app.db import engine

print("🗑️  Eliminando tabla clientes...")

with engine.connect() as conn:
    try:
        conn.execute(text('DROP TABLE IF EXISTS clientes CASCADE'))
        conn.commit()
        print("✅ Tabla clientes eliminada correctamente")
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n🔍 Verificando...")
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'clientes'
    """))
    if result.fetchone():
        print("⚠️  La tabla clientes aún existe")
    else:
        print("✅ La tabla clientes fue eliminada exitosamente")
