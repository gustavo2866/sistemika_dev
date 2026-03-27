#!/usr/bin/env python3
"""
Script para verificar que el campo importe se agregó correctamente a ProyectoAvance
"""
import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from sqlalchemy import text
from app.db import get_session
from app.models.proyecto_avance import ProyectoAvance

def verificar_campo_importe():
    print('=== VERIFICACION CAMPO IMPORTE EN PROYECTO_AVANCE ===')
    print()
    
    try:
        session = next(get_session())
        
        # 1. Verificar campos del modelo
        print('✅ CAMPOS DEL MODELO:')
        fields = ProyectoAvance.model_fields
        for field_name in fields.keys():
            print(f'  - {field_name}')
        
        print()
        
        # 2. Verificar estructura de la tabla
        print('✅ ESTRUCTURA DE LA TABLA:')
        result = session.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'proyecto_avance' ORDER BY ordinal_position"))
        columns = result.fetchall()
        
        for col_name, col_type in columns:
            print(f'  - {col_name}: {col_type}')
        
        print()
        
        # 3. Crear registro de prueba
        print('✅ CREANDO REGISTRO DE PRUEBA:')
        
        nuevo_avance = ProyectoAvance(
            proyecto_id=14,
            horas=120,
            avance=Decimal('35.75'),
            importe=Decimal('18500.00'),
            comentario='Verificación campo importe agregado correctamente',
            fecha_registracion=date.today()
        )
        
        session.add(nuevo_avance)
        session.commit()
        
        print(f'  ID: {nuevo_avance.id}')
        print(f'  Proyecto: {nuevo_avance.proyecto_id}')
        print(f'  Horas: {nuevo_avance.horas}')
        print(f'  Avance: {nuevo_avance.avance}%')
        print(f'  Importe: ${float(nuevo_avance.importe):,.2f}')
        print(f'  Fecha: {nuevo_avance.fecha_registracion}')
        print(f'  Comentario: {nuevo_avance.comentario}')
        
        print()
        
        # 4. Verificar registros existentes
        print('✅ REGISTROS EXISTENTES (últimos 3):')
        avances_existentes = session.exec(
            select(ProyectoAvance)
            .order_by(ProyectoAvance.id.desc())
            .limit(3)
        ).all()
        
        print('ID | Proy | Horas | Avance% | Importe    | Fecha')
        print('-' * 50)
        for avance in avances_existentes:
            print(f'{avance.id:2d} | {avance.proyecto_id:4d} | {avance.horas:5d} | {avance.avance:6.2f} | ${float(avance.importe):8,.2f} | {avance.fecha_registracion}')
        
        print()
        print('🎉 CAMPO IMPORTE AGREGADO Y FUNCIONANDO CORRECTAMENTE')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
    finally:
        if 'session' in locals():
            session.close()

if __name__ == '__main__':
    verificar_campo_importe()