#!/usr/bin/env python3
"""
Script para generar órdenes de compra (OC) para proyectos 14-17
Período: dic-2025 a mar-2026, tipo solicitud "MO-Propios"
Una OC por proyecto por mes con estados "emitida" y "aprobada"
"""

import sys
import random
from datetime import date
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder, PoOrderDetail, PoOrderStatus, PoOrderStatusLog
from app.models.user import User

def generar_ordenes_compra_proyectos():
    print('=== GENERACIÓN DE ÓRDENES DE COMPRA PROYECTOS 14-17 ===')
    print()
    
    try:
        session = next(get_session())
        
        # Configuración
        proyecto_ids = [14, 15, 16, 17]
        tipo_solicitud_id = 7  # MO-Propios
        departamento_id = 4    # Proyectos
        articulo_id = 332      # Artículo por defecto
        proveedor_id = 6       # Varios
        
        # Estados
        estado_emitida_id = 3    # emitida
        estado_aprobada_id = 4   # aprobada
        
        # Fechas por mes (último día)
        fechas = [
            ("2025-12", date(2025, 12, 31)),  # Diciembre 2025
            ("2026-01", date(2026, 1, 31)),   # Enero 2026
            ("2026-02", date(2026, 2, 28)),   # Febrero 2026
            ("2026-03", date(2026, 3, 31)),   # Marzo 2026
        ]
        
        # Obtener un usuario válido para los registros
        usuario = session.exec(select(User).limit(1)).first()
        if not usuario:
            print('❌ No se encontró un usuario válido')
            return
        
        print(f'Usuario para registros: {usuario.nombre} (ID: {usuario.id})')
        
        # Verificar proyectos existentes
        proyectos_existentes = []
        for pid in proyecto_ids:
            proyecto = session.get(Proyecto, pid)
            if proyecto:
                proyectos_existentes.append((pid, proyecto.nombre))
                print(f'✓ Proyecto {pid}: {proyecto.nombre}')
            else:
                print(f'⚠️  Proyecto {pid} no encontrado')
        
        if not proyectos_existentes:
            print('❌ No se encontraron proyectos válidos')
            return
        
        total_ordenes = len(proyectos_existentes) * len(fechas)
        print(f'\\nGenerando {total_ordenes} órdenes de compra ({len(proyectos_existentes)} proyectos x {len(fechas)} meses)')
        print()
        
        ordenes_creadas = 0
        
        for proyecto_id, proyecto_nombre in proyectos_existentes:
            for periodo, fecha in fechas:
                # Crear título descriptivo
                titulo = f"MO-Propios Proyecto {proyecto_id} - {periodo}"
                
                # Generar valores basados en presupuestos (rangos similares pero ajustados)
                # MO Propia de los presupuestos: 15M-60M, ajustamos para la OC
                total_orden = random.uniform(10000000, 40000000)  # 10M-40M para MO
                
                # Crear la orden
                orden = PoOrder(
                    titulo=titulo,
                    tipo_solicitud_id=tipo_solicitud_id,
                    departamento_id=departamento_id,
                    order_status_id=estado_aprobada_id,  # Estado final
                    total=Decimal(f"{total_orden:.2f}"),
                    fecha_necesidad=fecha,
                    comentario=f"Orden generada automáticamente para {proyecto_nombre} - {periodo}",
                    solicitante_id=usuario.id,
                    proveedor_id=proveedor_id
                )
                
                session.add(orden)
                session.flush()  # Para obtener el ID
                
                # Crear detalle de la orden
                detalle = PoOrderDetail(
                    order_id=orden.id,
                    articulo_id=articulo_id,
                    descripcion=f"Mano de obra propia para proyecto {proyecto_nombre}",
                    unidad_medida="horas",
                    cantidad=Decimal("1000.00"),  # 1000 horas como cantidad base
                    precio=Decimal(f"{total_orden/1000:.2f}")  # Precio por hora
                )
                
                session.add(detalle)
                
                # Crear logs de estado: primero "emitida", luego "aprobada"
                
                # Log 1: Estado inicial -> emitida
                log_emitida = PoOrderStatusLog(
                    order_id=orden.id,
                    status_anterior_id=None,  # Estado inicial
                    status_nuevo_id=estado_emitida_id,
                    usuario_id=usuario.id,
                    comentario="Orden emitida automáticamente",
                    fecha_registro=fecha
                )
                
                session.add(log_emitida)
                
                # Log 2: emitida -> aprobada
                log_aprobada = PoOrderStatusLog(
                    order_id=orden.id,
                    status_anterior_id=estado_emitida_id,
                    status_nuevo_id=estado_aprobada_id,
                    usuario_id=usuario.id,
                    comentario="Orden aprobada automáticamente",
                    fecha_registro=fecha
                )
                
                session.add(log_aprobada)
                
                ordenes_creadas += 1
                
                print(f'✓ Orden {ordenes_creadas}: P{proyecto_id} - {periodo} - Total: ${total_orden/1000000:.2f}M')
        
        if ordenes_creadas > 0:
            session.commit()
            print(f'\\n✅ {ordenes_creadas} órdenes de compra creadas exitosamente')
            print(f'   - Cada orden tiene 2 registros en log de estados (emitida -> aprobada)')
            print(f'   - Estado final: aprobada')
            print(f'   - Tipo solicitud: MO-Propios')
            print(f'   - Proveedor: Varios (ID=6)')
        else:
            print('\\n⚠️  No se crearon nuevas órdenes')
            
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
    generar_ordenes_compra_proyectos()