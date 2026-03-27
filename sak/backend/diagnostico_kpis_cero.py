#!/usr/bin/env python3
"""
Script de diagnóstico para investigar por qué los KPIs están en cero
"""

import sys
import os
from pathlib import Path

# Configurar path correctamente
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Imports después de configurar el path
from sqlmodel import Session, create_engine, select
from app.models.proyecto import Proyecto
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto_avance import ProyectoAvance
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders
from dotenv import load_dotenv

def get_database_session():
    """Crear sesión de base de datos"""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")
    
    # Conectar a la base de datos
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    return Session(engine)

async def diagnostico_kpis_cero():
    """Investiga por qué los KPIs están en cero"""
    
    print(f"🔍 DIAGNÓSTICO: ¿Por qué KPIs están en cero?")
    print(f"📅 Período de prueba: 2025-12-01 a 2026-01-31")
    print(f"=" * 70)
    
    session = get_database_session()
    
    try:
        # 1. Verificar proyectos y sus estados
        print(f"\\n1️⃣ VERIFICANDO PROYECTOS Y ESTADOS")
        stmt_proyectos = select(
            Proyecto.id,
            Proyecto.nombre,  # Corregido el nombre del campo
            Proyecto.estado,
            Proyecto.created_at,
            Proyecto.oportunidad_id
        ).limit(20)
        
        proyectos = session.exec(stmt_proyectos).all()
        print(f"   📊 Total proyectos en BD: {len(proyectos)}")
        
        # Análisis de estados
        estados_count = {}
        for p in proyectos:
            estado = p.estado or "NULL"
            estados_count[estado] = estados_count.get(estado, 0) + 1
        
        print(f"   📈 Estados encontrados:")
        for estado, count in estados_count.items():
            print(f"       - {estado}: {count} proyectos")
        
        # 2. Verificar filtros de proyectos activos
        print(f"\\n2️⃣ VERIFICANDO FILTRO DE PROYECTOS ACTIVOS")
        filtro_activos = ['INICIADO', 'EN_PROGRESO', 'PAUSADO']
        print(f"   🔍 Filtros aplicados: {filtro_activos}")
        
        stmt_activos = select(Proyecto).where(
            Proyecto.estado.in_(filtro_activos)
        )
        proyectos_activos = session.exec(stmt_activos).all()
        print(f"   📊 Proyectos que pasan filtro: {len(proyectos_activos)}")
        
        if len(proyectos_activos) == 0:
            print(f"   ❌ PROBLEMA: Ningún proyecto pasa el filtro de activos!")
            print(f"   💡 SUGERENCIA: Revisar estados reales vs filtros")
            
            # Intentar con estados que realmente existen
            estados_reales = list(estados_count.keys())[:3]  # Primeros 3 estados
            print(f"   🔧 Probando con estados reales: {estados_reales}")
            
            stmt_reales = select(Proyecto).where(
                Proyecto.estado.in_(estados_reales)
            )
            proyectos_reales = session.exec(stmt_reales).all()
            print(f"   📊 Proyectos con estados reales: {len(proyectos_reales)}")
        
        # 3. Verificar datos de presupuesto
        print(f"\\n3️⃣ VERIFICANDO DATOS DE PRESUPUESTO")
        stmt_presupuesto_count = select(ProyPresupuesto)
        total_presupuestos = session.exec(stmt_presupuesto_count).all()
        print(f"   📊 Total registros proy_presupuesto: {len(total_presupuestos)}")
        
        if len(total_presupuestos) > 0:
            # Mostrar algunos ejemplos
            print(f"   📋 Ejemplos de presupuestos:")
            for i, pres in enumerate(total_presupuestos[:3]):
                print(f"       {i+1}. Proyecto {pres.proyecto_id} - Fecha: {pres.fecha} - Total: ${float(pres.mo_propia + pres.mo_terceros + pres.materiales):,.2f}")
            
            # Ver fechas de presupuestos
            fechas_presupuesto = [p.fecha for p in total_presupuestos if p.fecha]
            if fechas_presupuesto:
                fecha_min = min(fechas_presupuesto)
                fecha_max = max(fechas_presupuesto)
                print(f"   📅 Rango fechas presupuesto: {fecha_min} a {fecha_max}")
        else:
            print(f"   ❌ PROBLEMA: No hay datos de presupuesto!")
        
        # 4. Verificar vista optimizada
        print(f"\\n4️⃣ VERIFICANDO VISTA OPTIMIZADA")
        try:
            stmt_vista = select(VwKpisProyectosPoOrders).limit(10)
            datos_vista = session.exec(stmt_vista).all()
            print(f"   📊 Total registros en vista: {len(datos_vista)}")
            
            if len(datos_vista) > 0:
                print(f"   📋 Ejemplos de vista:")
                for i, vista in enumerate(datos_vista[:3]):
                    print(f"       {i+1}. Orden {vista.nro_orden} - Proyecto {vista.proyecto_id} - Fecha: {vista.fecha_emision} - Importe: ${float(vista.importe):,.2f}")
                
                # Ver fechas de la vista
                fechas_vista = [v.fecha_emision for v in datos_vista if v.fecha_emision]
                if fechas_vista:
                    fecha_min_vista = min(fechas_vista)
                    fecha_max_vista = max(fechas_vista)
                    print(f"   📅 Rango fechas vista: {fecha_min_vista} a {fecha_max_vista}")
            else:
                print(f"   ❌ PROBLEMA: Vista optimizada vacía!")
        except Exception as e:
            print(f"   ❌ ERROR accediendo vista: {e}")
        
        # 5. Verificar datos de avances
        print(f"\\n5️⃣ VERIFICANDO DATOS DE AVANCES")
        stmt_avances_count = select(ProyectoAvance)
        total_avances = session.exec(stmt_avances_count).all()
        print(f"   📊 Total registros proyecto_avances: {len(total_avances)}")
        
        if len(total_avances) > 0:
            print(f"   📋 Ejemplos de avances:")
            for i, avance in enumerate(total_avances[:3]):
                print(f"       {i+1}. Proyecto {avance.proyecto_id} - Fecha: {avance.fecha_registracion} - Importe: ${float(avance.importe or 0):,.2f} - Horas: {avance.horas or 0}")
            
            # Ver fechas de avances
            fechas_avances = [a.fecha_registracion for a in total_avances if a.fecha_registracion]
            if fechas_avances:
                fecha_min_avance = min(fechas_avances)
                fecha_max_avance = max(fechas_avances)
                print(f"   📅 Rango fechas avances: {fecha_min_avance} a {fecha_max_avance}")
        else:
            print(f"   ❌ PROBLEMA: No hay datos de avances!")
        
        # 6. Recomendaciones
        print(f"\\n💡 RECOMENDACIONES:")
        if len(proyectos_activos) == 0:
            print(f"   🔧 1. Ajustar filtros de estados activos")
            print(f"       Estados reales: {list(estados_count.keys())}")
        
        if len(total_presupuestos) == 0:
            print(f"   🔧 2. Verificar datos en tabla proy_presupuesto")
        
        if len(datos_vista) == 0:
            print(f"   🔧 3. Revisar vista optimizada vw_kpis_proyectos_po_orders")
        
        if len(total_avances) == 0:
            print(f"   🔧 4. Verificar datos en tabla proyecto_avances")
            
    except Exception as e:
        print(f"❌ Error en diagnóstico: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(diagnostico_kpis_cero())