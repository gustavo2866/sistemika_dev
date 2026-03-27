#!/usr/bin/env python3
"""
Script para verificar la consistencia de todos los proyectos
Verifica que cada proyecto tenga: responsable_id, oportunidad_id, y contacto vinculado
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.crm.contacto import CRMContacto  
from app.models.crm.oportunidad import CRMOportunidad

def verificar_consistencia():
    print('=== VERIFICACION DE CONSISTENCIA DE PROYECTOS ===')
    print()

    try:
        session = next(get_session())
        
        # Obtener todos los proyectos
        stmt = select(Proyecto).order_by(Proyecto.id)
        proyectos = session.exec(stmt).all()
        
        print(f'Total de proyectos encontrados: {len(proyectos)}')
        print()
        
        consistentes = 0
        inconsistentes = 0
        proyectos_con_problemas = []
        
        for proyecto in proyectos:
            print(f'PROYECTO ID {proyecto.id}: "{proyecto.nombre}"')
            
            problemas = []
            
            # Verificar responsable_id
            if not proyecto.responsable_id:
                problemas.append('❌ Sin responsable_id')
            else:
                print(f'   ✅ Responsable ID: {proyecto.responsable_id}')
            
            # Verificar oportunidad_id
            if not proyecto.oportunidad_id:
                problemas.append('❌ Sin oportunidad_id')
            else:
                print(f'   ✅ Oportunidad ID: {proyecto.oportunidad_id}')
                
                # Verificar que la oportunidad existe
                oportunidad = session.get(CRMOportunidad, proyecto.oportunidad_id)
                if not oportunidad:
                    problemas.append('❌ Oportunidad no existe en BD')
                else:
                    print(f'   ✅ Oportunidad existe: "{oportunidad.titulo}"')
                    
                    # Verificar contacto_id en la oportunidad
                    if not oportunidad.contacto_id:
                        problemas.append('❌ Oportunidad sin contacto_id')
                    else:
                        print(f'   ✅ Contacto ID: {oportunidad.contacto_id}')
                        
                        # Verificar que el contacto existe
                        contacto = session.get(CRMContacto, oportunidad.contacto_id)
                        if not contacto:
                            problemas.append('❌ Contacto no existe en BD')
                        else:
                            print(f'   ✅ Contacto existe: "{contacto.nombre_completo}"')
            
            if problemas:
                print('   INCONSISTENCIAS:')
                for problema in problemas:
                    print(f'      {problema}')
                inconsistentes += 1
                proyectos_con_problemas.append({
                    'id': proyecto.id,
                    'nombre': proyecto.nombre,
                    'problemas': problemas
                })
            else:
                print('   ✅ PROYECTO CONSISTENTE')
                consistentes += 1
            
            print('-' * 60)
        
        print()
        print('=== RESUMEN FINAL ===')
        print(f'✅ Proyectos consistentes: {consistentes}')
        print(f'❌ Proyectos inconsistentes: {inconsistentes}')
        print(f'📊 Total verificados: {len(proyectos)}')
        
        if inconsistentes > 0:
            print()
            print('⚠️  PROYECTOS QUE NECESITAN CORRECCION:')
            for proyecto_problema in proyectos_con_problemas:
                print(f'   • ID {proyecto_problema["id"]}: "{proyecto_problema["nombre"]}"')
                for problema in proyecto_problema['problemas']:
                    print(f'     {problema}')
            print()
            print('⚠️  ACCION REQUERIDA: Hay proyectos que necesitan corrección')
        else:
            print('✅ TODOS LOS PROYECTOS ESTAN CONSISTENTES!')

    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verificar_consistencia()