#!/usr/bin/env python3
"""
Script para verificar que los campos ultimo_mensaje_id y ultimo_mensaje_at
están correctamente sincronizados en la tabla crm_oportunidades.

Uso:
    python verificar_ultimo_mensaje.py
"""

from sqlalchemy import text
from sqlmodel import Session

from app.db import get_session


SQL_VERIFICACION = """
WITH ultimo_mensaje_real AS (
    SELECT DISTINCT ON (m.oportunidad_id) 
        m.oportunidad_id,
        m.id as mensaje_id,
        m.fecha_mensaje
    FROM crm_mensajes m
    WHERE m.oportunidad_id IS NOT NULL
    ORDER BY m.oportunidad_id, m.fecha_mensaje DESC, m.id DESC
),
verificacion AS (
    SELECT 
        o.id as oportunidad_id,
        o.titulo,
        o.ultimo_mensaje_id as campo_ultimo_mensaje_id,
        o.ultimo_mensaje_at as campo_ultimo_mensaje_at,
        umr.mensaje_id as real_ultimo_mensaje_id,
        umr.fecha_mensaje as real_ultimo_mensaje_at,
        CASE 
            WHEN o.ultimo_mensaje_id = umr.mensaje_id 
                AND o.ultimo_mensaje_at = umr.fecha_mensaje 
            THEN 'OK'
            WHEN o.ultimo_mensaje_id IS NULL AND o.ultimo_mensaje_at IS NULL
            THEN 'PENDIENTE'
            ELSE 'DESINCRONIZADO'
        END as estado_sincronizacion
    FROM crm_oportunidades o
    LEFT JOIN ultimo_mensaje_real umr ON o.id = umr.oportunidad_id
)
SELECT 
    estado_sincronizacion,
    COUNT(*) as cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM verificacion
GROUP BY estado_sincronizacion
ORDER BY cantidad DESC;
"""

SQL_DETALLE_DESINCRONIZADOS = """
WITH ultimo_mensaje_real AS (
    SELECT DISTINCT ON (m.oportunidad_id) 
        m.oportunidad_id,
        m.id as mensaje_id,
        m.fecha_mensaje
    FROM crm_mensajes m
    WHERE m.oportunidad_id IS NOT NULL
    ORDER BY m.oportunidad_id, m.fecha_mensaje DESC, m.id DESC
)
SELECT 
    o.id as oportunidad_id,
    o.titulo,
    o.ultimo_mensaje_id as campo_ultimo_mensaje_id,
    o.ultimo_mensaje_at as campo_ultimo_mensaje_at,
    umr.mensaje_id as real_ultimo_mensaje_id,
    umr.fecha_mensaje as real_ultimo_mensaje_at
FROM crm_oportunidades o
LEFT JOIN ultimo_mensaje_real umr ON o.id = umr.oportunidad_id
WHERE 
    (o.ultimo_mensaje_id IS DISTINCT FROM umr.mensaje_id 
     OR o.ultimo_mensaje_at IS DISTINCT FROM umr.fecha_mensaje)
    AND umr.oportunidad_id IS NOT NULL
ORDER BY o.id
LIMIT 20;
"""

SQL_ESTADISTICAS = """
SELECT 
    (SELECT COUNT(*) FROM crm_oportunidades) as total_oportunidades,
    (SELECT COUNT(DISTINCT oportunidad_id) FROM crm_mensajes WHERE oportunidad_id IS NOT NULL) as oportunidades_con_mensajes,
    (SELECT COUNT(*) FROM crm_oportunidades WHERE ultimo_mensaje_id IS NOT NULL) as oportunidades_con_ultimo_mensaje_configurado;
"""


def verificar_sincronizacion():
    """Verifica el estado de sincronización general."""
    with next(get_session()) as session:
        result = session.execute(text(SQL_VERIFICACION))
        resultados = result.fetchall()
        
        print("📊 ESTADO DE SINCRONIZACIÓN:")
        print("-" * 50)
        print(f"{'Estado':<20} {'Cantidad':<10} {'Porcentaje':<10}")
        print("-" * 50)
        
        for row in resultados:
            print(f"{row.estado_sincronizacion:<20} {row.cantidad:<10} {row.porcentaje}%")
        
        return resultados


def mostrar_estadisticas():
    """Muestra estadísticas generales."""
    with next(get_session()) as session:
        result = session.execute(text(SQL_ESTADISTICAS))
        stats = result.fetchone()
        
        print("\n📈 ESTADÍSTICAS GENERALES:")
        print("-" * 50)
        print(f"Total de oportunidades: {stats.total_oportunidades}")
        print(f"Oportunidades con mensajes: {stats.oportunidades_con_mensajes}")
        print(f"Oportunidades con último mensaje configurado: {stats.oportunidades_con_ultimo_mensaje_configurado}")
        
        if stats.oportunidades_con_mensajes > 0:
            porcentaje_configurado = (stats.oportunidades_con_ultimo_mensaje_configurado / stats.oportunidades_con_mensajes) * 100
            print(f"Porcentaje configurado: {porcentaje_configurado:.1f}%")


def mostrar_desincronizados():
    """Muestra los primeros registros desincronizados."""
    with next(get_session()) as session:
        result = session.execute(text(SQL_DETALLE_DESINCRONIZADOS))
        desincronizados = result.fetchall()
        
        if not desincronizados:
            print("\n✅ No hay registros desincronizados.")
            return
        
        print(f"\n⚠️  REGISTROS DESINCRONIZADOS (primeros 20):")
        print("-" * 120)
        print(f"{'ID':<6} {'Título':<25} {'Campo ID':<10} {'Real ID':<10} {'Campo Fecha':<20} {'Real Fecha':<20}")
        print("-" * 120)
        
        for row in desincronizados:
            titulo_truncado = (row.titulo or "Sin título")[:23]
            campo_fecha = row.campo_ultimo_mensaje_at.strftime('%Y-%m-%d %H:%M') if row.campo_ultimo_mensaje_at else 'NULL'
            real_fecha = row.real_ultimo_mensaje_at.strftime('%Y-%m-%d %H:%M') if row.real_ultimo_mensaje_at else 'NULL'
            
            print(f"{row.oportunidad_id:<6} {titulo_truncado:<25} "
                  f"{row.campo_ultimo_mensaje_id or 'NULL':<10} {row.real_ultimo_mensaje_id or 'NULL':<10} "
                  f"{campo_fecha:<20} {real_fecha:<20}")


def main():
    """Función principal del script."""
    print("🔍 Verificando sincronización de campos ultimo_mensaje...\n")
    
    try:
        # Mostrar estadísticas generales
        mostrar_estadisticas()
        
        # Verificar sincronización
        resultados = verificar_sincronizacion()
        
        # Si hay desincronizados, mostrar detalles
        hay_desincronizados = any(r.estado_sincronizacion == 'DESINCRONIZADO' for r in resultados)
        if hay_desincronizados:
            mostrar_desincronizados()
            print(f"\n💡 Ejecuta 'actualizar_ultimo_mensaje_sql.py' para corregir la sincronización.")
        else:
            print(f"\n🎉 ¡Todos los campos último mensaje están correctamente sincronizados!")
            
    except Exception as e:
        print(f"❌ Error durante la verificación: {str(e)}")
        raise


if __name__ == "__main__":
    main()