#!/usr/bin/env python3
"""
Verificar los datos de prueba generados para proyectos 14-17
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder
from app.models.crm.evento import CRMEvento

session = next(get_session())

print('=== VERIFICACION DE DATOS GENERADOS ===')
proyecto_ids = [14, 15, 16, 17]

total_ordenes_global = 0
total_eventos_global = 0
total_monto_global = 0

for pid in proyecto_ids:
    proyecto = session.get(Proyecto, pid)
    if proyecto and proyecto.oportunidad_id:
        # Contar órdenes
        ordenes = session.exec(select(PoOrder).where(PoOrder.oportunidad_id == proyecto.oportunidad_id)).all()
        # Contar eventos  
        eventos = session.exec(select(CRMEvento).where(CRMEvento.oportunidad_id == proyecto.oportunidad_id)).all()
        
        print(f'PROYECTO {pid}: "{proyecto.nombre}"')
        print(f'  Oportunidad ID: {proyecto.oportunidad_id}')
        print(f'  Órdenes de compra: {len(ordenes)}')
        print(f'  Eventos/tareas: {len(eventos)}')
        
        if ordenes:
            total_ordenes = sum(orden.total for orden in ordenes)
            total_monto_global += total_ordenes
            print(f'  Total en órdenes: ${total_ordenes:,.2f}')
            
            # Mostrar estados de órdenes
            estados = {}
            for orden in ordenes:
                estado = orden.order_status.nombre if orden.order_status else 'Sin estado'
                estados[estado] = estados.get(estado, 0) + 1
            print(f'  Estados órdenes: {estados}')
        
        if eventos:
            # Mostrar estados de eventos
            estados_eventos = {}
            for evento in eventos:
                estado = evento.estado_evento
                estados_eventos[estado] = estados_eventos.get(estado, 0) + 1
            print(f'  Estados eventos: {estados_eventos}')
        
        total_ordenes_global += len(ordenes)
        total_eventos_global += len(eventos)
        
        print('-' * 50)

print()
print('=== RESUMEN GLOBAL ===')
print(f'✅ Total órdenes creadas: {total_ordenes_global}')
print(f'✅ Total eventos creados: {total_eventos_global}')
print(f'💰 Total monto en órdenes: ${total_monto_global:,.2f}')
print(f'📊 Total registros: {total_ordenes_global + total_eventos_global}')