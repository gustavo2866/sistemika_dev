"""
Script para verificar qué datos devuelve el endpoint de evolución mensual
"""

from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

# Cargar variables de entorno
load_dotenv()

# Conectar a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak")
engine = create_engine(DATABASE_URL)

# Verificar datos por fecha_estado (lo que debería usar el endpoint)
query_fecha_estado = text("""
    SELECT 
        DATE_TRUNC('month', fecha_estado) as mes,
        COUNT(*) FILTER (WHERE estado = '1-abierta') as nuevas,
        COUNT(*) FILTER (WHERE estado = '5-ganada') as ganadas,
        COUNT(*) as totales
    FROM crm_oportunidades
    GROUP BY mes
    ORDER BY mes
""")

# Verificar datos por created_at
query_created_at = text("""
    SELECT 
        DATE_TRUNC('month', created_at) as mes,
        COUNT(*) FILTER (WHERE estado = '1-abierta') as nuevas,
        COUNT(*) FILTER (WHERE estado = '5-ganada') as ganadas,
        COUNT(*) as totales
    FROM crm_oportunidades
    GROUP BY mes
    ORDER BY mes
""")

print("\n" + "="*80)
print("  DATOS AGRUPADOS POR fecha_estado (debería usar el endpoint)")
print("="*80 + "\n")

with engine.connect() as conn:
    result = conn.execute(query_fecha_estado)
    rows = result.fetchall()
    
    print(f"{'Mes':<20} {'Nuevas':>10} {'Ganadas':>10} {'Totales':>10}")
    print("-" * 55)
    for row in rows:
        mes = row[0].strftime('%Y-%m')
        nuevas = row[1]
        ganadas = row[2]
        totales = row[3]
        print(f"{mes:<20} {nuevas:>10} {ganadas:>10} {totales:>10}")

print("\n" + "="*80)
print("  DATOS AGRUPADOS POR created_at")
print("="*80 + "\n")

with engine.connect() as conn:
    result = conn.execute(query_created_at)
    rows = result.fetchall()
    
    print(f"{'Mes':<20} {'Nuevas':>10} {'Ganadas':>10} {'Totales':>10}")
    print("-" * 55)
    for row in rows:
        mes = row[0].strftime('%Y-%m')
        nuevas = row[1]
        ganadas = row[2]
        totales = row[3]
        print(f"{mes:<20} {nuevas:>10} {ganadas:>10} {totales:>10}")

print("\n" + "="*80)
