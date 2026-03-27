#!/usr/bin/env python3
"""
Verificar que las órdenes de proyectos tengan el departamento correcto
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder
from app.models.departamento import Departamento

session = next(get_session())

print('=== VERIFICACION FINAL DE DEPARTAMENTOS EN OC ===')
print()

# Obtener departamentos
stmt_dept = select(Departamento)
departamentos = {d.id: d.nombre for d in session.exec(stmt_dept).all()}

# Obtener órdenes de proyectos
stmt_ordenes = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
ordenes_proyecto = session.exec(stmt_ordenes).all()

print(f'Total órdenes de proyectos: {len(ordenes_proyecto)}')

# Agrupar por departamento
dept_count = {}
for orden in ordenes_proyecto:
    dept_id = orden.departamento_id
    dept_name = departamentos.get(dept_id, f'ID {dept_id}' if dept_id else 'SIN DEPARTAMENTO')
    dept_count[dept_name] = dept_count.get(dept_name, 0) + 1

print('\nDistribución por departamento:')
for dept_name, count in dept_count.items():
    print(f'  {dept_name}: {count} órdenes')

# Verificar proyectos específicos 14-17
print('\nVerificación proyectos 14-17:')
proyecto_oportunidad_map = {14: 204, 15: 205, 16: 206, 17: 207}

for proyecto_id, oportunidad_id in proyecto_oportunidad_map.items():
    ordenes_proyecto_especifico = [o for o in ordenes_proyecto if o.oportunidad_id == oportunidad_id]
    
    if ordenes_proyecto_especifico:
        dept_ids = set(o.departamento_id for o in ordenes_proyecto_especifico)
        dept_names = [departamentos.get(d_id, f'ID {d_id}') for d_id in dept_ids]
        print(f'  Proyecto {proyecto_id} (Oportunidad {oportunidad_id}): {len(ordenes_proyecto_especifico)} órdenes - Departamentos: {dept_names}')

print('\n=== FIN VERIFICACION ===')