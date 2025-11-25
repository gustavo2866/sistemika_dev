"""
Análisis detallado del problema de cálculo de pendientes
"""

import sys
from pathlib import Path
from datetime import datetime, date, timedelta, timezone

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
print("  ANÁLISIS DETALLADO DEL PROBLEMA")
print("=" * 80 + "\n")

with Session(engine) as session:
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    print(f"Total oportunidades: {len(oportunidades)}\n")
    
    def fecha_cierre(opp):
        logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
        for log in logs:
            if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
                return log.fecha_registro.date() if log.fecha_registro else None
        return None
    
    # Simular el código ACTUAL del backend
    print("🔴 LÓGICA ACTUAL DEL BACKEND (INCORRECTA):")
    print("-" * 80)
    print("""
    def _open_in_month(item, start_m, end_m):
        fecha_abierta = item.fecha_abierta or item.fecha_creacion
        # Si fue creada DESPUÉS del fin del mes → NO cuenta
        if fecha_abierta and fecha_abierta > end_m:
            return False
        # Si fue cerrada ANTES del inicio del mes → NO cuenta  
        if item.fecha_cierre and item.fecha_cierre < start_m:
            return False
        # En cualquier otro caso → SÍ cuenta
        return True
    
    def _opening_before(items, cut):
        # Cuenta oportunidades abiertas ANTES de la fecha de corte
        return sum(1 for item in items
                   if (item.fecha_abierta or item.fecha_creacion) < cut
                   and not (item.fecha_cierre and item.fecha_cierre < cut))
    
    # En el bucle:
    previous_open = _opening_before(items, months[0][0])  # Antes del primer mes
    for month_start, month_end in months:
        total_count = sum(1 for item in items if _open_in_month(item, month_start, month_end))
        pendientes_mes = previous_open  # ⚠️ PROBLEMA 1: usa valor del paso anterior
        ...
        previous_open = total_count     # ⚠️ PROBLEMA 2: actualiza con total_count
    """)
    
    print("\n📊 SIMULACIÓN PASO A PASO:")
    print("-" * 80)
    
    # Preparar meses
    meses = []
    for mes in range(12, 13):  # Solo dic 2024
        meses.append((date(2024, mes, 1), date(2024, mes, 31)))
    for mes in range(1, 12):  # 2025
        mes_inicio = date(2025, mes, 1)
        if mes == 12:
            mes_fin = date(2025, 12, 31)
        else:
            mes_fin = date(2025, mes + 1, 1) - timedelta(days=1)
        meses.append((mes_inicio, mes_fin))
    
    # Simular código actual
    def _open_in_month(opp, start_m, end_m):
        """Replica la función del backend"""
        fecha_abierta = opp.created_at.date() if opp.created_at else None
        f_cierre = fecha_cierre(opp)
        
        if fecha_abierta and fecha_abierta > end_m:
            return False
        if f_cierre and f_cierre < start_m:
            return False
        return True
    
    def _opening_before(cut):
        """Cuenta oportunidades abiertas antes de la fecha"""
        count = 0
        for opp in oportunidades:
            if not opp.created_at:
                continue
            fecha_abierta = opp.created_at.date()
            f_cierre = fecha_cierre(opp)
            
            if fecha_abierta < cut and not (f_cierre and f_cierre < cut):
                count += 1
        return count
    
    print(f"{'Paso':<6} {'Mes':<12} {'previous_open':>15} {'total_count':>12} {'pendientes_mes':>16}")
    print("-" * 80)
    
    previous_open = _opening_before(meses[0][0])
    print(f"{'INIT':<6} {'(antes)':<12} {previous_open:>15} {'-':>12} {'-':>16}")
    
    for i, (month_start, month_end) in enumerate(meses):
        # Total count = cuántas están "abiertas" en algún momento del mes
        total_count = sum(1 for opp in oportunidades if _open_in_month(opp, month_start, month_end))
        
        # Pendientes = valor de previous_open (que es total_count del mes anterior)
        pendientes_mes = previous_open
        
        mes_str = month_start.strftime("%Y-%m")
        print(f"{i+1:<6} {mes_str:<12} {previous_open:>15} {total_count:>12} {pendientes_mes:>16}")
        
        # Actualizar para siguiente iteración
        previous_open = total_count
    
    print("\n" + "=" * 80)
    print("  EXPLICACIÓN DEL CRECIMIENTO")
    print("=" * 80)
    print("""
    El problema tiene 2 causas combinadas:
    
    1️⃣ DESFASE DE 1 MES:
       - "pendientes" del mes N muestra el "total_count" del mes N-1
       - Enero muestra: pendientes = opening_before(enero) ≈ dic 2024
       - Febrero muestra: pendientes = total_count de enero
       - Marzo muestra: pendientes = total_count de febrero
       - etc.
    
    2️⃣ TOTAL_COUNT ES ACUMULATIVO:
       - _open_in_month() cuenta oportunidades que están "activas" en ALGÚN
         momento del mes
       - Incluye: creadas antes o durante el mes Y no cerradas antes del mes
       - Como se crean ~11 nuevas por mes y solo se cierran ~7-8
       - total_count crece constantemente (+3-4 netas por mes)
       - Y este valor acumulativo se usa como "pendientes" del mes siguiente
    
    3️⃣ EFECTO COMBINADO:
       - Enero: pendientes = 5 (opening_before de enero, pocas opps en dic 2024)
       - Febrero: pendientes = 11 (total_count de enero)
       - Marzo: pendientes = 21 (total_count de febrero, acumuló +10)
       - Abril: pendientes = 27 (total_count de marzo, acumuló +6)
       - ...continúa creciendo porque cada mes se acumula más
    
    ✅ SOLUCIÓN:
       Calcular pendientes directamente como:
       
       pendientes_count = sum(
           1 for item in items
           if item.fecha_creacion <= month_end
           and (item.fecha_cierre is None or item.fecha_cierre > month_end)
       )
       
       Esto cuenta correctamente las oportunidades NO CERRADAS al final de cada mes,
       sin desfase y sin usar acumuladores incorrectos.
    """)

print("\n")
