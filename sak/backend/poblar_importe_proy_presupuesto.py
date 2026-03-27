#!/usr/bin/env python3

import random
from decimal import Decimal
from sqlmodel import select
from app.db import get_session
from app.models.proy_presupuesto import ProyPresupuesto

def poblar_importe_proy_presupuesto():
    """Pobla el campo importe con suma de costos + porcentaje aleatorio 15-20%"""
    
    with next(get_session()) as db:
        print("=== POBLANDO CAMPO IMPORTE EN PROY_PRESUPUESTO ===\n")
        
        # Obtener todos los registros existentes
        presupuestos = db.exec(select(ProyPresupuesto)).all()
        
        if not presupuestos:
            print("❌ No se encontraron registros en proy_presupuesto")
            return
        
        print(f"📋 Procesando {len(presupuestos)} registros...")
        
        registros_actualizados = 0
        
        for presupuesto in presupuestos:
            # Calcular suma de costos base
            suma_costos = (
                presupuesto.mo_propia + 
                presupuesto.mo_terceros + 
                presupuesto.materiales
            )
            
            # Si suma_costos es 0, saltear este registro
            if suma_costos == 0:
                print(f"⚠️  Registro ID {presupuesto.id} - suma de costos es 0, saltando...")
                continue
            
            # Generar porcentaje aleatorio entre 15% y 20% adicional
            factor_adicional = Decimal(str(random.uniform(1.15, 1.20)))
            
            # Calcular nuevo importe
            nuevo_importe = suma_costos * factor_adicional
            
            # Actualizar el registro
            presupuesto.importe = nuevo_importe
            
            print(f"✅ ID {presupuesto.id} - Proyecto {presupuesto.proyecto_id} - "
                  f"Costos: ${suma_costos:,.2f} -> Importe: ${nuevo_importe:,.2f} "
                  f"(+{((factor_adicional - 1) * 100):.1f}%)")
            
            registros_actualizados += 1
        
        # Guardar cambios
        db.commit()
        
        print(f"\n🎉 ACTUALIZACIÓN COMPLETADA")
        print(f"📊 {registros_actualizados} registros actualizados exitosamente")
        
        # Mostrar resumen estadístico
        print(f"\n=== RESUMEN ESTADÍSTICO ===")
        presupuestos_actualizados = db.exec(
            select(ProyPresupuesto).where(ProyPresupuesto.importe > 0)
        ).all()
        
        if presupuestos_actualizados:
            importes = [float(p.importe) for p in presupuestos_actualizados]
            suma_total = sum(importes)
            promedio = suma_total / len(importes)
            
            print(f"💰 Suma total de importes: ${suma_total:,.2f}")
            print(f"📊 Promedio de importes: ${promedio:,.2f}")
            print(f"🔝 Importe máximo: ${max(importes):,.2f}")
            print(f"🔻 Importe mínimo: ${min(importes):,.2f}")

if __name__ == "__main__":
    poblar_importe_proy_presupuesto()