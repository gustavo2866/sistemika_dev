#!/usr/bin/env python3
"""
Verificar específicamente los eventos del proyecto 17
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.crm.evento import CRMEvento

session = next(get_session())

print('=== VERIFICACION ESPECIFICA DEL PROYECTO 17 ===')

# Obtener proyecto 17
proyecto = session.get(Proyecto, 17)

if not proyecto:
    print('❌ Proyecto 17 no encontrado')
    exit()

print(f'Proyecto: "{proyecto.nombre}"')
print(f'ID: {proyecto.id}')
print(f'Oportunidad ID: {proyecto.oportunidad_id}')

if not proyecto.oportunidad_id:
    print('❌ Proyecto sin oportunidad_id')
    exit()

# Buscar eventos vinculados a la oportunidad
stmt = select(CRMEvento).where(CRMEvento.oportunidad_id == proyecto.oportunidad_id)
eventos = session.exec(stmt).all()

print(f'Eventos encontrados: {len(eventos)}')
print()

if eventos:
    print('DETALLE DE EVENTOS:')
    for i, evento in enumerate(eventos, 1):
        print(f'{i}. "{evento.titulo}"')
        print(f'   Estado: {evento.estado_evento}')
        print(f'   Fecha: {evento.fecha_evento}')
        print(f'   Descripción: {evento.descripcion[:100]}...' if len(evento.descripcion) > 100 else f'   Descripción: {evento.descripcion}')
        print(f'   Contacto ID: {evento.contacto_id}')
        print(f'   Oportunidad ID: {evento.oportunidad_id}')
        print(f'   Created: {evento.created_at}')
        print()
else:
    print('❌ No se encontraron eventos para este proyecto')

print('=== FIN VERIFICACION ===')