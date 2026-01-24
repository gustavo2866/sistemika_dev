#!/usr/bin/env python3
"""
Script SQL directo para actualizar los campos ultimo_mensaje_id y ultimo_mensaje_at
en la tabla crm_oportunidades usando una sola consulta SQL.

Este enfoque es más eficiente para grandes volúmenes de datos.

Uso:
    python actualizar_ultimo_mensaje_sql.py [--dry-run]

Opciones:
    --dry-run   Solo muestra el SQL que se ejecutaría, sin hacer cambios reales
"""

import argparse
from sqlalchemy import text
from sqlmodel import Session

from app.db import get_session


SQL_UPDATE_ULTIMO_MENSAJE = """
UPDATE crm_oportunidades 
SET 
    ultimo_mensaje_id = ultimo_msg.mensaje_id,
    ultimo_mensaje_at = ultimo_msg.fecha_mensaje,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (m.oportunidad_id) 
        m.oportunidad_id,
        m.id as mensaje_id,
        m.fecha_mensaje
    FROM crm_mensajes m
    WHERE m.oportunidad_id IS NOT NULL
    ORDER BY m.oportunidad_id, m.fecha_mensaje DESC, m.id DESC
) ultimo_msg
WHERE crm_oportunidades.id = ultimo_msg.oportunidad_id
"""

SQL_COUNT_OPORTUNIDADES_CON_MENSAJES = """
SELECT COUNT(DISTINCT m.oportunidad_id) as total
FROM crm_mensajes m
WHERE m.oportunidad_id IS NOT NULL
"""

SQL_PREVIEW_CAMBIOS = """
SELECT 
    o.id as oportunidad_id,
    o.titulo,
    o.ultimo_mensaje_id as actual_ultimo_mensaje_id,
    o.ultimo_mensaje_at as actual_ultimo_mensaje_at,
    ultimo_msg.mensaje_id as nuevo_ultimo_mensaje_id,
    ultimo_msg.fecha_mensaje as nuevo_ultimo_mensaje_at
FROM crm_oportunidades o
JOIN (
    SELECT DISTINCT ON (m.oportunidad_id) 
        m.oportunidad_id,
        m.id as mensaje_id,
        m.fecha_mensaje
    FROM crm_mensajes m
    WHERE m.oportunidad_id IS NOT NULL
    ORDER BY m.oportunidad_id, m.fecha_mensaje DESC, m.id DESC
) ultimo_msg ON o.id = ultimo_msg.oportunidad_id
WHERE 
    o.ultimo_mensaje_id IS DISTINCT FROM ultimo_msg.mensaje_id 
    OR o.ultimo_mensaje_at IS DISTINCT FROM ultimo_msg.fecha_mensaje
ORDER BY o.id
LIMIT 10
"""


def contar_oportunidades_con_mensajes() -> int:
    """Cuenta cuántas oportunidades tienen mensajes."""
    with next(get_session()) as session:
        result = session.execute(text(SQL_COUNT_OPORTUNIDADES_CON_MENSAJES))
        row = result.fetchone()
        return row.total if row else 0


def preview_cambios():
    """Muestra una preview de los primeros 10 cambios que se harían."""
    with next(get_session()) as session:
        result = session.execute(text(SQL_PREVIEW_CAMBIOS))
        cambios = result.fetchall()
        
        if not cambios:
            print("ℹ️  No hay cambios pendientes - todos los campos están actualizados.")
            return 0
        
        print("\n📋 PREVIEW de cambios (primeros 10):")
        print("-" * 120)
        print(f"{'ID':<6} {'Título':<30} {'Actual ID':<12} {'Nueva ID':<12} {'Actual Fecha':<20} {'Nueva Fecha':<20}")
        print("-" * 120)
        
        for cambio in cambios:
            titulo_truncado = (cambio.titulo or "Sin título")[:28]
            actual_fecha = cambio.actual_ultimo_mensaje_at.strftime('%Y-%m-%d %H:%M') if cambio.actual_ultimo_mensaje_at else 'NULL'
            nueva_fecha = cambio.nuevo_ultimo_mensaje_at.strftime('%Y-%m-%d %H:%M') if cambio.nuevo_ultimo_mensaje_at else 'NULL'
            
            print(f"{cambio.oportunidad_id:<6} {titulo_truncado:<30} "
                  f"{cambio.actual_ultimo_mensaje_id or 'NULL':<12} {cambio.nuevo_ultimo_mensaje_id:<12} "
                  f"{actual_fecha:<20} {nueva_fecha:<20}")
        
        return len(cambios)


def ejecutar_actualizacion(dry_run: bool = False) -> int:
    """
    Ejecuta la actualización SQL.
    
    Args:
        dry_run: Si es True, solo simula la ejecución
    
    Returns:
        Número de filas afectadas
    """
    with next(get_session()) as session:
        if dry_run:
            print("\n🏃‍♂️ MODO DRY-RUN - SQL que se ejecutaría:")
            print("-" * 80)
            print(SQL_UPDATE_ULTIMO_MENSAJE)
            print("-" * 80)
            return 0
        
        # Ejecutar la actualización
        result = session.execute(text(SQL_UPDATE_ULTIMO_MENSAJE))
        filas_afectadas = result.rowcount
        
        # Confirmar los cambios
        session.commit()
        
        return filas_afectadas


def main():
    """Función principal del script."""
    parser = argparse.ArgumentParser(
        description="Actualizar campos ultimo_mensaje en crm_oportunidades usando SQL directo"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Solo mostrar qué se actualizaría, sin hacer cambios"
    )
    
    args = parser.parse_args()
    
    try:
        print("🔍 Analizando oportunidades con mensajes...")
        
        # Contar oportunidades con mensajes
        total_con_mensajes = contar_oportunidades_con_mensajes()
        print(f"📊 Total de oportunidades con mensajes: {total_con_mensajes}")
        
        if total_con_mensajes == 0:
            print("ℹ️  No se encontraron oportunidades con mensajes.")
            return
        
        # Mostrar preview de cambios
        cambios_pendientes = preview_cambios()
        
        if cambios_pendientes == 0:
            print("✅ Todos los campos ultimo_mensaje ya están actualizados.")
            return
        
        # Confirmar si proceder (solo en modo real)
        if not args.dry_run:
            respuesta = input(f"\n¿Proceder con la actualización de {cambios_pendientes}+ registros? (y/N): ")
            if respuesta.lower() != 'y':
                print("❌ Operación cancelada.")
                return
        
        print(f"\n🚀 Ejecutando actualización...")
        
        # Ejecutar actualización
        filas_afectadas = ejecutar_actualizacion(args.dry_run)
        
        if args.dry_run:
            print("\n💡 Para aplicar los cambios reales, ejecuta el script sin --dry-run")
        else:
            print(f"\n🎉 ¡Actualización completada!")
            print(f"✅ Filas actualizadas: {filas_afectadas}")
            
    except Exception as e:
        print(f"❌ Error crítico: {str(e)}")
        raise


if __name__ == "__main__":
    main()