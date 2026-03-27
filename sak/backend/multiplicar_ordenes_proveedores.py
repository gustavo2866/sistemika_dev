#!/usr/bin/env python3
"""
Script para multiplicar por 15 los montos de órdenes de compra 
de proveedores específicos: TecSys, Limpi Total, Eléctricos SA
"""

import sys
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proveedor import Proveedor
from app.models.compras import PoOrder, PoOrderDetail

def multiplicar_ordenes_proveedores():
    print('=== MULTIPLICACION x15 MONTOS ORDENES PROVEEDORES ===')
    print('Proveedores objetivo: TecSys, Limpi Total, Eléctricos SA')
    print()
    
    try:
        session = next(get_session())
        
        # IDs de proveedores identificados
        proveedor_ids = [5, 4, 2]  # TecSys, Limpi Total, Eléctricos SA
        factor_multiplicacion = 15
        
        # Obtener proveedores para mostrar nombres
        proveedores = {}
        for pid in proveedor_ids:
            prov = session.get(Proveedor, pid)
            if prov:
                proveedores[pid] = prov.nombre
        
        print("Proveedores a procesar:")
        for pid, nombre in proveedores.items():
            print(f"  ID {pid}: {nombre}")
        print()
        
        # Obtener todas las órdenes de estos proveedores
        ordenes = session.exec(
            select(PoOrder)
            .where(PoOrder.proveedor_id.in_(proveedor_ids))
            .order_by(PoOrder.id)
        ).all()
        
        print(f"Total órdenes encontradas: {len(ordenes)}")
        print(f"Factor de multiplicación: {factor_multiplicacion}x")
        print()
        
        print("ID   | Proveedor      | Total Anterior | Total Nuevo    | Incremento")
        print("-" * 70)
        
        ordenes_procesadas = 0
        total_incremento = Decimal('0')
        
        for orden in ordenes:
            # Obtener nombre del proveedor
            nombre_prov = proveedores.get(orden.proveedor_id, 'Desconocido')
            
            # Valores anteriores
            total_anterior = orden.total
            
            # Calcular nuevos valores
            nuevo_total = total_anterior * factor_multiplicacion
            incremento = nuevo_total - total_anterior
            
            # Actualizar orden
            orden.total = nuevo_total
            
            # Actualizar detalles de la orden (si existen)
            detalles = session.exec(
                select(PoOrderDetail)
                .where(PoOrderDetail.order_id == orden.id)
            ).all()
            
            for detalle in detalles:
                # Multiplicar el precio unitario por el factor
                detalle.precio = detalle.precio * factor_multiplicacion
            
            # Mostrar cambio
            print(f"{orden.id:4d} | {nombre_prov:14s} | ${float(total_anterior):11,.2f} | ${float(nuevo_total):11,.2f} | ${float(incremento):10,.2f}")
            
            ordenes_procesadas += 1
            total_incremento += incremento
            
            # Commit cada 20 órdenes para evitar transacciones muy grandes
            if ordenes_procesadas % 20 == 0:
                session.commit()
        
        # Commit final
        session.commit()
        
        print("-" * 70)
        print(f"✅ {ordenes_procesadas} órdenes actualizadas exitosamente")
        print(f"💰 Incremento total: ${float(total_incremento):,.2f}")
        
        # Resumen por proveedor
        print("\\n=== RESUMEN POR PROVEEDOR ===")
        for pid, nombre in proveedores.items():
            ordenes_prov = [o for o in ordenes if o.proveedor_id == pid]
            if ordenes_prov:
                total_prov = sum(float(o.total) for o in ordenes_prov)
                count_prov = len(ordenes_prov)
                print(f"{nombre}: {count_prov} órdenes | Total: ${total_prov:,.2f}")
        
        print(f"\\n🔥 Factor aplicado: {factor_multiplicacion}x")
        print(f"📊 Todas las órdenes y detalles han sido actualizados")
        
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
    multiplicar_ordenes_proveedores()