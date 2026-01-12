import psycopg2
from urllib.parse import urlparse
import os
from sqlmodel import create_engine
from app.core.config import settings

# Usar la configuración de la app
engine = create_engine(str(settings.database_url))
conn = psycopg2.connect(str(settings.database_url))
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

# Verificar foreign keys existentes
print("\n4. FOREIGN KEYS EXISTENTES:")
cur.execute("""
    SELECT 
        tc.table_name, 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
    WHERE constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('po_facturas', 'po_factura_detalles', 'po_orden_compra_detalles')
    ORDER BY tc.table_name, tc.constraint_name
""")

fks = cur.fetchall()
for fk in fks:
    print(f"  {fk[0]}.{fk[2]} -> {fk[3]}.{fk[4]} ({fk[1]})")

if not fks:
    print("  No foreign keys found")

cur.close()
conn.close()

print("\n=== VERIFICACIÓN COMPLETA ===")