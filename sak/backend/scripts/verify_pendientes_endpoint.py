"""
Verifica qué está devolviendo el endpoint vs el cálculo correcto de pendientes
"""

import sys
from pathlib import Path
from datetime import datetime, date, timedelta, timezone
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
from app.services.crm_dashboard import fetch_oportunidades_for_dashboard, build_crm_dashboard_payload
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad

print("\n" + "=" * 80)
print("  VERIFICACIÓN: ENDPOINT VS CÁLCULO CORRECTO")
print("=" * 80 + "\n")

with Session(engine) as session:
    # Últimos 12 meses
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=365)
    
    print(f"Periodo: {start} a {end}\n")
    
    # Cargar items como lo hace el endpoint
    items = fetch_oportunidades_for_dashboard(
        session=session,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        tipo_operacion_ids=None,
        tipo_propiedad=None,
        responsable_ids=None,
        propietario=None,
        emprendimiento_ids=None,
    )
    
    # Obtener datos del endpoint
    payload = build_crm_dashboard_payload(
        items=items,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        session=session,
    )
    
    evolucion = payload.get("evolucion", [])
    
    # Filtrar solo meses de 2025
    evolucion_2025 = [e for e in evolucion if e["bucket"].startswith("2025")]
    
    print("📊 DATOS DEL ENDPOINT (backend actual):")
    print("-" * 80)
    print(f"{'Mes':<12} {'Totales':>8} {'Pendientes':>11} {'Ganadas':>8} {'Perdidas':>9} {'Nuevas':>8}")
    print("-" * 80)
    
    for bucket in evolucion_2025:
        mes = bucket.get("bucket", "N/A")
        totales = bucket.get("totales", 0)
        pendientes = bucket.get("pendientes", 0)
        ganadas = bucket.get("ganadas", 0)
        perdidas = bucket.get("perdidas", 0)
        nuevas = bucket.get("nuevas", 0)
        
        print(f"{mes:<12} {totales:>8} {pendientes:>11} {ganadas:>8} {perdidas:>9} {nuevas:>8}")
    
    print("\n💡 OBSERVACIÓN:")
    print("-" * 80)
    print("""
    Si "Pendientes" está creciendo constantemente, hay dos posibilidades:
    
    1. El cálculo sigue siendo incorrecto (desfase o lógica equivocada)
    2. El cálculo es correcto pero realmente hay acumulación de pipeline
       (se crean más oportunidades de las que se cierran)
    """)
    
    # Calcular manualmente pendientes correctos
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    def fecha_cierre(opp):
        """Extrae fecha de cierre de una oportunidad"""
        logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
        for log in logs:
            if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
                return log.fecha_registro.date() if log.fecha_registro else None
        return None
    
    print("\n📊 CÁLCULO MANUAL CORRECTO:")
    print("-" * 80)
    print(f"{'Mes':<12} {'Pendientes':>11} {'Creadas mes':>12} {'Cerradas mes':>13} {'Variación':>11}")
    print("-" * 80)
    
    meses_2025 = []
    for mes in range(1, 12):
        # Primer y último día del mes
        mes_inicio = date(2025, mes, 1)
        if mes == 12:
            mes_fin = date(2025, 12, 31)
        else:
            mes_fin = date(2025, mes + 1, 1) - timedelta(days=1)
        
        if mes_fin > end:
            mes_fin = end
        
        meses_2025.append((mes_inicio, mes_fin))
    
    pendientes_anterior = 0
    for mes_inicio, mes_fin in meses_2025:
        # PENDIENTES CORRECTOS: creadas antes o durante el mes Y no cerradas antes o durante
        pendientes = 0
        creadas_mes = 0
        cerradas_mes = 0
        
        for opp in oportunidades:
            if not opp.created_at:
                continue
            
            fecha_creacion = opp.created_at.date()
            f_cierre = fecha_cierre(opp)
            
            # Contar creadas en este mes
            if mes_inicio <= fecha_creacion <= mes_fin:
                creadas_mes += 1
            
            # Contar cerradas en este mes
            if f_cierre and mes_inicio <= f_cierre <= mes_fin:
                cerradas_mes += 1
            
            # PENDIENTES AL FINAL DEL MES:
            # - Creada antes o durante el mes
            # - NO cerrada antes o durante el mes (cerrada después o no cerrada)
            if fecha_creacion <= mes_fin:
                if f_cierre is None or f_cierre > mes_fin:
                    pendientes += 1
        
        variacion = pendientes - pendientes_anterior if pendientes_anterior > 0 else pendientes
        pendientes_anterior = pendientes
        
        mes_str = mes_inicio.strftime("%Y-%m")
        print(f"{mes_str:<12} {pendientes:>11} {creadas_mes:>12} {cerradas_mes:>13} {variacion:>+11}")
    
    print("\n" + "=" * 80)
    print("  ANÁLISIS")
    print("=" * 80)
    print("""
    Compara los valores de "Pendientes" del endpoint vs el cálculo manual.
    
    Si son diferentes:
    ✅ El backend tiene un error de lógica que debe corregirse
    
    Si son iguales:
    ✅ El cálculo es correcto
    ⚠️  El crecimiento es REAL y refleja acumulación de pipeline:
        - Se crean más oportunidades de las que se cierran
        - Es un indicador válido de que hay trabajo acumulándose
    """)

print("\n")
