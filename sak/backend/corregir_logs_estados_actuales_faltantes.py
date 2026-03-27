#!/usr/bin/env python3
"""
Corregir órdenes que tienen un estado actual pero no tienen log de ese estado.
Agregar logs de estados actuales faltantes.
"""

import sys
sys.path.insert(0, '.')
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderStatus, PoOrderStatusLog

def corregir_logs_estados_actuales_faltantes():
    print('=== CORRECCIÓN DE LOGS DE ESTADOS ACTUALES FALTANTES ===')
    print()
    
    try:
        session = next(get_session())
        
        # IDs de órdenes que tienen estado actual sin log (identificadas en verificación)
        ordenes_sin_log_estado_actual = [
            56, 57, 63, 66, 67, 72, 74, 79, 80, 82, 83, 89, 93, 95
        ]
        
        print(f'Órdenes a corregir (logs de estado actual faltantes): {len(ordenes_sin_log_estado_actual)}')
        print()
        
        correcciones_realizadas = []
        
        for orden_id in ordenes_sin_log_estado_actual:
            print(f'Procesando orden ID {orden_id}...')
            
            # Obtener la orden
            orden = session.exec(
                select(PoOrder).where(PoOrder.id == orden_id)
            ).first()
            
            if not orden:
                print(f'  ❌ ERROR: Orden ID {orden_id} no encontrada')
                continue
            
            # Obtener el estado actual
            estado_actual = orden.order_status
            print(f'  Estado actual: {estado_actual.nombre}')
            
            # Verificar si ya existe un log para el estado actual
            log_estado_actual_existente = session.exec(
                select(PoOrderStatusLog)
                .where(PoOrderStatusLog.order_id == orden_id)
                .where(PoOrderStatusLog.status_nuevo_id == estado_actual.id)
            ).first()
            
            if log_estado_actual_existente:
                print(f'  ⚠️  OMITIDO: Ya existe log para estado actual')
                continue
            
            # Obtener el log más reciente (probablemente "emitida")
            log_mas_reciente = session.exec(
                select(PoOrderStatusLog)
                .where(PoOrderStatusLog.order_id == orden_id)
                .order_by(PoOrderStatusLog.fecha_registro.desc())
            ).first()
            
            # Determinar fecha para el log del estado actual
            if log_mas_reciente:
                # Si existe algún log, poner el estado actual 1 día después del último log
                fecha_estado_actual = log_mas_reciente.fecha_registro + timedelta(days=1)
            else:
                # Si no hay logs, usar la fecha de creación de la orden
                fecha_estado_actual = orden.created_at.date()
            
            fecha_estado_actual_dt = datetime.combine(fecha_estado_actual, datetime.min.time())
            
            print(f'  Agregando log de estado "{estado_actual.nombre}" con fecha: {fecha_estado_actual}')
            
            # Crear el registro de log del estado actual
            nuevo_log_estado_actual = PoOrderStatusLog(
                order_id=orden_id,
                status_anterior_id=log_mas_reciente.status_nuevo_id if log_mas_reciente else None,
                status_nuevo_id=estado_actual.id,
                usuario_id=1,  # Usuario Demo1 como fallback
                comentario=f"Estado {estado_actual.nombre} agregado por corrección automática",
                fecha_registro=fecha_estado_actual,
                created_at=fecha_estado_actual_dt,
                updated_at=fecha_estado_actual_dt
            )
            
            session.add(nuevo_log_estado_actual)
            
            correcciones_realizadas.append({
                'orden_id': orden_id,
                'titulo': orden.titulo,
                'estado_actual': estado_actual.nombre,
                'fecha_estado_agregada': fecha_estado_actual
            })
            
            print(f'  ✅ Log de estado "{estado_actual.nombre}" agregado correctamente')
        
        # Confirmar todos los cambios
        session.commit()
        
        print(f'\n✅ CORRECCIÓN COMPLETADA')
        print(f'Total logs de estados actuales agregados: {len(correcciones_realizadas)}')
        
        # Mostrar resumen de correcciones
        print('\n=== RESUMEN DE CORRECCIONES ===')
        print('ID   | Título                           | Estado Actual | Fecha Estado Agregada')
        print('-' * 90)
        
        for correccion in correcciones_realizadas:
            titulo_corto = correccion['titulo'][:30] + '...' if len(correccion['titulo']) > 30 else correccion['titulo']
            estado_corto = correccion['estado_actual'][:12]
            
            print(f"{correccion['orden_id']:4d} | {titulo_corto:32s} | {estado_corto:13s} | {correccion['fecha_estado_agregada']}")
        
        print(f'\nTodos los logs de estados actuales han sido agregados a la base de datos.')
        print('Se recomienda ejecutar nuevamente la verificación para confirmar consistencia completa.')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        session.rollback()
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    corregir_logs_estados_actuales_faltantes()