#!/usr/bin/env python3
"""
Verificar y corregir los estados de eventos CRM
Convertir estados legacy a formato canónico con prefijo numérico
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.crm.evento import CRMEvento
from app.models.enums import EstadoEvento

def corregir_estados_eventos():
    print('=== VERIFICACION Y CORRECCION DE ESTADOS DE EVENTOS ===')
    print()
    
    try:
        session = next(get_session())
        
        # Estados canónicos esperados
        estados_canonicos = {
            'pendiente': EstadoEvento.PENDIENTE.value,      # "1-pendiente"
            'realizado': EstadoEvento.REALIZADO.value,      # "2-realizado"  
            'cancelado': EstadoEvento.CANCELADO.value,      # "3-cancelado"
            'hecho': EstadoEvento.REALIZADO.value,          # "hecho" → "2-realizado"
            # Mapear también posibles variaciones
            '1-pendiente': EstadoEvento.PENDIENTE.value,
            '2-realizado': EstadoEvento.REALIZADO.value,
            '3-cancelado': EstadoEvento.CANCELADO.value,
        }
        
        print('Estados canónicos esperados:')
        for legacy, canonico in estados_canonicos.items():
            if not legacy.startswith(('1-', '2-', '3-')):  # Solo mostrar mapeos legacy -> canónico
                print(f'  "{legacy}" → "{canonico}"')
        print()
        
        # Obtener todos los eventos CRM
        stmt = select(CRMEvento)
        eventos = session.exec(stmt).all()
        
        print(f'Total eventos encontrados: {len(eventos)}')
        
        # Analizar estados actuales
        estados_actuales = {}
        eventos_con_problemas = []
        
        for evento in eventos:
            estado_actual = evento.estado_evento
            if estado_actual in estados_actuales:
                estados_actuales[estado_actual] += 1
            else:
                estados_actuales[estado_actual] = 1
            
            # Verificar si necesita corrección
            if estado_actual not in [EstadoEvento.PENDIENTE.value, EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value] and estado_actual in estados_canonicos:
                eventos_con_problemas.append(evento)
        
        print('Estados actuales encontrados:')
        for estado, cantidad in estados_actuales.items():
            if estado in [EstadoEvento.PENDIENTE.value, EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value]:
                print(f'  ✅ "{estado}": {cantidad} eventos (CORRECTO)')
            else:
                print(f'  ❌ "{estado}": {cantidad} eventos (LEGACY - necesita corrección)')
        
        print()
        print(f'Eventos que necesitan corrección: {len(eventos_con_problemas)}')
        
        if eventos_con_problemas:
            print()
            print('Corrigiendo estados legacy...')
            
            correcciones = 0
            for evento in eventos_con_problemas:
                estado_legacy = evento.estado_evento
                estado_canonico = estados_canonicos.get(estado_legacy)
                
                if estado_canonico:
                    print(f'  ID {evento.id}: "{estado_legacy}" → "{estado_canonico}"')
                    evento.estado_evento = estado_canonico
                    session.add(evento)
                    correcciones += 1
                else:
                    print(f'  ⚠️  ID {evento.id}: Estado "{estado_legacy}" no reconocido')
            
            # Confirmar cambios
            session.commit()
            
            print()
            print(f'✅ {correcciones} eventos corregidos exitosamente')
            
            # Verificación final
            print()
            print('Verificación final de estados...')
            stmt_final = select(CRMEvento)
            eventos_final = session.exec(stmt_final).all()
            
            estados_finales = {}
            for evento in eventos_final:
                estado = evento.estado_evento
                estados_finales[estado] = estados_finales.get(estado, 0) + 1
            
            print('Estados finales:')
            todo_correcto = True
            for estado, cantidad in estados_finales.items():
                if estado in [EstadoEvento.PENDIENTE.value, EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value]:
                    print(f'  ✅ "{estado}": {cantidad} eventos')
                else:
                    print(f'  ❌ "{estado}": {cantidad} eventos (AÚN INCORRECTO)')
                    todo_correcto = False
            
            if todo_correcto:
                print()
                print('🎉 TODOS LOS ESTADOS HAN SIDO CORREGIDOS!')
                print('✅ Los eventos ahora usan formato canónico con prefijo numérico')
            else:
                print()
                print('⚠️  Algunos eventos aún tienen estados incorrectos')
        else:
            print('✅ Todos los eventos ya tienen estados correctos')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    corregir_estados_eventos()