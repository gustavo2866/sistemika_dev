#!/usr/bin/env python3
"""
Script para actualizar los mensajes de prueba ya generados a estado ENVIADO
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.db import get_session
from app.models.crm.mensaje import CRMMensaje
from app.models.enums import EstadoMensaje
from app.crud.crm_mensaje_crud import crm_mensaje_crud


def actualizar_mensajes_prueba():
    """Actualiza mensajes de prueba de RECIBIDO a ENVIADO"""
    
    with next(get_session()) as session:
        # Buscar mensajes que parecen ser de prueba (con origen_externo_id que empiece con "test_msg_")
        stmt = select(CRMMensaje).where(
            CRMMensaje.origen_externo_id.like("test_msg_%"),
            CRMMensaje.estado == EstadoMensaje.RECIBIDO.value
        )
        mensajes_prueba = session.exec(stmt).all()
        
        if not mensajes_prueba:
            print("✅ No hay mensajes de prueba en estado RECIBIDO para actualizar")
            return
        
        print(f"📊 Encontrados {len(mensajes_prueba)} mensajes de prueba para actualizar")
        
        actualizados = 0
        for mensaje in mensajes_prueba:
            try:
                crm_mensaje_crud.update(session, mensaje.id, {"estado": EstadoMensaje.ENVIADO.value})
                actualizados += 1
                print(f"✅ Mensaje {mensaje.id} actualizado a ENVIADO")
            except Exception as e:
                print(f"❌ Error actualizando mensaje {mensaje.id}: {e}")
        
        print(f"\n🎉 {actualizados} mensajes actualizados a estado ENVIADO")


if __name__ == "__main__":
    actualizar_mensajes_prueba()