#!/usr/bin/env python3
"""
Script para crear propiedades aleatorias con estados específicos y movimientos de estado.
Las propiedades se crean inicialmente en estado "Recibida" y luego se mueven a 
"En Reparación" o "Disponible" según corresponda.
"""
import os
import sys
from datetime import date, timedelta, datetime, UTC
from random import randint, choice, uniform
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Obtener DATABASE_URL del entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

# Ajustar URL si es necesario
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")

# Configuración de generación
CANTIDAD_PROPIEDADES = 15
USER_ID = 12  # Usuario existente para los logs

# Datos para generar propiedades
NOMBRES_BASE = [
    "Depto Palermo", "Casa Belgrano", "PH Villa Crick", "Terreno Tigre",
    "Cochera Centro", "Depósito Flores", "Oficina Microcentro", "Local Caballito",
    "Torre Puerto Madero", "Complejo Nuñez", "Casa Villa Urquiza", "Depto Barracas",
    "Local San Telmo", "Oficina Retiro", "Depósito Villa Soldati", "Cochera Recoleta",
    "PH San Isidro", "Terreno Zona Norte", "Casa Mataderos", "Depto Colegiales"
]

PROPIETARIOS = [
    "Rodriguez SA", "Inversiones del Sur", "Grupo Inmobiliario Norte", "Capital Partners",
    "Desarrollos Urbanos", "Inmobiliaria Austral", "Constructora Central", "Fondo Inmobiliario",
    "Propiedades Premium", "Inversores Unidos", "Patrimonio SRL", "Real Estate Group",
    "Bienes Raíces SA", "Administradora de Propiedades", "Inversiones Metropolitanas"
]

def generar_datos_propiedad():
    """Genera datos aleatorios para una propiedad."""
    tipo_propiedad_ids = [1, 2, 3, 4, 5, 9, 10, 11]  # IDs válidos de tipos
    tipo_operacion_id = 1  # SIEMPRE Alquiler
    
    # Generar datos básicos
    nombre = choice(NOMBRES_BASE) + f" {randint(100, 999)}"
    propietario = choice(PROPIETARIOS)
    tipo_propiedad_id = choice(tipo_propiedad_ids)
    
    # Características físicas
    ambientes = randint(1, 6) if randint(0, 100) < 80 else None
    metros_cuadrados = round(uniform(25, 150), 2) if randint(0, 100) < 90 else None
    
    # Datos económicos - SIEMPRE para alquiler
    valor_alquiler = round(uniform(50000, 400000), 2)
    expensas = round(uniform(10000, 80000), 2) if randint(0, 100) < 70 else None
    
    return {
        'nombre': nombre,
        'propietario': propietario,
        'tipo_propiedad_id': tipo_propiedad_id,
        'tipo_operacion_id': tipo_operacion_id,
        'ambientes': ambientes,
        'metros_cuadrados': metros_cuadrados,
        'valor_alquiler': valor_alquiler,
        'expensas': expensas
    }

def crear_propiedad_con_estados(db, datos_propiedad, estado_final_id, usuario_id=USER_ID):
    """
    Crea una propiedad con estado inicial 'Recibida' y la mueve al estado final.
    """
    fecha_recibida = date.today() - timedelta(days=randint(1, 30))
    fecha_cambio = fecha_recibida + timedelta(days=randint(1, 15))
    
    # 1. Crear la propiedad en estado inicial (Recibida)
    insert_query = text("""
        INSERT INTO propiedades (
            nombre, tipo, propietario, tipo_propiedad_id, tipo_operacion_id,
            ambientes, metros_cuadrados, valor_alquiler, expensas,
            propiedad_status_id, estado_fecha, estado_comentario,
            vacancia_activa, vacancia_fecha, fecha_ingreso,
            version, created_at, updated_at
        ) VALUES (
            :nombre, 'Propiedad', :propietario, :tipo_propiedad_id, :tipo_operacion_id,
            :ambientes, :metros_cuadrados, :valor_alquiler, :expensas,
            1, :fecha_recibida, 'Propiedad recibida en el sistema',
            true, :fecha_recibida, :fecha_recibida,
            1, NOW(), NOW()
        ) RETURNING id
    """)
    
    result = db.execute(insert_query, {
        **datos_propiedad,
        'fecha_recibida': fecha_recibida
    })
    
    propiedad_id = result.fetchone()[0]
    
    # 2. Crear log del estado inicial (Recibida)
    log_inicial_query = text("""
        INSERT INTO propiedades_log_status (
            propiedad_id, estado_anterior_id, estado_nuevo_id,
            estado_anterior, estado_nuevo, fecha_cambio, usuario_id,
            motivo, observaciones, version, created_at, updated_at
        ) VALUES (
            :propiedad_id, NULL, 1,
            NULL, 'Recibida', :fecha_cambio, :usuario_id,
            'Estado inicial al crear la propiedad', 'Propiedad ingresada al sistema',
            1, NOW(), NOW()
        )
    """)
    
    db.execute(log_inicial_query, {
        'propiedad_id': propiedad_id,
        'fecha_cambio': datetime.combine(fecha_recibida, datetime.min.time()).replace(tzinfo=UTC),
        'usuario_id': usuario_id
    })
    
    # 3. Si el estado final no es "Recibida", hacer el cambio de estado
    if estado_final_id != 1:
        # Obtener nombre del estado final
        estado_query = text("SELECT nombre FROM propiedades_status WHERE id = :estado_id")
        estado_result = db.execute(estado_query, {'estado_id': estado_final_id})
        estado_nombre = estado_result.fetchone()[0]
        
        # Actualizar el estado de la propiedad
        update_query = text("""
            UPDATE propiedades 
            SET propiedad_status_id = :estado_final_id,
                estado_fecha = :fecha_cambio,
                estado_comentario = :comentario,
                version = version + 1,
                updated_at = NOW()
            WHERE id = :propiedad_id
        """)
        
        comentario = f"Movida a estado {estado_nombre}"
        if estado_final_id == 2:  # En Reparación
            comentario += " - Requiere mantenimiento"
        elif estado_final_id == 3:  # Disponible
            comentario += " - Lista para operación"
            
        db.execute(update_query, {
            'estado_final_id': estado_final_id,
            'fecha_cambio': fecha_cambio,
            'comentario': comentario,
            'propiedad_id': propiedad_id
        })
        
        # Crear log del cambio de estado
        log_cambio_query = text("""
            INSERT INTO propiedades_log_status (
                propiedad_id, estado_anterior_id, estado_nuevo_id,
                estado_anterior, estado_nuevo, fecha_cambio, usuario_id,
                motivo, observaciones, version, created_at, updated_at
            ) VALUES (
                :propiedad_id, 1, :estado_final_id,
                'Recibida', :estado_nombre, :fecha_cambio, :usuario_id,
                :motivo, :observaciones, 1, NOW(), NOW()
            )
        """)
        
        motivo = "Cambio automático de estado"
        if estado_final_id == 2:
            observaciones = "La propiedad requiere reparaciones antes de estar disponible"
        else:
            observaciones = "La propiedad está lista y disponible para operaciones"
        
        db.execute(log_cambio_query, {
            'propiedad_id': propiedad_id,
            'estado_final_id': estado_final_id,
            'estado_nombre': estado_nombre,
            'fecha_cambio': datetime.combine(fecha_cambio, datetime.min.time()).replace(tzinfo=UTC),
            'usuario_id': usuario_id,
            'motivo': motivo,
            'observaciones': observaciones
        })
    
    return propiedad_id, datos_propiedad['nombre'], estado_nombre if estado_final_id != 1 else 'Recibida'

def main():
    """Función principal del script."""
    
    global USER_ID
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("=== GENERACIÓN DE PROPIEDADES ALEATORIAS ===\n")
        
        # Verificar usuario existe
        user_check = db.execute(text("SELECT id, nombre FROM users WHERE id = :user_id"), {'user_id': USER_ID})
        user = user_check.fetchone()
        if not user:
            print(f"❌ Usuario con ID {USER_ID} no existe. Usando usuario existente...")
            # Obtener primer usuario disponible
            first_user = db.execute(text("SELECT id, nombre FROM users ORDER BY id LIMIT 1")).fetchone()
            if first_user:
                USER_ID = first_user.id
                print(f"✓ Usando usuario: {first_user.nombre} (ID: {first_user.id})")
            else:
                print("❌ No hay usuarios en el sistema")
                return 1
        else:
            print(f"✓ Usuario: {user.nombre} (ID: {user.id})")
        
        print(f"\n🎯 Generando {CANTIDAD_PROPIEDADES} propiedades aleatorias...\n")
        
        # Estados objetivo: Recibida(1), En Reparación(2), Disponible(3)
        estados_objetivo = [1, 2, 3]
        propiedades_creadas = []
        
        for i in range(CANTIDAD_PROPIEDADES):
            # Seleccionar estado final aleatoriamente
            estado_final = choice(estados_objetivo)
            
            # Generar datos de la propiedad
            datos = generar_datos_propiedad()
            
            # Crear propiedad con movimiento de estado
            propiedad_id, nombre, estado_nombre = crear_propiedad_con_estados(
                db, datos, estado_final, USER_ID
            )
            
            propiedades_creadas.append({
                'id': propiedad_id,
                'nombre': nombre,
                'estado': estado_nombre,
                'tipo': datos['tipo_propiedad_id'],
                'operacion': datos['tipo_operacion_id']
            })
            
            print(f"✓ [{i+1:2d}] ID {propiedad_id:3d}: {nombre:<30} | Estado: {estado_nombre}")
        
        # Confirmar cambios
        db.commit()
        
        print(f"\n=== RESUMEN DE CREACIÓN ===")
        print(f"Total de propiedades creadas: {len(propiedades_creadas)}")
        
        # Contar por estado
        estados_count = {}
        for prop in propiedades_creadas:
            estado = prop['estado']
            estados_count[estado] = estados_count.get(estado, 0) + 1
        
        print("\nDistribución por estado:")
        for estado, count in estados_count.items():
            print(f"  - {estado}: {count} propiedades")
        
        # Verificar consistencia
        print(f"\n=== VERIFICACIÓN DE CONSISTENCIA ===")
        
        # Verificar que todas tienen vacancia_activa=true y vacancia_fecha
        verificacion_query = text("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN vacancia_activa = true THEN 1 END) as con_vacancia_activa,
                COUNT(CASE WHEN vacancia_fecha IS NOT NULL THEN 1 END) as con_vacancia_fecha
            FROM propiedades 
            WHERE id IN :ids
        """)
        
        ids_creadas = tuple(prop['id'] for prop in propiedades_creadas)
        result = db.execute(verificacion_query, {'ids': ids_creadas})
        stats = result.fetchone()
        
        print(f"✓ Propiedades con vacancia_activa=true: {stats.con_vacancia_activa}/{stats.total}")
        print(f"✓ Propiedades con vacancia_fecha: {stats.con_vacancia_fecha}/{stats.total}")
        
        # Verificar logs de estado
        logs_query = text("""
            SELECT COUNT(*) as total_logs
            FROM propiedades_log_status 
            WHERE propiedad_id IN :ids
        """)
        
        result = db.execute(logs_query, {'ids': ids_creadas})
        logs_count = result.fetchone().total_logs
        
        expected_logs = len(propiedades_creadas) + sum(1 for p in propiedades_creadas if p['estado'] != 'Recibida')
        print(f"✓ Logs de estado generados: {logs_count} (esperados: {expected_logs})")
        
        print(f"\n🎉 ¡Generación completada exitosamente!")
        
    except Exception as e:
        print(f"❌ Error durante la generación: {str(e)}")
        db.rollback()
        return 1
        
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())