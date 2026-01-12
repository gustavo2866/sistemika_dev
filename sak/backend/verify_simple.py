import psycopg2
import os

# Usar directamente la URL desde el entorno
database_url = "postgresql://sistemika_dev_user:o0IQnyDLiDYVpKN3gglwfVR2BZH0HL8T@dpg-cubkkqbtq21c73fnj6pg-a.oregon-postgres.render.com/sistemika_dev"

conn = psycopg2.connect(database_url)
cur = conn.cursor()

print("=== VERIFICACIÓN PREVIA A MIGRACIÓN ===")

# Verificar tablas backup
tables_to_check = ['propiedades_backup_prod_20251117', 'vacancias_backup_prod_20251117']
print("\n1. TABLAS BACKUP:")
for table in tables_to_check:
    cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')")
    exists = cur.fetchone()[0]
    print(f"  {table}: {'EXISTS' if exists else 'NOT EXISTS'}")

# Verificar columna tipo_articulo en articulos
print("\n2. COLUMNAS DEPRECATED:")
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'articulos' AND column_name = 'tipo_articulo'")
tipo_col = cur.fetchone()
print(f"  articulos.tipo_articulo: {'EXISTS' if tipo_col else 'NOT EXISTS'}")

# Verificar tabla settings
print("\n3. TABLA SETTINGS:")
cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settings')")
settings_exists = cur.fetchone()[0]
print(f"  settings table: {'EXISTS' if settings_exists else 'NOT EXISTS'}")

# Verificar índices existentes
print("\n4. ÍNDICES:")
cur.execute("""
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'crm_oportunidades' 
    AND indexname = 'ix_crm_oportunidades_activo'
""")
index_exists = cur.fetchone()
print(f"  ix_crm_oportunidades_activo: {'EXISTS' if index_exists else 'NOT EXISTS'}")

cur.close()
conn.close()

print("\n=== VERIFICACIÓN COMPLETA ===")