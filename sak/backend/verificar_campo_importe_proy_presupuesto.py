#!/usr/bin/env python3

from sqlmodel import select, text
from app.db import get_session
from app.models.proy_presupuesto import ProyPresupuesto
from decimal import Decimal
from datetime import date

def verificar_campo_importe_proy_presupuesto():
    """Verifica que el campo importe se agregó correctamente a proy_presupuesto"""
    
    with next(get_session()) as db:
        print("=== VERIFICACIÓN CAMPO IMPORTE EN PROY_PRESUPUESTO ===\n")
        
        # Verificar que el modelo tiene el campo
        print("✅ CAMPOS DEL MODELO:")
        fields = ProyPresupuesto.model_fields
        for field_name, field_info in fields.items():
            print(f"  - {field_name}")
        
        if 'importe' in fields:
            print("\n✅ Campo 'importe' encontrado en el modelo")
        else:
            print("\n❌ Campo 'importe' NO encontrado en el modelo")
            return
        
        # Verificar schema en base de datos
        print("\n✅ ESQUEMA DE BASE DE DATOS:")
        result = db.execute(text("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'proy_presupuestos' ORDER BY column_name"))
        columns = result.fetchall()
        
        print("Columnas en tabla proy_presupuestos:")
        for col_name, col_type, is_nullable, col_default in columns:
            print(f"  - {col_name}: {col_type} (null: {is_nullable}, default: {col_default})")
        
        # Verificar que existe la columna importe
        importe_column = [col for col in columns if col[0] == 'importe']
        if importe_column:
            print(f"\n✅ Columna 'importe' encontrada en base de datos")
        else:
            print(f"\n❌ Columna 'importe' NO encontrada en base de datos")
            return
        
        # Crear registro de prueba
        print("\n✅ REGISTRO DE PRUEBA")
        
        # Eliminar registros de prueba anteriores
        db.execute(text("DELETE FROM proy_presupuestos WHERE mo_propia = 99999.99"))
        db.commit()
        
        nuevo_presupuesto = ProyPresupuesto(
            proyecto_id=14,
            fecha=date.today(),
            mo_propia=Decimal('99999.99'),
            mo_terceros=Decimal('5000.00'),
            materiales=Decimal('10000.00'),
            horas=Decimal('100.0'),
            metros=Decimal('50.0'),
            importe=Decimal('125000.00')
        )
        
        db.add(nuevo_presupuesto)
        db.commit()
        
        print(f"Registro creado - ID: {nuevo_presupuesto.id}")
        print(f"Proyecto: {nuevo_presupuesto.proyecto_id}")
        print(f"Fecha: {nuevo_presupuesto.fecha}")
        print(f"MO Propia: ${nuevo_presupuesto.mo_propia:,.2f}")
        print(f"MO Terceros: ${nuevo_presupuesto.mo_terceros:,.2f}")
        print(f"Materiales: ${nuevo_presupuesto.materiales:,.2f}")
        print(f"Horas: {nuevo_presupuesto.horas}")
        print(f"Metros: {nuevo_presupuesto.metros}")
        print(f"Importe: ${nuevo_presupuesto.importe:,.2f}")
        
        print("\n🎉 VERIFICACIÓN EXITOSA: Campo importe agregado correctamente a proy_presupuesto")

if __name__ == "__main__":
    verificar_campo_importe_proy_presupuesto()