"""
Analiza la lógica de cálculo de evolución mensual para entender por qué
las oportunidades totales crecen con el tiempo.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from decimal import Decimal

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
print("  ANÁLISIS DE LÓGICA DE EVOLUCIÓN MENSUAL")
print("=" * 80 + "\n")

with Session(engine) as session:
    # Obtener todas las oportunidades
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = session.exec(query).all()
    
    print(f"Total de oportunidades en BD: {len(oportunidades)}")
    
    # Agrupar por fecha de creación
    por_mes_creacion = {}
    for opp in oportunidades:
        if not opp.created_at:
            continue
        mes = opp.created_at.strftime("%Y-%m")
        if mes not in por_mes_creacion:
            por_mes_creacion[mes] = []
        por_mes_creacion[mes].append(opp)
    
    print("\n📊 Oportunidades CREADAS por mes:")
    print("-" * 80)
    print(f"{'Mes':<12} {'Creadas':>10} {'Acumulado':>12}")
    print("-" * 80)
    
    acumulado = 0
    for mes in sorted(por_mes_creacion.keys()):
        count = len(por_mes_creacion[mes])
        acumulado += count
        print(f"{mes:<12} {count:>10} {acumulado:>12}")
    
    # Analizar qué representa "totales" en el gráfico
    print("\n" + "=" * 80)
    print("  ANÁLISIS CONCEPTUAL DEL INDICADOR 'TOTALES'")
    print("=" * 80)
    
    print("\n🔍 Según el código en crm_dashboard.py:")
    print("-" * 80)
    print("""
    def _belongs_total(item, start_m, end_m):
        closed_in = item.fecha_cierre and start_m <= item.fecha_cierre <= end_m
        open_in = (item.fecha_cierre is None or item.fecha_cierre > end_m) 
                  and item.fecha_creacion <= end_m
        return bool(closed_in or open_in)
    
    Esto significa que para cada mes, "totales" cuenta:
    1. Oportunidades que se cerraron EN ese mes (closed_in)
    2. Oportunidades que estaban ABIERTAS al final de ese mes (open_in)
       - Es decir: creadas antes o durante ese mes Y no cerradas antes
    """)
    
    print("\n💡 INTERPRETACIÓN:")
    print("-" * 80)
    print("""
    El gráfico muestra una curva ASCENDENTE porque:
    
    - En enero 2025: muestra las oportunidades que estaban abiertas al 31/01/2025
      + las que se cerraron en enero
      
    - En febrero 2025: muestra las oportunidades que estaban abiertas al 28/02/2025
      (que incluyen las de enero que NO se cerraron + las nuevas de febrero)
      + las que se cerraron en febrero
      
    - En marzo 2025: muestra las oportunidades abiertas al 31/03/2025
      (que incluyen todas las de enero y febrero que NO se cerraron + las nuevas de marzo)
      + las que se cerraron en marzo
    
    Es un EFECTO ACUMULATIVO: cada mes suma nuevas oportunidades, y las que no
    se cierran se arrastran al siguiente mes.
    """)
    
    # Verificar con datos reales
    print("\n" + "=" * 80)
    print("  VERIFICACIÓN CON DATOS REALES")
    print("=" * 80 + "\n")
    
    # Simulemos el cálculo para algunos meses
    from datetime import date
    
    def fecha_cierre(opp):
        """Extrae fecha de cierre de una oportunidad"""
        logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
        for log in logs:
            if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
                return log.fecha_registro.date() if log.fecha_registro else None
        return None
    
    # Analizar algunos meses
    meses_analizar = [
        (date(2024, 12, 1), date(2024, 12, 31)),
        (date(2025, 1, 1), date(2025, 1, 31)),
        (date(2025, 2, 1), date(2025, 2, 28)),
        (date(2025, 11, 1), date(2025, 11, 25)),
    ]
    
    print(f"{'Mes':<12} {'Cerradas en mes':>15} {'Abiertas al final':>20} {'TOTAL':>10}")
    print("-" * 80)
    
    for start_m, end_m in meses_analizar:
        cerradas_en_mes = 0
        abiertas_al_final = 0
        
        for opp in oportunidades:
            if not opp.created_at:
                continue
            
            fecha_creacion = opp.created_at.date()
            f_cierre = fecha_cierre(opp)
            
            # Cerradas en este mes
            if f_cierre and start_m <= f_cierre <= end_m:
                cerradas_en_mes += 1
            
            # Abiertas al final del mes
            if (f_cierre is None or f_cierre > end_m) and fecha_creacion <= end_m:
                abiertas_al_final += 1
        
        total = cerradas_en_mes + abiertas_al_final
        mes_str = start_m.strftime("%Y-%m")
        print(f"{mes_str:<12} {cerradas_en_mes:>15} {abiertas_al_final:>20} {total:>10}")
    
    print("\n" + "=" * 80)
    print("  CONCLUSIÓN")
    print("=" * 80)
    print("""
    ✅ NO ES UN ERROR DE DATOS
    ✅ NO ES UN ERROR DE CÓDIGO
    
    ⚠️  ES UN PROBLEMA CONCEPTUAL DEL INDICADOR
    
    El indicador "Totales" actual mezcla dos conceptos:
    - Oportunidades que SE CERRARON en ese mes
    - Oportunidades que ESTABAN ABIERTAS al final de ese mes
    
    Esto genera un efecto acumulativo donde cada mes muestra más oportunidades
    porque se van sumando las nuevas creaciones mientras las antiguas permanecen
    abiertas.
    
    📋 RECOMENDACIONES:
    
    1. Si quieres ver "flujo de entrada": mostrar solo oportunidades CREADAS ese mes
    
    2. Si quieres ver "pipeline activo": mostrar oportunidades ABIERTAS al final
       de cada mes (esto seguirá creciendo si se crean más de las que se cierran)
    
    3. Si quieres ver "actividad del mes": mostrar:
       - Creadas en el mes
       - Ganadas en el mes
       - Perdidas en el mes
       - Balance (creadas - cerradas)
    
    4. Lo más común en dashboards CRM: mostrar cada mes SOLO las oportunidades
       que ENTRARON en ese mes (created_at), independiente de su estado actual.
       Esto da una línea que refleja el flujo real de entrada de oportunidades.
    """)

print()
