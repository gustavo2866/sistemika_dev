"""
Verifica la distribución mensual después del ajuste de cantidades
"""

import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Agregar el directorio backend al path de Python
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Cargar variables de entorno
from dotenv import load_dotenv
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad

print("\n" + "=" * 80)
print("  DISTRIBUCIÓN MENSUAL DESPUÉS DEL AJUSTE")
print("=" * 80 + "\n")

with Session(engine) as session:
    # Obtener todas las oportunidades
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    print(f"Total de oportunidades: {len(oportunidades)}\n")
    
    # Agrupar por mes de creación
    por_mes = defaultdict(lambda: {"creadas": 0, "ganadas": 0, "perdidas": 0, "abiertas": 0})
    
    for opp in oportunidades:
        if not opp.created_at:
            continue
        
        mes = opp.created_at.strftime("%Y-%m")
        por_mes[mes]["creadas"] += 1
        
        if opp.estado == EstadoOportunidad.GANADA.value:
            por_mes[mes]["ganadas"] += 1
        elif opp.estado == EstadoOportunidad.PERDIDA.value:
            por_mes[mes]["perdidas"] += 1
        else:
            por_mes[mes]["abiertas"] += 1
    
    print("📊 Distribución mensual:")
    print("-" * 80)
    print(f"{'Mes':<12} {'Creadas':>8} {'Ganadas':>8} {'Perdidas':>9} {'Abiertas':>9} {'Cerradas':>9}")
    print("-" * 80)
    
    for mes in sorted(por_mes.keys()):
        data = por_mes[mes]
        cerradas = data["ganadas"] + data["perdidas"]
        print(f"{mes:<12} {data['creadas']:>8} {data['ganadas']:>8} {data['perdidas']:>9} {data['abiertas']:>9} {cerradas:>9}")
    
    # Totales
    total_creadas = sum(d["creadas"] for d in por_mes.values())
    total_ganadas = sum(d["ganadas"] for d in por_mes.values())
    total_perdidas = sum(d["perdidas"] for d in por_mes.values())
    total_abiertas = sum(d["abiertas"] for d in por_mes.values())
    total_cerradas = total_ganadas + total_perdidas
    
    print("-" * 80)
    print(f"{'TOTAL':<12} {total_creadas:>8} {total_ganadas:>8} {total_perdidas:>9} {total_abiertas:>9} {total_cerradas:>9}")
    print("-" * 80)
    
    print(f"\n📈 Promedio mensual:")
    meses_con_datos = len(por_mes)
    print(f"  - Creadas: {total_creadas/meses_con_datos:.1f}")
    print(f"  - Ganadas: {total_ganadas/meses_con_datos:.1f}")
    print(f"  - Perdidas: {total_perdidas/meses_con_datos:.1f}")
    print(f"  - Cerradas: {total_cerradas/meses_con_datos:.1f}")
    
    print(f"\n💡 Proporción creadas vs cerradas:")
    print(f"  - Por cada oportunidad cerrada se crean {total_creadas/total_cerradas:.1f} oportunidades")
    print(f"  - Tasa de cierre: {total_cerradas/total_creadas*100:.1f}%")

print("\n" + "=" * 80 + "\n")
