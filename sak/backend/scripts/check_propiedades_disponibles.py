"""
Script para verificar propiedades disponibles y sus oportunidades perdidas
"""

from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak")
engine = create_engine(DATABASE_URL)

print("\n" + "="*80)
print("  VERIFICACIÓN DE PROPIEDADES DISPONIBLES Y OPORTUNIDADES PERDIDAS")
print("="*80 + "\n")

# Query para verificar propiedades disponibles
query_props = text("""
    SELECT 
        id,
        nombre,
        estado,
        estado_fecha
    FROM propiedades
    WHERE estado = '3-disponible'
    AND deleted_at IS NULL
    ORDER BY nombre
    LIMIT 10
""")

print("📋 Primeras 10 propiedades disponibles:")
print("-" * 80)

with engine.connect() as conn:
    result = conn.execute(query_props)
    props = result.fetchall()
    
    if not props:
        print("❌ No hay propiedades con estado '3-disponible'")
    else:
        for prop in props:
            print(f"ID: {prop[0]:<5} | {prop[1]:<50} | {prop[2]} | Desde: {prop[3]}")

# Query para verificar oportunidades perdidas relacionadas con propiedades disponibles
query_opps = text("""
    SELECT 
        p.id as prop_id,
        p.nombre,
        p.estado as prop_estado,
        COUNT(o.id) as total_oportunidades,
        COUNT(CASE WHEN o.estado = '6-perdida' THEN 1 END) as oportunidades_perdidas
    FROM propiedades p
    LEFT JOIN crm_oportunidades o ON o.propiedad_id = p.id AND o.deleted_at IS NULL
    WHERE p.estado = '3-disponible'
    AND p.deleted_at IS NULL
    GROUP BY p.id, p.nombre, p.estado
    ORDER BY oportunidades_perdidas DESC, p.nombre
    LIMIT 15
""")

print("\n" + "="*80)
print("📊 Propiedades disponibles con oportunidades:")
print("-" * 80)
print(f"{'Prop ID':<10} {'Total Opps':<12} {'Perdidas':<10} {'Nombre':<40}")
print("-" * 80)

with engine.connect() as conn:
    result = conn.execute(query_opps)
    rows = result.fetchall()
    
    if not rows:
        print("❌ No se encontraron propiedades disponibles")
    else:
        for row in rows:
            prop_id = row[0]
            nombre = row[1][:40]
            total = row[3]
            perdidas = row[4]
            print(f"{prop_id:<10} {total:<12} {perdidas:<10} {nombre}")

print("\n" + "="*80)
