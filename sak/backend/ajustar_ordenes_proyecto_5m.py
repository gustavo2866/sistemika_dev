#!/usr/bin/env python3
"""
Script para identificar y ajustar órdenes de TecSys, Eléctricos SA y ConSur
del departamento Proyecto para que superen los 5 millones cada una
"""

import sys
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proveedor import Proveedor
from app.models.compras import PoOrder, PoOrderDetail
from app.models.departamento import Departamento

def ajustar_ordenes_departamento_proyecto():
    print('=== AJUSTE ORDENES DEPARTAMENTO PROYECTO - MIN 5M ===')
    print('Proveedores: TecSys, Eléctricos SA, ConSur')
    print()
    
    try:
        session = next(get_session())
        
        # Configuración
        proveedor_ids = [5, 2, 3]  # TecSys, Eléctricos SA, ConSur
        departamento_proyecto_id = 4  # Proyectos
        limite_minimo = Decimal('5000000')  # 5 millones
        
        # Obtener nombres de proveedores
        proveedores = {}
        for pid in proveedor_ids:
            prov = session.get(Proveedor, pid)
            if prov:
                proveedores[pid] = prov.nombre
        
        print("Proveedores objetivo:")
        for pid, nombre in proveedores.items():
            print(f"  ID {pid}: {nombre}")
        
        # Verificar departamento
        depto = session.get(Departamento, departamento_proyecto_id)
        print(f"\\nDepartamento: {depto.nombre if depto else 'No encontrado'} (ID: {departamento_proyecto_id})")
        print(f"Límite mínimo: ${limite_minimo:,}")
        print()
        
        # Obtener órdenes del departamento Proyecto de estos proveedores
        ordenes = session.exec(
            select(PoOrder)
            .where(PoOrder.proveedor_id.in_(proveedor_ids))
            .where(PoOrder.departamento_id == departamento_proyecto_id)
            .order_by(PoOrder.proveedor_id, PoOrder.id)
        ).all()
        
        print(f"Total órdenes encontradas: {len(ordenes)}")
        print()
        print("ID   | Proveedor      | Total Anterior | Total Nuevo    | Ajuste      | Estado")
        print("-" * 80)
        
        ordenes_ajustadas = 0
        total_incremento = Decimal('0')
        
        for orden in ordenes:
            proveedor_nombre = proveedores.get(orden.proveedor_id, 'Desconocido')
            total_anterior = orden.total
            
            if total_anterior < limite_minimo:
                # Calcular nuevo total con margen adicional (5.1M - 5.5M)
                import random
                margen_adicional = Decimal(str(random.uniform(100000, 500000)))  # 100K-500K adicional
                nuevo_total = limite_minimo + margen_adicional
                ajuste = nuevo_total - total_anterior
                
                # Actualizar orden
                orden.total = nuevo_total
                
                # Actualizar detalles proporcionalmente
                detalles = session.exec(
                    select(PoOrderDetail)
                    .where(PoOrderDetail.order_id == orden.id)
                ).all()
                
                if detalles and total_anterior > 0:
                    factor_ajuste = nuevo_total / total_anterior
                    for detalle in detalles:
                        detalle.precio = detalle.precio * factor_ajuste
                
                estado = "AJUSTADO"
                ordenes_ajustadas += 1
                total_incremento += ajuste
            else:
                nuevo_total = total_anterior
                ajuste = Decimal('0')
                estado = "YA CUMPLE"
            
            print(f"{orden.id:4d} | {proveedor_nombre:14s} | ${float(total_anterior):11,.2f} | ${float(nuevo_total):11,.2f} | ${float(ajuste):9,.2f} | {estado}")
        
        if ordenes_ajustadas > 0:
            session.commit()
            print("-" * 80)
            print(f"✅ {ordenes_ajustadas} órdenes ajustadas exitosamente")
            print(f"💰 Incremento total: ${float(total_incremento):,.2f}")
            
            # Resumen por proveedor después del ajuste
            print("\\n=== RESUMEN POST-AJUSTE POR PROVEEDOR ===")
            for pid, nombre in proveedores.items():
                ordenes_prov = [o for o in ordenes if o.proveedor_id == pid]
                if ordenes_prov:
                    total_prov = sum(float(o.total) for o in ordenes_prov)
                    count_prov = len(ordenes_prov)
                    promedio_prov = total_prov / count_prov if count_prov > 0 else 0
                    min_prov = min(float(o.total) for o in ordenes_prov)
                    
                    print(f"{nombre}: {count_prov} órdenes | Total: ${total_prov:,.2f} | Min: ${min_prov:,.2f} | Prom: ${promedio_prov:,.2f}")
        else:
            print("\\n✅ Todas las órdenes ya cumplen con el mínimo de $5M")
        
        print(f"\\n🎯 Objetivo cumplido: Todas las órdenes superan ${limite_minimo:,}")
        
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
    ajustar_ordenes_departamento_proyecto()