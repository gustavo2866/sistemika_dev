"""
Script temporal para verificar la distribución temporal de oportunidades
"""

from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

# Cargar variables de entorno
load_dotenv()

# Conectar a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak")
engine = create_engine(DATABASE_URL)

# Query para verificar distribución mensual de TODAS las oportunidades
query_all = text("""
    SELECT 
        DATE_TRUNC('month', fecha_estado) as mes,
        estado,
        COUNT(*) as cantidad
    FROM crm_oportunidades
    GROUP BY mes, estado
    ORDER BY mes, estado
""")

# Query para verificar distribución mensual de ganadas/perdidas
query_closed = text("""
    SELECT 
        DATE_TRUNC('month', fecha_estado) as mes,
        estado,
        COUNT(*) as cantidad
    FROM crm_oportunidades
    WHERE estado IN ('5-ganada', '6-perdida')
    GROUP BY mes, estado
    ORDER BY mes
""")

print("\n" + "="*80)
print("  DISTRIBUCIÓN TEMPORAL DE TODAS LAS OPORTUNIDADES")
print("="*80 + "\n")

with engine.connect() as conn:
    result = conn.execute(query_all)
    rows = result.fetchall()
    
    if not rows:
        print("❌ No se encontraron oportunidades")
    else:
        print(f"{'Mes':<20} {'Estado':<15} {'Cantidad':>10}")
        print("-" * 50)
        for row in rows:
            mes = row[0].strftime('%Y-%m')
            estado = row[1]
            cantidad = row[2]
            print(f"{mes:<20} {estado:<15} {cantidad:>10}")
        
        print("\n" + "="*80)
        print(f"  Total de registros: {len(rows)}")
        print("="*80)

print("\n" + "="*80)
print("  DISTRIBUCIÓN TEMPORAL DE OPORTUNIDADES GANADAS/PERDIDAS")
print("="*80 + "\n")

with engine.connect() as conn:
    result = conn.execute(query_closed)
    rows = result.fetchall()
    
    if not rows:
        print("❌ No se encontraron oportunidades ganadas o perdidas")
    else:
        print(f"{'Mes':<20} {'Estado':<15} {'Cantidad':>10}")
        print("-" * 50)
        for row in rows:
            mes = row[0].strftime('%Y-%m')
            estado = row[1]
            cantidad = row[2]
            print(f"{mes:<20} {estado:<15} {cantidad:>10}")
        
        print("\n" + "="*80)
        print(f"  Total de registros: {len(rows)}")
        print("="*80 + "\n")
