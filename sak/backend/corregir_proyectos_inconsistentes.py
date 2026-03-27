#!/usr/bin/env python3
"""
Script para corregir automáticamente la consistencia de proyectos
Crea oportunidades y contactos faltantes para proyectos sin oportunidad_id
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.crm.contacto import CRMContacto  
from app.models.crm.oportunidad import CRMOportunidad
from app.models.crm.oportunidad import EstadoOportunidad
from datetime import datetime, UTC

def corregir_proyectos_inconsistentes():
    print('=== CORRECCION AUTOMATICA DE PROYECTOS INCONSISTENTES ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener proyectos sin oportunidad_id
        stmt = select(Proyecto).where(Proyecto.oportunidad_id == None).order_by(Proyecto.id)
        proyectos_inconsistentes = session.exec(stmt).all()
        
        total_inconsistentes = len(proyectos_inconsistentes)
        print(f'Proyectos inconsistentes encontrados: {total_inconsistentes}')
        
        if total_inconsistentes == 0:
            print('✅ No hay proyectos inconsistentes para corregir')
            return
        
        print()
        print('Iniciando corrección automática...')
        print('-' * 60)
        
        corregidos = 0
        errores = 0
        
        for i, proyecto in enumerate(proyectos_inconsistentes, 1):
            print(f'[{i}/{total_inconsistentes}] Corrigiendo proyecto ID {proyecto.id}: "{proyecto.nombre}"')
            
            try:
                # 1. Crear contacto automático con prefijo "proyecto:"
                contacto_data = {
                    "nombre_completo": f"proyecto: {proyecto.nombre}",
                    "responsable_id": proyecto.responsable_id,
                    "activo": True,
                    "notas": f"Contacto creado automáticamente para proyecto existente: {proyecto.nombre}"
                }
                contacto = CRMContacto(**contacto_data)
                session.add(contacto)
                session.flush()  # Para obtener el ID del contacto
                
                print(f'   ✅ Contacto creado (ID: {contacto.id}): "{contacto.nombre_completo}"')
                
                # 2. Crear oportunidad automática
                oportunidad_data = {
                    "titulo": proyecto.nombre,  # Título igual al nombre del proyecto
                    "contacto_id": contacto.id,
                    "tipo_operacion_id": 4,  # ID 4 = "proyecto"
                    "responsable_id": proyecto.responsable_id,
                    "estado": EstadoOportunidad.PROSPECT.value,
                    "activo": True,
                    "fecha_estado": datetime.now(UTC),
                    "descripcion": f"Oportunidad creada automáticamente para proyecto existente: {proyecto.nombre}"
                }
                oportunidad = CRMOportunidad(**oportunidad_data)
                session.add(oportunidad)
                session.flush()  # Para obtener el ID de la oportunidad
                
                print(f'   ✅ Oportunidad creada (ID: {oportunidad.id}): "{oportunidad.titulo}"')
                
                # 3. Vincular oportunidad al proyecto
                proyecto.oportunidad_id = oportunidad.id
                session.add(proyecto)
                
                print(f'   ✅ Proyecto vinculado a oportunidad')
                
                session.commit()
                corregidos += 1
                print(f'   ✅ PROYECTO CORREGIDO EXITOSAMENTE')
                
            except Exception as e:
                print(f'   ❌ ERROR corrigiendo proyecto {proyecto.id}: {e}')
                session.rollback()
                errores += 1
                
            print('-' * 60)
        
        print()
        print('=== RESUMEN DE CORRECCION ===')
        print(f'✅ Proyectos corregidos exitosamente: {corregidos}')
        print(f'❌ Proyectos con errores: {errores}')
        print(f'📊 Total procesados: {total_inconsistentes}')
        
        if errores == 0:
            print()
            print('🎉 TODOS LOS PROYECTOS HAN SIDO CORREGIDOS EXITOSAMENTE!')
            print('🔗 Ahora todos los proyectos tienen oportunidad y contacto vinculados')
        else:
            print(f'⚠️  {errores} proyectos necesitan revision manual')
            
        # Verificación final
        print()
        print('Ejecutando verificación final...')
        stmt_verificacion = select(Proyecto).where(Proyecto.oportunidad_id == None)
        proyectos_aun_inconsistentes = session.exec(stmt_verificacion).all()
        
        if len(proyectos_aun_inconsistentes) == 0:
            print('✅ VERIFICACION EXITOSA: No quedan proyectos inconsistentes')
        else:
            print(f'⚠️  Aún quedan {len(proyectos_aun_inconsistentes)} proyectos inconsistentes')
            
    except Exception as e:
        print(f'❌ ERROR GENERAL: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print('Este script creará automáticamente oportunidades y contactos')
    print('para todos los proyectos que no los tienen.')
    print()
    response = input('¿Continuar? (s/N): ').lower().strip()
    
    if response in ['s', 'si', 'yes', 'y']:
        corregir_proyectos_inconsistentes()
    else:
        print('Operación cancelada por el usuario')