#!/usr/bin/env python3
"""
Verificar departamentos disponibles y corregir las OC de proyectos
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder
from app.models.departamento import Departamento

def corregir_departamento_ordenes():
    print('=== VERIFICACION Y CORRECCION DE DEPARTAMENTOS EN OC ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener departamentos disponibles
        stmt_dept = select(Departamento)
        departamentos = session.exec(stmt_dept).all()
        
        print('Departamentos disponibles:')
        dept_mapping = {}
        proyectos_dept_id = None
        
        for dept in departamentos:
            print(f'  ID {dept.id}: "{dept.nombre}"')
            dept_mapping[dept.nombre.lower()] = dept.id
            if 'proyecto' in dept.nombre.lower():
                proyectos_dept_id = dept.id
        
        print()
        
        if proyectos_dept_id:
            print(f'✅ Departamento "proyectos" encontrado con ID: {proyectos_dept_id}')
        else:
            print('⚠️  No se encontró departamento "proyectos"')
            # Buscar alternativas
            if 'proyectos' in dept_mapping:
                proyectos_dept_id = dept_mapping['proyectos']
            elif 'proyecto' in dept_mapping:
                proyectos_dept_id = dept_mapping['proyecto']
            else:
                print('❌ No hay departamento relacionado con proyectos')
                return
        
        # Obtener órdenes de proyectos (las que tienen oportunidad_id)
        stmt_ordenes = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
        ordenes_proyecto = session.exec(stmt_ordenes).all()
        
        print(f'Órdenes de proyectos encontradas: {len(ordenes_proyecto)}')
        
        # Analizar departamentos actuales
        departamentos_actuales = {}
        ordenes_sin_dept = 0
        ordenes_con_dept_incorrecto = []
        
        for orden in ordenes_proyecto:
            if orden.departamento_id is None:
                ordenes_sin_dept += 1
            elif orden.departamento_id != proyectos_dept_id:
                ordenes_con_dept_incorrecto.append(orden)
                if orden.departamento_id in departamentos_actuales:
                    departamentos_actuales[orden.departamento_id] += 1
                else:
                    departamentos_actuales[orden.departamento_id] = 1
        
        print()
        print('Estado actual de departamentos en OC de proyectos:')
        print(f'  Sin departamento: {ordenes_sin_dept} órdenes')
        
        for dept_id, cantidad in departamentos_actuales.items():
            dept_name = next((d.nombre for d in departamentos if d.id == dept_id), f'ID {dept_id}')
            print(f'  Departamento "{dept_name}": {cantidad} órdenes')
        
        # Contar órdenes que ya están correctas
        ordenes_correctas = len(ordenes_proyecto) - ordenes_sin_dept - len(ordenes_con_dept_incorrecto)
        if ordenes_correctas > 0:
            print(f'  ✅ Ya correctas (departamento proyectos): {ordenes_correctas} órdenes')
        
        # Corregir órdenes
        ordenes_a_corregir = ordenes_sin_dept + len(ordenes_con_dept_incorrecto)
        
        if ordenes_a_corregir > 0:
            print(f'\nCorrigiendo {ordenes_a_corregir} órdenes...')
            
            correcciones = 0
            for orden in ordenes_proyecto:
                if orden.departamento_id is None or orden.departamento_id != proyectos_dept_id:
                    dept_anterior = orden.departamento_id
                    orden.departamento_id = proyectos_dept_id
                    session.add(orden)
                    correcciones += 1
                    
                    if correcciones <= 10:  # Mostrar solo las primeras 10 para no saturar
                        if dept_anterior is None:
                            print(f'  OC {orden.id}: SIN DEPTO → Proyectos')
                        else:
                            dept_ant_name = next((d.nombre for d in departamentos if d.id == dept_anterior), f'ID {dept_anterior}')
                            print(f'  OC {orden.id}: {dept_ant_name} → Proyectos')
            
            if correcciones > 10:
                print(f'  ... y {correcciones - 10} órdenes más')
            
            # Confirmar cambios
            session.commit()
            print(f'\n✅ {correcciones} órdenes corregidas exitosamente')
            
            # Verificación final
            stmt_final = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
            ordenes_final = session.exec(stmt_final).all()
            
            ordenes_proyectos = sum(1 for o in ordenes_final if o.departamento_id == proyectos_dept_id)
            print(f'✅ Verificación final: {ordenes_proyectos}/{len(ordenes_final)} órdenes tienen departamento "proyectos"')
            
        else:
            print('\n✅ Todas las órdenes ya tienen el departamento correcto')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    corregir_departamento_ordenes()