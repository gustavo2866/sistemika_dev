"""
Verifica el balance real entre creación y cierre de oportunidades
"""

import sys
from pathlib import Path
from datetime import datetime, date, timedelta
from collections import defaultdict

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad

print("\n" + "=" * 80)
print("  ANÁLISIS DE BALANCE: CREACIÓN VS CIERRE")
print("=" * 80 + "\n")

with Session(engine) as session:
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    def fecha_cierre(opp):
        logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
        for log in logs:
            if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
                return log.fecha_registro.date() if log.fecha_registro else None
        return None
    
    print("📊 PLAN ORIGINAL vs REALIDAD:")
    print("-" * 80)
    
    # Plan original del script balance_oportunidades_data.py
    PLAN_ORIGINAL = {
        "2024-12": {"creadas": 5, "ganadas": 2, "perdidas": 1},
        "2025-01": {"creadas": 8, "ganadas": 3, "perdidas": 2},
        "2025-02": {"creadas": 10, "ganadas": 2, "perdidas": 5},
        "2025-03": {"creadas": 12, "ganadas": 4, "perdidas": 3},
        "2025-04": {"creadas": 10, "ganadas": 3, "perdidas": 4},
        "2025-05": {"creadas": 15, "ganadas": 5, "perdidas": 3},
        "2025-06": {"creadas": 8, "ganadas": 2, "perdidas": 6},
        "2025-07": {"creadas": 12, "ganadas": 6, "perdidas": 2},
        "2025-08": {"creadas": 10, "ganadas": 3, "perdidas": 5},
        "2025-09": {"creadas": 14, "ganadas": 5, "perdidas": 4},
        "2025-10": {"creadas": 11, "ganadas": 4, "perdidas": 5},
        "2025-11": {"creadas": 13, "ganadas": 6, "perdidas": 3},
    }
    
    # Contar lo que realmente hay en BD
    por_mes_creacion = defaultdict(int)
    por_mes_cierre = defaultdict(lambda: {"ganadas": 0, "perdidas": 0})
    
    for opp in oportunidades:
        if not opp.created_at:
            continue
        
        mes_creacion = opp.created_at.strftime("%Y-%m")
        por_mes_creacion[mes_creacion] += 1
        
        f_cierre = fecha_cierre(opp)
        if f_cierre:
            mes_cierre = f_cierre.strftime("%Y-%m")
            if opp.estado == EstadoOportunidad.GANADA.value:
                por_mes_cierre[mes_cierre]["ganadas"] += 1
            elif opp.estado == EstadoOportunidad.PERDIDA.value:
                por_mes_cierre[mes_cierre]["perdidas"] += 1
    
    print(f"{'Mes':<12} {'Plan':<20} {'Real':<20} {'Diferencia':<15}")
    print(f"{'':12} {'Cre|Gan|Per':<20} {'Cre|Gan|Per':<20}")
    print("-" * 80)
    
    acum_plan = 0
    acum_real = 0
    
    for mes in sorted(PLAN_ORIGINAL.keys()):
        plan = PLAN_ORIGINAL[mes]
        plan_str = f"{plan['creadas']:2}| {plan['ganadas']:2}| {plan['perdidas']:2}"
        plan_cerradas = plan['ganadas'] + plan['perdidas']
        plan_balance = plan['creadas'] - plan_cerradas
        acum_plan += plan_balance
        
        real_creadas = por_mes_creacion.get(mes, 0)
        real_ganadas = por_mes_cierre[mes]["ganadas"]
        real_perdidas = por_mes_cierre[mes]["perdidas"]
        real_str = f"{real_creadas:2}| {real_ganadas:2}| {real_perdidas:2}"
        real_cerradas = real_ganadas + real_perdidas
        real_balance = real_creadas - real_cerradas
        acum_real += real_balance
        
        dif = real_balance - plan_balance
        print(f"{mes:<12} {plan_str:<20} {real_str:<20} {dif:+3} ({acum_real:+3})")
    
    print("\n💡 ANÁLISIS:")
    print("-" * 80)
    print(f"Balance acumulado PLANEADO: {acum_plan:+d}")
    print(f"Balance acumulado REAL: {acum_real:+d}")
    print(f"\n⚠️  Diferencia: {acum_real - acum_plan:+d} oportunidades más de las esperadas\n")
    
    # Verificar estados actuales
    estados = defaultdict(int)
    for opp in oportunidades:
        estados[opp.estado] += 1
    
    print("\n📈 DISTRIBUCIÓN ACTUAL POR ESTADO:")
    print("-" * 80)
    total = len(oportunidades)
    for estado, count in sorted(estados.items()):
        print(f"{estado:<20} {count:>4} ({count/total*100:>5.1f}%)")
    
    print(f"\n{'TOTAL':<20} {total:>4}")
    
    # Calcular cuántas están realmente pendientes
    pendientes_reales = sum(1 for opp in oportunidades 
                           if opp.estado not in [EstadoOportunidad.GANADA.value, 
                                                EstadoOportunidad.PERDIDA.value])
    cerradas = sum(1 for opp in oportunidades 
                  if opp.estado in [EstadoOportunidad.GANADA.value, 
                                   EstadoOportunidad.PERDIDA.value])
    
    print("\n" + "=" * 80)
    print("  RESUMEN")
    print("=" * 80)
    print(f"""
    Total oportunidades: {total}
    - Pendientes (abiertas): {pendientes_reales} ({pendientes_reales/total*100:.1f}%)
    - Cerradas (ganadas + perdidas): {cerradas} ({cerradas/total*100:.1f}%)
    
    ⚠️  PROBLEMA IDENTIFICADO:
    El script de generación creó muchas oportunidades en estados intermedios
    (ABIERTA, VISITA, COTIZA, RESERVA) que NO se cerraron.
    
    Esto hace que se acumulen {pendientes_reales} pendientes, cuando el plan
    esperaba tener ~30-40 al final.
    
    📋 SOLUCIÓN:
    Necesitamos regenerar los datos asegurándonos de que:
    1. La mayoría de oportunidades se CIERREN (ganadas o perdidas)
    2. Solo ~30-40% queden en estados intermedios (pendientes)
    3. Respetar el balance mensual planeado
    """)

print("\n")
