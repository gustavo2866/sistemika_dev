#!/usr/bin/env python3
"""
Corregir inconsistencias en logs de estado: agregar estado "emitida" faltante
para órdenes que tienen estados avanzados sin haber pasado por "emitida"
"""

import sys
sys.path.insert(0, '.')
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderStatus, PoOrderStatusLog

def corregir_estados_faltantes():
    print('=== CORRECCIÓN DE ESTADOS "EMITIDA" FALTANTES ===')
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
        
        # IDs de órdenes inconsistentes identificadas en la verificación anterior
        ordenes_inconsistentes_ids = [
            56, 57, 63, 66, 67, 72, 74, 79, 80, 82, 83, 89, 93, 95, 
            102, 106, 107, 109, 110, 112, 114
        ]
        
        print(f'Órdenes a corregir: {len(ordenes_inconsistentes_ids)}')
        print()
        
        correcciones_realizadas = []
        
        for orden_id in ordenes_inconsistentes_ids:
            print(f'Procesando orden ID {orden_id}...')
            
            # Obtener la orden
            orden = session.exec(
                select(PoOrder).where(PoOrder.id == orden_id)
            ).first()
            
            if not orden:
                print(f'  ❌ ERROR: Orden ID {orden_id} no encontrada')
                continue
            
            # Obtener el log más antiguo de esta orden para determinar fecha base
            log_mas_antiguo = session.exec(
                select(PoOrderStatusLog)
                .where(PoOrderStatusLog.order_id == orden_id)
                .order_by(PoOrderStatusLog.fecha_registro)
            ).first()
            
            # Determinar fecha para el estado "emitida"
            if log_mas_antiguo:
                # Si existe algún log, poner "emitida" 1 día antes del primer log
                fecha_emitida = log_mas_antiguo.fecha_registro - timedelta(days=1)
                fecha_emitida_dt = datetime.combine(fecha_emitida, datetime.min.time())
            else:
                # Si no hay logs, usar la fecha de creación de la orden menos 1 día
                fecha_emitida = orden.created_at.date() - timedelta(days=1)
                fecha_emitida_dt = datetime.combine(fecha_emitida, datetime.min.time())
            
            print(f'  Agregando estado "emitida" con fecha: {fecha_emitida}')
            
            # Crear el registro de log de estado "emitida"
            nuevo_log_emitida = PoOrderStatusLog(
                order_id=orden_id,
                status_nuevo_id=estado_emitida.id,
                usuario_id=1,  # Usuario Demo1 como fallback
                comentario="Estado emitida agregado por corrección automática",
                fecha_registro=fecha_emitida,
                created_at=fecha_emitida_dt,
                updated_at=fecha_emitida_dt
            )
            
            session.add(nuevo_log_emitida)
            
            correcciones_realizadas.append({
                'orden_id': orden_id,
                'titulo': orden.titulo,
                'estado_actual': orden.order_status.nombre,
                'fecha_emitida_agregada': fecha_emitida
            })
            
            print(f'  ✅ Log de estado "emitida" agregado correctamente')
        
        # Confirmar todos los cambios
        session.commit()
        
        print(f'\n✅ CORRECCIÓN COMPLETADA')
        print(f'Total órdenes corregidas: {len(correcciones_realizadas)}')
        
        # Mostrar resumen de correcciones
        print('\n=== RESUMEN DE CORRECCIONES ===')
        print('ID   | Título                           | Estado Actual | Fecha "Emitida" Agregada')
        print('-' * 95)
        
        for correccion in correcciones_realizadas:
            titulo_corto = correccion['titulo'][:30] + '...' if len(correccion['titulo']) > 30 else correccion['titulo']
            estado_corto = correccion['estado_actual'][:12]
            
            print(f"{correccion['orden_id']:4d} | {titulo_corto:32s} | {estado_corto:13s} | {correccion['fecha_emitida_agregada']}")
        
        print(f'\nTodas las correcciones han sido aplicadas a la base de datos.')
        print('Se recomienda ejecutar nuevamente la verificación para confirmar que todas las inconsistencias fueron resueltas.')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        session.rollback()
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    corregir_estados_faltantes()