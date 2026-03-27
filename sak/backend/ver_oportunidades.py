#!/usr/bin/env python3
"""
Ver qué oportunidades existen en la base de datos
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.crm.oportunidad import CRMOportunidad

def ver_oportunidades():
    print('=== OPORTUNIDADES EXISTENTES ===')
    
    try:
        session = next(get_session())
        
        # Obtener todas las oportunidades
        oportunidades = session.exec(select(CRMOportunidad)).all()
        print(f'Total oportunidades: {len(oportunidades)}')
        
        if len(oportunidades) > 0:
            print('\nPrimeras 20 oportunidades:')
            print('ID   | Título')
            print('-' * 50)
            
            for i, oportunidad in enumerate(oportunidades[:20]):
                titulo = oportunidad.titulo if oportunidad.titulo else 'SIN TÍTULO'
                print(f'{oportunidad.id:4d} | {titulo}')
        
        # Buscar específicamente oportunidades de proyectos
        oportunidades_proyecto = session.exec(
            select(CRMOportunidad)
            .where(CRMOportunidad.titulo.contains("proyecto"))
        ).all()
        
        print(f'\nOportunidades que contienen "proyecto": {len(oportunidades_proyecto)}')
        
        for oportunidad in oportunidades_proyecto:
            titulo = oportunidad.titulo if oportunidad.titulo else 'SIN TÍTULO'
            print(f'  {oportunidad.id:4d} | {titulo}')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    ver_oportunidades()