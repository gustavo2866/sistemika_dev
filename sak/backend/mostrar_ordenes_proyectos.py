#!/usr/bin/env python3
"""
Mostrar órdenes de compra del departamento Proyectos en formato tabular
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder
from tabulate import tabulate

def mostrar_ordenes_proyectos():
    print('=== ORDENES DE COMPRA - DEPARTAMENTO PROYECTOS ===')
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
        
        # Preparar datos para la tabla
        tabla_datos = []
        
        for orden in ordenes:
            # Obtener nombres relacionados
            proveedor_nombre = orden.proveedor.nombre if orden.proveedor else 'SIN PROVEEDOR'
            departamento_nombre = orden.departamento.nombre if orden.departamento else 'SIN DEPARTAMENTO'
            tipo_solicitud_nombre = orden.tipo_solicitud.nombre if orden.tipo_solicitud else 'SIN TIPO'
            estado_nombre = orden.order_status.nombre if orden.order_status else 'SIN ESTADO'
            
            # Formato de fecha (solo fecha, sin hora)
            fecha_estado = None
            if hasattr(orden, 'updated_at') and orden.updated_at:
                fecha_estado = orden.updated_at.strftime('%d/%m/%Y')
            elif hasattr(orden, 'created_at') and orden.created_at:
                fecha_estado = orden.created_at.strftime('%d/%m/%Y')
            
            # Truncar título si es muy largo
            titulo_corto = orden.titulo[:40] + '...' if len(orden.titulo) > 40 else orden.titulo
            
            tabla_datos.append([
                orden.id,
                titulo_corto,
                proveedor_nombre,
                departamento_nombre,
                tipo_solicitud_nombre,
                estado_nombre,
                fecha_estado or 'N/A'
            ])
        
        # Definir headers
        headers = [
            'ID',
            'Título',
            'Proveedor', 
            'Departamento',
            'Tipo Solicitud',
            'Estado',
            'Fecha Estado'
        ]
        
        # Mostrar tabla
        print(f'Total órdenes encontradas: {len(ordenes)}')
        print()
        print(tabulate(tabla_datos, headers=headers, tablefmt='grid'))
        
        # Estadísticas adicionales
        print()
        print('=== ESTADISTICAS ===')
        
        # Agrupar por proveedor
        proveedores_count = {}
        for orden in ordenes:
            prov_nombre = orden.proveedor.nombre if orden.proveedor else 'SIN PROVEEDOR'
            proveedores_count[prov_nombre] = proveedores_count.get(prov_nombre, 0) + 1
        
        print('Por proveedor:')
        for prov, count in sorted(proveedores_count.items(), key=lambda x: x[1], reverse=True):
            print(f'  {prov}: {count} órdenes')
        
        # Agrupar por estado
        estados_count = {}
        for orden in ordenes:
            estado_nombre = orden.order_status.nombre if orden.order_status else 'SIN ESTADO'
            estados_count[estado_nombre] = estados_count.get(estado_nombre, 0) + 1
        
        print('\nPor estado:')
        for estado, count in sorted(estados_count.items(), key=lambda x: x[1], reverse=True):
            print(f'  {estado}: {count} órdenes')
        
        # Total en dinero
        total_monto = sum(orden.total for orden in ordenes)
        print(f'\nTotal monto: ${total_monto:,.2f}')
        
    except ImportError:
        print('❌ ERROR: Se requiere instalar tabulate')
        print('Ejecutar: pip install tabulate')
        
        # Mostrar versión simple sin tabulate
        print('\nMostrando versión simple:')
        for orden in ordenes:
            proveedor_nombre = orden.proveedor.nombre if orden.proveedor else 'SIN PROVEEDOR'
            departamento_nombre = orden.departamento.nombre if orden.departamento else 'SIN DEPARTAMENTO'
            tipo_solicitud_nombre = orden.tipo_solicitud.nombre if orden.tipo_solicitud else 'SIN TIPO'
            estado_nombre = orden.order_status.nombre if orden.order_status else 'SIN ESTADO'
            fecha_estado = orden.updated_at.strftime('%d/%m/%Y') if orden.updated_at else 'N/A'
            
            print(f'ID: {orden.id:3d} | {orden.titulo[:30]:30s} | {proveedor_nombre[:15]:15s} | {departamento_nombre[:12]:12s} | {tipo_solicitud_nombre[:10]:10s} | {estado_nombre[:10]:10s} | {fecha_estado}')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    mostrar_ordenes_proyectos()