#!/usr/bin/env python3
"""
Script para poblar la tabla proy_presupuestos con datos ficticios
Genera registros mensuales para proyectos 14-17 desde dic-2025 hasta abr-2026
"""

import sys
import random
from datetime import date
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.proy_presupuesto import ProyPresupuesto

def poblar_presupuestos_proyectos():
    print('=== POBLACION DE PRESUPUESTOS PROYECTOS 14-17 ===')
    print()
    
    try:
        session = next(get_session())
        
        # IDs de proyectos objetivo
        proyecto_ids = [14, 15, 16, 17]
        
        # Fechas mensuales (último día de cada mes)
        fechas = [
            date(2025, 12, 31),  # Diciembre 2025
            date(2026, 1, 31),   # Enero 2026
            date(2026, 2, 28),   # Febrero 2026
            date(2026, 3, 31),   # Marzo 2026
            date(2026, 4, 30),   # Abril 2026
        ]
        
        # Verificar que existen los proyectos
        proyectos_existentes = []
        for pid in proyecto_ids:
            proyecto = session.get(Proyecto, pid)
            if proyecto:
                proyectos_existentes.append(pid)
                print(f'✓ Proyecto {pid}: {proyecto.nombre}')
            else:
                print(f'⚠️  Proyecto {pid} no encontrado')
        
        if not proyectos_existentes:
            print('❌ No se encontraron proyectos válidos')
            return
        
        print(f'\\nGenerando presupuestos para {len(proyectos_existentes)} proyectos x {len(fechas)} meses = {len(proyectos_existentes) * len(fechas)} registros')
        
        # Eliminar registros existentes para estos proyectos
        registros_existentes = session.exec(
            select(ProyPresupuesto)
            .where(ProyPresupuesto.proyecto_id.in_(proyectos_existentes))
            .where(ProyPresupuesto.deleted_at.is_(None))
        ).all()
        
        if registros_existentes:
            print(f'\\n🗑️  Eliminando {len(registros_existentes)} presupuestos existentes...')
            for registro in registros_existentes:
                session.delete(registro)
            session.commit()
        
        print()
        
        registros_creados = 0
        
        for proyecto_id in proyectos_existentes:
            for fecha in fechas:
                # Generar valores ficticios realistas en decenas de millones
                # Los valores aumentan progresivamente mes a mes (simulando progreso)
                mes_index = fechas.index(fecha)
                factor_progreso = 1 + (mes_index * 0.15)  # 15% más cada mes
                
                # Base values que varían por proyecto - en decenas de millones
                base_mo_propia = random.uniform(15000000, 45000000) * factor_progreso      # 15-45 millones
                base_mo_terceros = random.uniform(8000000, 25000000) * factor_progreso     # 8-25 millones
                base_materiales = random.uniform(20000000, 60000000) * factor_progreso     # 20-60 millones
                base_horas = random.uniform(2000, 8000) * factor_progreso                  # 2000-8000 horas
                base_metros = random.uniform(500, 2500) * factor_progreso                  # 500-2500 metros
                
                presupuesto = ProyPresupuesto(
                    proyecto_id=proyecto_id,
                    fecha=fecha,
                    mo_propia=Decimal(f"{base_mo_propia:.2f}"),
                    mo_terceros=Decimal(f"{base_mo_terceros:.2f}"),
                    materiales=Decimal(f"{base_materiales:.2f}"),
                    horas=Decimal(f"{base_horas:.2f}"),
                    metros=Decimal(f"{base_metros:.2f}")
                )
                
                session.add(presupuesto)
                registros_creados += 1
                
                print(f'✓ Proyecto {proyecto_id} - {fecha.strftime("%b %Y")} - MO: ${base_mo_propia/1000000:,.2f}M - Mat: ${base_materiales/1000000:,.2f}M - Hrs: {base_horas:,.0f}')
        
        if registros_creados > 0:
            session.commit()
            print(f'\\n✅ {registros_creados} presupuestos creados exitosamente')
        else:
            print('\\n⚠️  No se crearon nuevos registros')
            
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        if 'session' in locals():
            session.rollback()
    finally:
        if 'session' in locals():
            session.close()

if __name__ == '__main__':
    poblar_presupuestos_proyectos()