#!/usr/bin/env python3
"""
Verificar que todas las órdenes con estado diferente a 'solicitada' y 'borrador' 
tengan un log de estado 'emitida' con fecha anterior o igual al estado actual
"""

import sys
sys.path.insert(0, '.')
from datetime import datetime
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderStatus, PoOrderStatusLog

def verificar_consistencia_estados_ordenes():
    print('=== VERIFICACIÓN DE CONSISTENCIA DE ESTADOS EN ÓRDENES ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener el ID del estado "emitida"
        estado_emitida = session.exec(
            select(PoOrderStatus).where(PoOrderStatus.nombre == "emitida")
        ).first()
        
        if not estado_emitida:
            print('❌ ERROR: No se encontró el estado "emitida"')
            return
        
        print(f'Estado "emitida" encontrado con ID: {estado_emitida.id}')
        
        # Obtener estados que NO son "solicitada" ni "borrador"
        estados_excluidos = session.exec(
            select(PoOrderStatus).where(PoOrderStatus.nombre.in_(["solicitada", "borrador"]))
        ).all()
        
        estados_excluidos_ids = [e.id for e in estados_excluidos]
        print(f'Estados excluidos de la verificación: {[e.nombre for e in estados_excluidos]}')
        
        # Obtener todas las órdenes del departamento Proyectos con estado diferente a solicitada/borrador
        ordenes_a_verificar = session.exec(
            select(PoOrder)
            .where(PoOrder.departamento_id == 4)  # Departamento Proyectos
            .where(~PoOrder.order_status_id.in_(estados_excluidos_ids))
            .order_by(PoOrder.id)
        ).all()
        
        print(f'Total órdenes a verificar: {len(ordenes_a_verificar)}')
        print()
        
        if len(ordenes_a_verificar) == 0:
            print('✅ No hay órdenes que verificar')
            return
        
        # Verificar cada orden
        ordenes_inconsistentes = []
        ordenes_consistentes = 0
        
        for orden in ordenes_a_verificar:
            print(f'Verificando orden ID {orden.id}: "{orden.titulo[:40]}..." - Estado: {orden.order_status.nombre}')
            
            # Obtener todos los logs de estado de esta orden
            logs_estado = session.exec(
                select(PoOrderStatusLog)
                .where(PoOrderStatusLog.order_id == orden.id)
                .order_by(PoOrderStatusLog.fecha_registro)
            ).all()
            
            # Verificar si existe un log con estado "emitida"
            log_emitida = None
            for log in logs_estado:
                if log.status_nuevo_id == estado_emitida.id:
                    log_emitida = log
                    break
            
            if not log_emitida:
                # No hay registro de estado "emitida"
                ordenes_inconsistentes.append({
                    'orden_id': orden.id,
                    'titulo': orden.titulo,
                    'estado_actual': orden.order_status.nombre,
                    'fecha_actual': orden.updated_at,
                    'problema': 'Falta registro de estado "emitida"',
                    'logs_existentes': [(log.status_nuevo.nombre if log.status_nuevo else 'NULL', log.fecha_registro) for log in logs_estado]
                })
                print(f'  ❌ INCONSISTENTE: No tiene registro de estado "emitida"')
                continue
            
            # Obtener el log del estado actual
            log_estado_actual = None
            for log in reversed(logs_estado):  # Buscar desde el más reciente
                if log.status_nuevo_id == orden.order_status_id:
                    log_estado_actual = log
                    break
            
            if not log_estado_actual:
                ordenes_inconsistentes.append({
                    'orden_id': orden.id,
                    'titulo': orden.titulo,
                    'estado_actual': orden.order_status.nombre,
                    'fecha_actual': orden.updated_at,
                    'problema': 'No se encontró log del estado actual',
                    'logs_existentes': [(log.status_nuevo.nombre if log.status_nuevo else 'NULL', log.fecha_registro) for log in logs_estado]
                })
                print(f'  ❌ INCONSISTENTE: No se encontró log del estado actual')
                continue
            
            # Verificar que la fecha del estado "emitida" sea anterior o igual al estado actual
            if log_emitida.fecha_registro > log_estado_actual.fecha_registro:
                ordenes_inconsistentes.append({
                    'orden_id': orden.id,
                    'titulo': orden.titulo,
                    'estado_actual': orden.order_status.nombre,
                    'fecha_actual': orden.updated_at,
                    'problema': f'Estado "emitida" ({log_emitida.fecha_registro}) posterior al estado actual ({log_estado_actual.fecha_registro})',
                    'logs_existentes': [(log.status_nuevo.nombre if log.status_nuevo else 'NULL', log.fecha_registro) for log in logs_estado]
                })
                print(f'  ❌ INCONSISTENTE: Fecha "emitida" posterior al estado actual')
                continue
            
            # Orden consistente
            ordenes_consistentes += 1
            print(f'  ✅ CONSISTENTE: Estado "emitida" en {log_emitida.fecha_registro}, estado actual en {log_estado_actual.fecha_registro}')
        
        # Mostrar resumen
        print('\n=== RESUMEN DE VERIFICACIÓN ===')
        print(f'Órdenes verificadas: {len(ordenes_a_verificar)}')
        print(f'Órdenes consistentes: {ordenes_consistentes}')
        print(f'Órdenes inconsistentes: {len(ordenes_inconsistentes)}')
        
        if len(ordenes_inconsistentes) > 0:
            print('\n=== ÓRDENES INCONSISTENTES ===')
            print('ID   | Título                           | Estado        | Problema')
            print('-' * 90)
            
            for inconsistente in ordenes_inconsistentes:
                titulo_corto = inconsistente['titulo'][:30] + '...' if len(inconsistente['titulo']) > 30 else inconsistente['titulo']
                estado_corto = inconsistente['estado_actual'][:11]
                
                print(f"{inconsistente['orden_id']:4d} | {titulo_corto:32s} | {estado_corto:13s} | {inconsistente['problema']}")
                
                # Mostrar logs existentes para esta orden
                print(f"     | Logs existentes:")
                for estado_nombre, fecha in inconsistente['logs_existentes']:
                    print(f"     |   - {estado_nombre} en {fecha}")
                print()
        else:
            print('\n✅ Todas las órdenes son CONSISTENTES')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verificar_consistencia_estados_ordenes()