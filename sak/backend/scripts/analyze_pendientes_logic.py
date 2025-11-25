"""
Analiza la lógica de cálculo del indicador "Pendientes" en el gráfico
"""

import sys
from pathlib import Path
from datetime import datetime, date, timedelta

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
print("  ANÁLISIS DEL INDICADOR 'PENDIENTES'")
print("=" * 80 + "\n")

with Session(engine) as session:
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    print(f"Total de oportunidades: {len(oportunidades)}\n")
    
    print("🔍 Analizando código actual en crm_dashboard.py:")
    print("-" * 80)
    print("""
    def _open_in_month(item, start_m, end_m):
        fecha_abierta = item.fecha_abierta or item.fecha_creacion
        if fecha_abierta and fecha_abierta > end_m:
            return False
        if item.fecha_cierre and item.fecha_cierre < start_m:
            return False
        return True
    
    def _opening_before(items, cut):
        return sum(1 for item in items 
                   if (item.fecha_abierta or item.fecha_creacion) < cut 
                   and not (item.fecha_cierre and item.fecha_cierre < cut))
    
    # En el bucle:
    previous_open = _opening_before(items, months[0][0])
    for month_start, month_end in months:
        total_count = sum(1 for item in items if _open_in_month(item, month_start, month_end))
        nuevas_count = ...
        ganadas_count = ...
        perdidas_count = ...
        pendientes_mes = previous_open  # ⚠️ AQUÍ ESTÁ EL PROBLEMA
        evolucion.append({
            "pendientes": pendientes_mes,
            ...
        })
        previous_open = total_count  # ⚠️ Y AQUÍ
    """)
    
    print("\n⚠️  PROBLEMA IDENTIFICADO:")
    print("-" * 80)
    print("""
    El código actual hace:
    1. Calcula "pendientes" como las oportunidades abiertas ANTES del inicio del mes
    2. Luego actualiza previous_open = total_count (oportunidades abiertas DURANTE el mes)
    
    Esto causa que:
    - Enero muestra: pendientes = oportunidades abiertas antes de enero
    - Febrero muestra: pendientes = oportunidades abiertas durante enero
    - Marzo muestra: pendientes = oportunidades abiertas durante febrero
    - etc.
    
    Hay un DESFASE de 1 mes, y el valor mostrado es "total_count" del mes anterior,
    que es la función _open_in_month() = oportunidades que están abiertas en algún
    momento del mes (no cerradas antes del inicio O creadas antes del final).
    
    Como cada mes se crean ~12 nuevas y solo se cierran ~6, el valor va creciendo
    linealmente porque se acumulan.
    """)
    
    print("\n💡 INTERPRETACIÓN CORRECTA DE 'PENDIENTES':")
    print("-" * 80)
    print("""
    "Pendientes" debería mostrar: oportunidades NO CERRADAS al FINAL de cada mes.
    
    Es decir, para cada mes:
    - Contar oportunidades creadas antes o durante el mes
    - Que NO estén cerradas (ganadas/perdidas) al final del mes
    - O que se cerraron DESPUÉS del final del mes
    
    Esto representa el "work in progress" o "pipeline activo" al cierre de cada mes.
    """)
    
    print("\n📊 SIMULACIÓN DEL CÁLCULO CORRECTO:")
    print("-" * 80)
    
    def fecha_cierre(opp):
        """Extrae fecha de cierre de una oportunidad"""
        logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
        for log in logs:
            if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
                return log.fecha_registro.date() if log.fecha_registro else None
        return None
    
    # Simular últimos 6 meses
    hoy = date(2025, 11, 25)
    meses = []
    for i in range(6, 0, -1):
        mes_date = hoy - timedelta(days=30*i)
        mes_inicio = date(mes_date.year, mes_date.month, 1)
        # Último día del mes
        if mes_date.month == 12:
            mes_fin = date(mes_date.year, 12, 31)
        else:
            mes_fin = date(mes_date.year, mes_date.month + 1, 1) - timedelta(days=1)
        meses.append((mes_inicio, mes_fin))
    
    print(f"{'Mes':<12} {'Pendientes (correcto)':>22} {'Creadas':>9} {'Cerradas':>9}")
    print("-" * 80)
    
    for mes_inicio, mes_fin in meses:
        # Pendientes al final del mes = creadas antes o durante - cerradas antes o durante
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
            
            # Pendientes = creadas antes o durante el mes Y no cerradas antes o durante
            if fecha_creacion <= mes_fin:
                if f_cierre is None or f_cierre > mes_fin:
                    pendientes += 1
        
        mes_str = mes_inicio.strftime("%Y-%m")
        print(f"{mes_str:<12} {pendientes:>22} {creadas_mes:>9} {cerradas_mes:>9}")
    
    print("\n" + "=" * 80)
    print("  CONCLUSIÓN")
    print("=" * 80)
    print("""
    ✅ SÍ HAY UN ERROR EN EL CÓDIGO ACTUAL
    
    El problema está en estas líneas:
    
        pendientes_mes = previous_open  # ⚠️ Usa el valor del mes ANTERIOR
        ...
        previous_open = total_count     # ⚠️ Actualiza para el siguiente mes
    
    Esto causa:
    1. DESFASE de 1 mes en los valores
    2. CRECIMIENTO LINEAL porque "total_count" incluye todas las oportunidades
       que están abiertas en algún momento del mes (acumulativo)
    
    📋 SOLUCIÓN:
    
    Calcular "pendientes" correctamente como:
    
        pendientes_count = sum(
            1 for item in items
            if item.fecha_creacion <= month_end
            and (item.fecha_cierre is None or item.fecha_cierre > month_end)
        )
    
    Esto contará las oportunidades que están ACTIVAMENTE PENDIENTES al final
    de cada mes (creadas antes o durante, no cerradas todavía).
    """)

print("\n")
