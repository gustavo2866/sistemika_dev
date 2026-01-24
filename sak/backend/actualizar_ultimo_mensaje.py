#!/usr/bin/env python3
"""
Script para actualizar los campos ultimo_mensaje_id y ultimo_mensaje_at
en la tabla crm_oportunidades para todas las oportunidades que tienen mensajes.

Uso:
    python actualizar_ultimo_mensaje.py [--dry-run]

Opciones:
    --dry-run   Solo muestra qué se actualizaría, sin hacer cambios reales
"""

import asyncio
import argparse
from datetime import datetime
from typing import List, Tuple

from sqlalchemy import text
from sqlmodel import select

from app.database import get_async_session
from app.models.crm.oportunidad import CRMOportunidad
from app.models.crm.mensaje import CRMMensaje


async def obtener_ultimo_mensaje_por_oportunidad() -> List[Tuple[int, int, datetime]]:
    """
    Obtiene el último mensaje de cada oportunidad que tiene mensajes.
    
    Returns:
        Lista de tuplas (oportunidad_id, ultimo_mensaje_id, fecha_mensaje)
    """
    async with get_async_session() as session:
        # Consulta para obtener el último mensaje de cada oportunidad
        query = text("""
            SELECT DISTINCT ON (m.oportunidad_id) 
                m.oportunidad_id,
                m.id as ultimo_mensaje_id,
                m.fecha_mensaje
            FROM crm_mensajes m
            WHERE m.oportunidad_id IS NOT NULL
            ORDER BY m.oportunidad_id, m.fecha_mensaje DESC, m.id DESC
        """)
        
        result = await session.execute(query)
        return result.fetchall()


async def actualizar_oportunidad_ultimo_mensaje(
    oportunidad_id: int, 
    ultimo_mensaje_id: int, 
    fecha_mensaje: datetime, 
    dry_run: bool = False
) -> bool:
    """
    Actualiza una oportunidad específica con su último mensaje.
    
    Args:
        oportunidad_id: ID de la oportunidad a actualizar
        ultimo_mensaje_id: ID del último mensaje
        fecha_mensaje: Fecha del último mensaje
        dry_run: Si es True, solo simula la actualización
    
    Returns:
        True si la actualización fue exitosa, False en caso contrario
    """
    try:
        if dry_run:
            print(f"[DRY-RUN] Oportunidad {oportunidad_id}: "
                  f"ultimo_mensaje_id={ultimo_mensaje_id}, "
                  f"ultimo_mensaje_at={fecha_mensaje}")
            return True
        
        async with get_async_session() as session:
            # Buscar la oportunidad
            oportunidad = await session.get(CRMOportunidad, oportunidad_id)
            if not oportunidad:
                print(f"ERROR: No se encontró la oportunidad {oportunidad_id}")
                return False
            
            # Actualizar los campos
            oportunidad.ultimo_mensaje_id = ultimo_mensaje_id
            oportunidad.ultimo_mensaje_at = fecha_mensaje
            
            # Guardar los cambios
            session.add(oportunidad)
            await session.commit()
            
            print(f"✓ Actualizada oportunidad {oportunidad_id}: "
                  f"ultimo_mensaje_id={ultimo_mensaje_id}, "
                  f"ultimo_mensaje_at={fecha_mensaje}")
            return True
            
    except Exception as e:
        print(f"ERROR al actualizar oportunidad {oportunidad_id}: {str(e)}")
        return False


async def main():
    """Función principal del script."""
    parser = argparse.ArgumentParser(
        description="Actualizar campos ultimo_mensaje en crm_oportunidades"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Solo mostrar qué se actualizaría, sin hacer cambios"
    )
    
    args = parser.parse_args()
    
    print("🔍 Buscando oportunidades con mensajes...")
    
    try:
        # Obtener todos los últimos mensajes por oportunidad
        ultimos_mensajes = await obtener_ultimo_mensaje_por_oportunidad()
        
        if not ultimos_mensajes:
            print("ℹ️  No se encontraron oportunidades con mensajes.")
            return
        
        print(f"📊 Se encontraron {len(ultimos_mensajes)} oportunidades con mensajes.")
        
        if args.dry_run:
            print("\n🏃‍♂️ MODO DRY-RUN - No se harán cambios reales:\n")
        else:
            print("\n🚀 Iniciando actualización...\n")
        
        # Contadores
        exitosos = 0
        errores = 0
        
        # Procesar cada oportunidad
        for oportunidad_id, ultimo_mensaje_id, fecha_mensaje in ultimos_mensajes:
            resultado = await actualizar_oportunidad_ultimo_mensaje(
                oportunidad_id, 
                ultimo_mensaje_id, 
                fecha_mensaje, 
                args.dry_run
            )
            
            if resultado:
                exitosos += 1
            else:
                errores += 1
        
        # Resumen
        print(f"\n📈 RESUMEN:")
        print(f"✅ Actualizaciones exitosas: {exitosos}")
        print(f"❌ Errores: {errores}")
        print(f"📊 Total procesadas: {len(ultimos_mensajes)}")
        
        if args.dry_run:
            print("\n💡 Para aplicar los cambios reales, ejecuta el script sin --dry-run")
        else:
            print(f"\n🎉 ¡Actualización completada!")
            
    except Exception as e:
        print(f"❌ Error crítico: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(main())