#!/usr/bin/env python3
"""
Script para poblar propiedades_log_status basándose en registros de vacancias.

Reglas:
1. Para propiedades con vacancias: Crea registros basándose en las fechas de vacancia
2. Para propiedades sin vacancias: Crea al menos un registro inicial "Recibido"
3. Asegura consistencia: último estado del log = estado actual de la propiedad

Uso:
    python scripts/populate_propiedades_log_status.py          # Ejecutar poblado
    python scripts/populate_propiedades_log_status.py --dry-run  # Solo mostrar qué haría
    python scripts/populate_propiedades_log_status.py --clear   # Limpiar tabla antes de poblar
"""

import os
import argparse
from datetime import datetime, UTC
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def get_database_connection():
    """Obtiene la conexión a la base de datos."""
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise Exception('DATABASE_URL no encontrado en .env')
    return create_engine(DATABASE_URL)

def mapear_estados():
    """Mapea nombres de estados a IDs."""
    return {
        'recibida': 1,
        'en_reparacion': 2,
        'disponible': 3,
        'realizada': 4,  # Para alquilada
        'retirada': 5
    }

def limpiar_tabla_log(engine, dry_run=False):
    """Limpia la tabla propiedades_log_status."""
    with engine.connect() as conn:
        if not dry_run:
            conn.execute(text('DELETE FROM propiedades_log_status'))
            conn.commit()
            print("🧹 Tabla propiedades_log_status limpiada")
        else:
            result = conn.execute(text('SELECT COUNT(*) FROM propiedades_log_status'))
            count = result.fetchone()[0]
            print(f"[DRY-RUN] Se eliminarían {count} registros de propiedades_log_status")

def obtener_vacancias_por_propiedad(engine):
    """Obtiene todas las vacancias agrupadas por propiedad."""
    with engine.connect() as conn:
        result = conn.execute(text('''
            SELECT v.propiedad_id, v.ciclo_activo,
                   v.fecha_recibida, v.fecha_en_reparacion, v.fecha_disponible,
                   v.fecha_alquilada, v.fecha_retirada,
                   p.nombre, p.estado_fecha
            FROM vacancias v
            JOIN propiedades p ON v.propiedad_id = p.id
            ORDER BY v.propiedad_id, v.fecha_recibida
        '''))
        
        vacancias_por_propiedad = {}
        for row in result.fetchall():
            prop_id = row[0]
            if prop_id not in vacancias_por_propiedad:
                vacancias_por_propiedad[prop_id] = []
            vacancias_por_propiedad[prop_id].append({
                'ciclo_activo': row[1],
                'fecha_recibida': row[2],
                'fecha_en_reparacion': row[3], 
                'fecha_disponible': row[4],
                'fecha_alquilada': row[5],
                'fecha_retirada': row[6],
                'nombre_propiedad': row[7],
                'estado_fecha': row[8]
            })
        
        return vacancias_por_propiedad

def obtener_propiedades_sin_vacancias(engine):
    """Obtiene propiedades que no tienen registros de vacancia."""
    with engine.connect() as conn:
        result = conn.execute(text('''
            SELECT p.id, p.nombre, p.propiedad_status_id, ps.nombre as estado_nombre,
                   p.estado_fecha, p.fecha_ingreso, p.created_at
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.propiedad_id IS NULL
            ORDER BY p.id
        '''))
        
        return result.fetchall()

def crear_log_desde_vacancias(engine, vacancias_por_propiedad, estados_map, dry_run=False):
    """Crea registros de log basándose en las fechas de vacancia."""
    
    with engine.connect() as conn:
        logs_creados = 0
        
        for prop_id, vacancias in vacancias_por_propiedad.items():
            nombre_propiedad = vacancias[0]['nombre_propiedad']
            
            print(f"🏠 Procesando Propiedad {prop_id}: {nombre_propiedad}")
            
            # Procesar cada ciclo de vacancia
            for i, vacancia in enumerate(vacancias):
                print(f"   📋 Ciclo {i+1} (activo: {vacancia['ciclo_activo']})")
                
                # Lista de cambios de estado en orden cronológico
                cambios = []
                
                if vacancia['fecha_recibida']:
                    cambios.append({
                        'fecha': vacancia['fecha_recibida'],
                        'estado_nuevo_id': estados_map['recibida'],
                        'estado_nuevo': 'Recibida',
                        'estado_anterior_id': None,
                        'estado_anterior': None,
                        'motivo': 'Propiedad recibida en el sistema'
                    })
                
                if vacancia['fecha_en_reparacion']:
                    cambios.append({
                        'fecha': vacancia['fecha_en_reparacion'],
                        'estado_nuevo_id': estados_map['en_reparacion'],
                        'estado_nuevo': 'En Reparación',
                        'estado_anterior_id': estados_map['recibida'],
                        'estado_anterior': 'Recibida',
                        'motivo': 'Inicio de reparación/acondicionamiento'
                    })
                
                if vacancia['fecha_disponible']:
                    estado_anterior_id = estados_map['en_reparacion'] if vacancia['fecha_en_reparacion'] else estados_map['recibida']
                    estado_anterior_nombre = 'En Reparación' if vacancia['fecha_en_reparacion'] else 'Recibida'
                    
                    cambios.append({
                        'fecha': vacancia['fecha_disponible'],
                        'estado_nuevo_id': estados_map['disponible'],
                        'estado_nuevo': 'Disponible',
                        'estado_anterior_id': estado_anterior_id,
                        'estado_anterior': estado_anterior_nombre,
                        'motivo': 'Propiedad disponible para alquiler'
                    })
                
                if vacancia['fecha_alquilada']:
                    cambios.append({
                        'fecha': vacancia['fecha_alquilada'],
                        'estado_nuevo_id': estados_map['realizada'],
                        'estado_nuevo': 'Realizada',
                        'estado_anterior_id': estados_map['disponible'],
                        'estado_anterior': 'Disponible',
                        'motivo': 'Propiedad alquilada'
                    })
                
                if vacancia['fecha_retirada']:
                    estado_anterior_id = estados_map['disponible']
                    estado_anterior_nombre = 'Disponible'
                    if vacancia['fecha_alquilada']:
                        estado_anterior_id = estados_map['realizada']
                        estado_anterior_nombre = 'Realizada'
                    
                    cambios.append({
                        'fecha': vacancia['fecha_retirada'],
                        'estado_nuevo_id': estados_map['retirada'],
                        'estado_nuevo': 'Retirada',
                        'estado_anterior_id': estado_anterior_id,
                        'estado_anterior': estado_anterior_nombre,
                        'motivo': 'Propiedad retirada del sistema'
                    })
                
                # Insertar los cambios
                for cambio in cambios:
                    if dry_run:
                        print(f"     [DRY-RUN] {cambio['fecha']}: {cambio['estado_anterior'] or 'Inicial'} → {cambio['estado_nuevo']}")
                    else:
                        conn.execute(text('''
                            INSERT INTO propiedades_log_status 
                            (created_at, updated_at, version, propiedad_id, 
                             estado_anterior_id, estado_nuevo_id,
                             estado_anterior, estado_nuevo, fecha_cambio,
                             usuario_id, motivo)
                            VALUES (NOW(), NOW(), 1, :propiedad_id,
                                   :estado_anterior_id, :estado_nuevo_id,
                                   :estado_anterior, :estado_nuevo, :fecha_cambio,
                                   1, :motivo)
                        '''), {
                            'propiedad_id': prop_id,
                            'estado_anterior_id': cambio['estado_anterior_id'],
                            'estado_nuevo_id': cambio['estado_nuevo_id'],
                            'estado_anterior': cambio['estado_anterior'],
                            'estado_nuevo': cambio['estado_nuevo'],
                            'fecha_cambio': cambio['fecha'],
                            'motivo': cambio['motivo']
                        })
                        
                        print(f"     ✅ {cambio['fecha']}: {cambio['estado_anterior'] or 'Inicial'} → {cambio['estado_nuevo']}")
                        logs_creados += 1
        
        if not dry_run and logs_creados > 0:
            conn.commit()
        
        return logs_creados

def crear_log_propiedades_sin_vacancias(engine, propiedades_sin_vacancias, estados_map, dry_run=False):
    """Crea registros de log para propiedades sin vacancias."""
    
    with engine.connect() as conn:
        logs_creados = 0
        
        for prop_id, nombre, status_id, estado_nombre, estado_fecha, fecha_ingreso, created_at in propiedades_sin_vacancias:
            print(f"🏠 Propiedad SIN vacancias {prop_id}: {nombre}")
            
            # Usar fecha_ingreso o created_at como fecha inicial
            fecha_inicial = fecha_ingreso or created_at.date()
            
            # Crear registro inicial "Recibida"
            if dry_run:
                print(f"     [DRY-RUN] {fecha_inicial}: Inicial → Recibida")
            else:
                conn.execute(text('''
                    INSERT INTO propiedades_log_status 
                    (created_at, updated_at, version, propiedad_id, 
                     estado_anterior_id, estado_nuevo_id,
                     estado_anterior, estado_nuevo, fecha_cambio,
                     usuario_id, motivo)
                    VALUES (NOW(), NOW(), 1, :propiedad_id,
                           NULL, :estado_nuevo_id,
                           NULL, 'Recibida', :fecha_cambio,
                           1, 'Estado inicial de la propiedad')
                '''), {
                    'propiedad_id': prop_id,
                    'estado_nuevo_id': estados_map['recibida'],
                    'fecha_cambio': fecha_inicial
                })
                
                print(f"     ✅ {fecha_inicial}: Inicial → Recibida")
                logs_creados += 1
            
            # Si el estado actual no es "Recibida", crear registro adicional
            if status_id and status_id != estados_map['recibida']:
                fecha_cambio_estado = estado_fecha
                
                if dry_run:
                    print(f"     [DRY-RUN] {fecha_cambio_estado}: Recibida → {estado_nombre}")
                else:
                    conn.execute(text('''
                        INSERT INTO propiedades_log_status 
                        (created_at, updated_at, version, propiedad_id, 
                         estado_anterior_id, estado_nuevo_id,
                         estado_anterior, estado_nuevo, fecha_cambio,
                         usuario_id, motivo)
                        VALUES (NOW(), NOW(), 1, :propiedad_id,
                               :estado_anterior_id, :estado_nuevo_id,
                               'Recibida', :estado_nuevo, :fecha_cambio,
                               1, 'Cambio de estado registrado')
                    '''), {
                        'propiedad_id': prop_id,
                        'estado_anterior_id': estados_map['recibida'],
                        'estado_nuevo_id': status_id,
                        'estado_nuevo': estado_nombre,
                        'fecha_cambio': fecha_cambio_estado
                    })
                    
                    print(f"     ✅ {fecha_cambio_estado}: Recibida → {estado_nombre}")
                    logs_creados += 1
        
        if not dry_run and logs_creados > 0:
            conn.commit()
        
        return logs_creados

def verificar_consistencia(engine):
    """Verifica que el último estado del log coincida con el estado actual."""
    with engine.connect() as conn:
        result = conn.execute(text('''
            WITH ultimo_log AS (
                SELECT DISTINCT ON (propiedad_id) 
                    propiedad_id, estado_nuevo_id, estado_nuevo,
                    fecha_cambio
                FROM propiedades_log_status
                ORDER BY propiedad_id, fecha_cambio DESC, id DESC
            )
            SELECT p.id, p.nombre, p.propiedad_status_id, ps.nombre as estado_actual,
                   ul.estado_nuevo_id as ultimo_log_estado_id, ul.estado_nuevo as ultimo_log_estado
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN ultimo_log ul ON p.id = ul.propiedad_id
            WHERE p.propiedad_status_id != ul.estado_nuevo_id 
               OR ul.estado_nuevo_id IS NULL
            ORDER BY p.id
        '''))
        
        inconsistencias = result.fetchall()
        
        print("\\n🔍 VERIFICACIÓN DE CONSISTENCIA:")
        if inconsistencias:
            print(f"⚠️  Encontradas {len(inconsistencias)} inconsistencias:")
            for prop_id, nombre, estado_actual_id, estado_actual, ultimo_log_id, ultimo_log in inconsistencias:
                print(f"   • Propiedad {prop_id}: {nombre}")
                print(f"     Estado actual: {estado_actual} (ID {estado_actual_id})")
                print(f"     Último log: {ultimo_log or 'Sin registros'} (ID {ultimo_log_id or 'N/A'})")
        else:
            print("✅ Todos los estados son consistentes")
        
        return len(inconsistencias)

def mostrar_resumen(engine):
    """Muestra resumen final de los datos."""
    with engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM propiedades_log_status'))
        total_logs = result.fetchone()[0]
        
        result = conn.execute(text('SELECT COUNT(DISTINCT propiedad_id) FROM propiedades_log_status'))
        propiedades_con_logs = result.fetchone()[0]
        
        result = conn.execute(text('SELECT COUNT(*) FROM propiedades'))
        total_propiedades = result.fetchone()[0]
        
        print(f"\\n📊 RESUMEN FINAL:")
        print(f"   • Total de registros en log: {total_logs}")
        print(f"   • Propiedades con logs: {propiedades_con_logs}/{total_propiedades}")
        print(f"   • Propiedades sin logs: {total_propiedades - propiedades_con_logs}")

def main():
    parser = argparse.ArgumentParser(description='Poblar propiedades_log_status')
    parser.add_argument('--dry-run', action='store_true', help='Solo mostrar qué se haría')
    parser.add_argument('--clear', action='store_true', help='Limpiar tabla antes de poblar')
    args = parser.parse_args()

    try:
        engine = get_database_connection()
        estados_map = mapear_estados()
        
        if args.dry_run:
            print("🔍 MODO DRY-RUN - No se realizarán cambios\\n")
        else:
            print("🚀 MODO EJECUCIÓN - Se poblarán los datos\\n")
        
        # Limpiar tabla si se solicita
        if args.clear:
            limpiar_tabla_log(engine, args.dry_run)
            print()
        
        # Obtener datos
        vacancias_por_propiedad = obtener_vacancias_por_propiedad(engine)
        propiedades_sin_vacancias = obtener_propiedades_sin_vacancias(engine)
        
        print(f"📋 Datos encontrados:")
        print(f"   • Propiedades con vacancias: {len(vacancias_por_propiedad)}")
        print(f"   • Propiedades sin vacancias: {len(propiedades_sin_vacancias)}")
        print()
        
        # Crear logs desde vacancias
        if vacancias_por_propiedad:
            print("🔄 Creando logs desde vacancias...")
            logs_vacancias = crear_log_desde_vacancias(engine, vacancias_por_propiedad, estados_map, args.dry_run)
            print(f"   📊 Logs creados desde vacancias: {logs_vacancias}")
            print()
        
        # Crear logs para propiedades sin vacancias
        if propiedades_sin_vacancias:
            print("🔄 Creando logs para propiedades sin vacancias...")
            logs_sin_vacancias = crear_log_propiedades_sin_vacancias(engine, propiedades_sin_vacancias, estados_map, args.dry_run)
            print(f"   📊 Logs creados para propiedades sin vacancias: {logs_sin_vacancias}")
        
        # Verificar consistencia
        if not args.dry_run:
            inconsistencias = verificar_consistencia(engine)
            mostrar_resumen(engine)
        
        if args.dry_run:
            print("\\n💡 Para ejecutar los cambios, ejecutar sin --dry-run")
        else:
            print("\\n✅ Poblado completado exitosamente")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()