#!/usr/bin/env python3
"""
Mostrar resumen compacto de órdenes de compra del departamento Proyectos
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder

def mostrar_resumen_ordenes_proyectos():
    print('=== ORDENES DE COMPRA - DEPARTAMENTO PROYECTOS (RESUMEN) ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener órdenes del departamento Proyectos (ID 4)
        stmt = (
            select(PoOrder)
            .where(PoOrder.departamento_id == 4)
            .order_by(PoOrder.id)
        )
        ordenes = session.exec(stmt).all()
        
        if not ordenes:
            print('No se encontraron órdenes para el departamento Proyectos')
            return
        
        print(f'Total órdenes encontradas: {len(ordenes)}')
        print()
        
        # Mostrar primeras 10 órdenes
        print('PRIMERAS 10 ORDENES:')
        print('ID   | Título                           | Proveedor      | Tipo          | Estado      | Fecha')
        print('-' * 95)
        
        for orden in ordenes[:10]:
            proveedor_nombre = orden.proveedor.nombre[:12] if orden.proveedor else 'SIN PROV'
            tipo_solicitud_nombre = orden.tipo_solicitud.nombre[:11] if orden.tipo_solicitud else 'SIN TIPO'
            estado_nombre = orden.order_status.nombre[:10] if orden.order_status else 'SIN ESTADO'
            fecha_estado = orden.updated_at.strftime('%d/%m/%Y') if orden.updated_at else 'N/A'
            titulo_corto = orden.titulo[:30] + '...' if len(orden.titulo) > 30 else orden.titulo
            
            print(f'{orden.id:4d} | {titulo_corto:32s} | {proveedor_nombre:14s} | {tipo_solicitud_nombre:13s} | {estado_nombre:11s} | {fecha_estado}')
        
        if len(ordenes) > 20:
            print('...')
            print()
            print('ULTIMAS 10 ORDENES:')
            print('ID   | Título                           | Proveedor      | Tipo          | Estado      | Fecha')
            print('-' * 95)
            
            for orden in ordenes[-10:]:
                proveedor_nombre = orden.proveedor.nombre[:12] if orden.proveedor else 'SIN PROV'
                tipo_solicitud_nombre = orden.tipo_solicitud.nombre[:11] if orden.tipo_solicitud else 'SIN TIPO'
                estado_nombre = orden.order_status.nombre[:10] if orden.order_status else 'SIN ESTADO'
                fecha_estado = orden.updated_at.strftime('%d/%m/%Y') if orden.updated_at else 'N/A'
                titulo_corto = orden.titulo[:30] + '...' if len(orden.titulo) > 30 else orden.titulo
                
                print(f'{orden.id:4d} | {titulo_corto:32s} | {proveedor_nombre:14s} | {tipo_solicitud_nombre:13s} | {estado_nombre:11s} | {fecha_estado}')
        
        print()
        print('=== ESTADISTICAS ===')
        
        # Agrupar por proveedor
        proveedores_count = {}
        for orden in ordenes:
            prov_nombre = orden.proveedor.nombre if orden.proveedor else 'SIN PROVEEDOR'
            proveedores_count[prov_nombre] = proveedores_count.get(prov_nombre, 0) + 1
        
        print('Por proveedor:')
        for prov, count in sorted(proveedores_count.items(), key=lambda x: x[1], reverse=True):
            porcentaje = (count / len(ordenes)) * 100
            print(f'  {prov:15s}: {count:2d} órdenes ({porcentaje:4.1f}%)')
        
        # Agrupar por tipo de solicitud
        tipos_count = {}
        for orden in ordenes:
            tipo_nombre = orden.tipo_solicitud.nombre if orden.tipo_solicitud else 'SIN TIPO'
            tipos_count[tipo_nombre] = tipos_count.get(tipo_nombre, 0) + 1
        
        print()
        print('Por tipo de solicitud:')
        for tipo, count in sorted(tipos_count.items(), key=lambda x: x[1], reverse=True):
            porcentaje = (count / len(ordenes)) * 100
            print(f'  {tipo:15s}: {count:2d} órdenes ({porcentaje:4.1f}%)')
        
        # Agrupar por estado
        estados_count = {}
        for orden in ordenes:
            estado_nombre = orden.order_status.nombre if orden.order_status else 'SIN ESTADO'
            estados_count[estado_nombre] = estados_count.get(estado_nombre, 0) + 1
        
        print()
        print('Por estado:')
        for estado, count in sorted(estados_count.items(), key=lambda x: x[1], reverse=True):
            porcentaje = (count / len(ordenes)) * 100
            print(f'  {estado:15s}: {count:2d} órdenes ({porcentaje:4.1f}%)')
        
        # Total en dinero
        total_monto = sum(orden.total for orden in ordenes)
        print(f'\nTotal monto: ${total_monto:,.2f}')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    mostrar_resumen_ordenes_proyectos()