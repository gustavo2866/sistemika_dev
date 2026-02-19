#!/usr/bin/env python3
"""
Script para actualizar los nuevos campos de propiedades basándose en datos existentes.

Actualiza:
- propiedad_status_id: Mapea el campo 'estado' string a FK de propiedades_status
- vacancia_activa: Basado en la tabla vacancias (ciclo_activo = true)
- vacancia_fecha: Fecha más reciente de la vacancia activa

Uso:
    python scripts/update_propiedades_new_fields.py          # Ejecutar actualizaciones
    python scripts/update_propiedades_new_fields.py --dry-run  # Solo mostrar qué haría
"""

import os
import argparse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def get_database_connection():
    """Obtiene la conexión a la base de datos."""
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise Exception('DATABASE_URL no encontrado en .env')
    return create_engine(DATABASE_URL)

def mapear_estados_string_a_id(engine):
    """Crea mapeo entre estados string y IDs de propiedades_status."""
    with engine.connect() as conn:
        result = conn.execute(text('SELECT id, nombre FROM propiedades_status'))
        estados_status = {row[1].lower(): row[0] for row in result.fetchall()}
    
    # Mapeo de estados string a nombres en propiedades_status
    mapeo_estados = {
        '1-recibida': 'recibida',
        '2-en_reparacion': 'en reparación', 
        '3-disponible': 'disponible',
        '4-alquilada': 'realizada',  # Alquilada se mapea a Realizada
        '4-realizada': 'realizada',
        '5-retirada': 'retirada',
        'activa': 'disponible'  # Activa se mapea a Disponible
    }
    
    # Convertir a IDs
    mapeo_final = {}
    for estado_string, estado_nombre in mapeo_estados.items():
        if estado_nombre in estados_status:
            mapeo_final[estado_string] = estados_status[estado_nombre]
        else:
            print(f"⚠️  Estado '{estado_nombre}' no encontrado en propiedades_status")
    
    return mapeo_final

def actualizar_propiedad_status_id(engine, mapeo_estados, dry_run=False):
    """Actualiza el campo propiedad_status_id basándose en el campo estado string."""
    
    with engine.connect() as conn:
        # Obtener propiedades que necesitan actualización
        result = conn.execute(text("""
            SELECT id, estado, propiedad_status_id, nombre
            FROM propiedades 
            WHERE propiedad_status_id IS NULL
            ORDER BY id
        """))
        
        propiedades = result.fetchall()
        
        print(f"🔄 Actualizando propiedad_status_id para {len(propiedades)} propiedades...")
        
        actualizaciones = 0
        errores = 0
        
        for prop_id, estado_actual, status_id_actual, nombre in propiedades:
            if estado_actual in mapeo_estados:
                nuevo_status_id = mapeo_estados[estado_actual]
                
                if dry_run:
                    print(f"   [DRY-RUN] ID {prop_id} ({nombre}): '{estado_actual}' → status_id = {nuevo_status_id}")
                else:
                    try:
                        conn.execute(text("""
                            UPDATE propiedades 
                            SET propiedad_status_id = :status_id, updated_at = NOW()
                            WHERE id = :prop_id
                        """), {"status_id": nuevo_status_id, "prop_id": prop_id})
                        
                        print(f"   ✅ ID {prop_id} ({nombre}): '{estado_actual}' → status_id = {nuevo_status_id}")
                        actualizaciones += 1
                    except Exception as e:
                        print(f"   ❌ Error actualizando ID {prop_id}: {e}")
                        errores += 1
            else:
                print(f"   ⚠️  ID {prop_id} ({nombre}): Estado '{estado_actual}' no mapeado")
                errores += 1
        
        if not dry_run and actualizaciones > 0:
            conn.commit()
        
        print(f"   📊 Resultado: {actualizaciones} actualizadas, {errores} errores")

def actualizar_campos_vacancia(engine, dry_run=False):
    """Actualiza los campos vacancia_activa y vacancia_fecha basándose en la tabla vacancias."""
    
    with engine.connect() as conn:
        # Primero, resetear todos los campos de vacancia
        if not dry_run:
            conn.execute(text("""
                UPDATE propiedades 
                SET vacancia_activa = false, vacancia_fecha = NULL, updated_at = NOW()
                WHERE vacancia_activa = true OR vacancia_fecha IS NOT NULL
            """))
        
        # Obtener propiedades con vacancias activas
        result = conn.execute(text("""
            SELECT DISTINCT 
                p.id,
                p.nombre,
                v.propiedad_id,
                v.ciclo_activo,
                COALESCE(v.fecha_disponible, v.fecha_en_reparacion, v.fecha_recibida) as fecha_vacancia
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
            ORDER BY p.id
        """))
        
        propiedades_con_vacancia = result.fetchall()
        
        print(f"🔄 Actualizando campos de vacancia para {len(propiedades_con_vacancia)} propiedades...")
        
        actualizaciones = 0
        
        for prop_id, nombre, _, ciclo_activo, fecha_vacancia in propiedades_con_vacancia:
            if dry_run:
                print(f"   [DRY-RUN] ID {prop_id} ({nombre}): vacancia_activa = true, fecha = {fecha_vacancia}")
            else:
                try:
                    conn.execute(text("""
                        UPDATE propiedades 
                        SET vacancia_activa = true, 
                            vacancia_fecha = :fecha_vacancia,
                            updated_at = NOW()
                        WHERE id = :prop_id
                    """), {"fecha_vacancia": fecha_vacancia, "prop_id": prop_id})
                    
                    print(f"   ✅ ID {prop_id} ({nombre}): vacancia_activa = true, fecha = {fecha_vacancia}")
                    actualizaciones += 1
                except Exception as e:
                    print(f"   ❌ Error actualizando ID {prop_id}: {e}")
        
        if not dry_run and actualizaciones > 0:
            conn.commit()
        
        print(f"   📊 Resultado: {actualizaciones} propiedades con vacancia activa")

def mostrar_resumen_final(engine):
    """Muestra un resumen de los datos actualizados."""
    with engine.connect() as conn:
        print("\\n📊 RESUMEN FINAL:")
        
        # Estados por status_id
        result = conn.execute(text("""
            SELECT ps.nombre, COUNT(*) as cantidad
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            GROUP BY ps.nombre, ps.orden
            ORDER BY ps.orden
        """))
        
        print("   Estados por propiedades_status:")
        for nombre, cantidad in result.fetchall():
            estado_name = nombre if nombre else "Sin estado asignado"
            print(f"   - {estado_name}: {cantidad} propiedades")
        
        # Vacancias activas
        result = conn.execute(text("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN vacancia_activa = true THEN 1 ELSE 0 END) as con_vacancia_activa
            FROM propiedades
        """))
        
        total, con_vacancia = result.fetchone()
        print(f"\\n   Vacancias:")
        print(f"   - Total propiedades: {total}")
        print(f"   - Con vacancia activa: {con_vacancia}")
        print(f"   - Sin vacancia: {total - con_vacancia}")

def main():
    parser = argparse.ArgumentParser(description='Actualizar campos nuevos de propiedades')
    parser.add_argument('--dry-run', action='store_true', help='Solo mostrar qué se haría, no ejecutar')
    args = parser.parse_args()

    try:
        engine = get_database_connection()
        
        if args.dry_run:
            print("🔍 MODO DRY-RUN - No se realizarán cambios en la base de datos\\n")
        else:
            print("🚀 MODO EJECUCIÓN - Se actualizarán los datos en la base de datos\\n")
        
        # 1. Actualizar propiedad_status_id
        mapeo_estados = mapear_estados_string_a_id(engine)
        print("🗺️  Mapeo de estados:")
        for estado_string, status_id in mapeo_estados.items():
            print(f"   '{estado_string}' → status_id = {status_id}")
        print()
        
        actualizar_propiedad_status_id(engine, mapeo_estados, args.dry_run)
        print()
        
        # 2. Actualizar campos de vacancia
        actualizar_campos_vacancia(engine, args.dry_run)
        
        # 3. Mostrar resumen
        if not args.dry_run:
            mostrar_resumen_final(engine)
        
        if args.dry_run:
            print("\\n💡 Para ejecutar los cambios, ejecutar sin --dry-run")
        else:
            print("\\n✅ Actualización completada exitosamente")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()