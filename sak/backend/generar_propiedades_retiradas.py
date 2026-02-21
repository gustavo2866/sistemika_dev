#!/usr/bin/env python3
"""
Script para crear propiedades aleatorias de ALQUILER con estado final RETIRADA.
Las propiedades se crean en estado "Recibida" y luego se mueven a "Retirada" 
simulando propiedades que fueron retiradas del mercado.
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
CANTIDAD_PROPIEDADES = 10
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
    """Genera datos aleatorios para una propiedad de ALQUILER."""
    tipo_propiedad_ids = [1, 2, 3, 4, 5, 9, 10, 11]  # IDs válidos de tipos
    tipo_operacion_id = 1  # SIEMPRE Alquiler
    
    # Generar datos básicos
    nombre = choice(NOMBRES_BASE) + f" RETIRADA {randint(100, 999)}"
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

def crear_propiedad_retirada(db, datos_propiedad, usuario_id=USER_ID):
    """
    Crea una propiedad con flujo de estados: Recibida → Retirada
    """
    fecha_recibida = date.today() - timedelta(days=randint(30, 90))  # Más tiempo atrás
    fecha_retirada = fecha_recibida + timedelta(days=randint(15, 45))  # Retirada después
    
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
    
    # 3. Cambiar a estado RETIRADA (ID: 5)
    update_query = text("""
        UPDATE propiedades 
        SET propiedad_status_id = 5,
            estado_fecha = :fecha_retirada,
            estado_comentario = 'Propiedad retirada del mercado',
            version = version + 1,
            updated_at = NOW()
        WHERE id = :propiedad_id
    """)
    
    db.execute(update_query, {
        'fecha_retirada': fecha_retirada,
        'propiedad_id': propiedad_id
    })
    
    # 4. Crear log del cambio a RETIRADA
    log_retirada_query = text("""
        INSERT INTO propiedades_log_status (
            propiedad_id, estado_anterior_id, estado_nuevo_id,
            estado_anterior, estado_nuevo, fecha_cambio, usuario_id,
            motivo, observaciones, version, created_at, updated_at
        ) VALUES (
            :propiedad_id, 1, 5,
            'Recibida', 'Retirada', :fecha_cambio, :usuario_id,
            'Propiedad retirada del mercado', 'El propietario decidió retirar la propiedad',
            1, NOW(), NOW()
        )
    """)
    
    db.execute(log_retirada_query, {
        'propiedad_id': propiedad_id,
        'fecha_cambio': datetime.combine(fecha_retirada, datetime.min.time()).replace(tzinfo=UTC),
        'usuario_id': usuario_id
    })
    
    return propiedad_id, datos_propiedad['nombre'], 'Retirada'

def main():
    """Función principal del script."""
    
    global USER_ID
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("=== GENERACIÓN DE PROPIEDADES DE ALQUILER - ESTADO RETIRADA ===\n")
        
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
        
        print(f"\n🎯 Generando {CANTIDAD_PROPIEDADES} propiedades de ALQUILER en estado RETIRADA...\n")
        
        propiedades_creadas = []
        
        for i in range(CANTIDAD_PROPIEDADES):
            # Generar datos de la propiedad
            datos = generar_datos_propiedad()
            
            # Crear propiedad con flujo Recibida → Retirada
            propiedad_id, nombre, estado_nombre = crear_propiedad_retirada(db, datos, USER_ID)
            
            propiedades_creadas.append({
                'id': propiedad_id,
                'nombre': nombre,
                'estado': estado_nombre,
                'valor_alquiler': datos['valor_alquiler']
            })
            
            print(f"✓ [{i+1:2d}] ID {propiedad_id:3d}: {nombre:<45} | Estado: {estado_nombre}")
        
        # Confirmar cambios
        db.commit()
        
        print(f"\n=== RESUMEN DE CREACIÓN ===")
        print(f"Total de propiedades creadas: {len(propiedades_creadas)}")
        print(f"Todas en estado: RETIRADA")
        print(f"Todas de tipo operación: ALQUILER")
        
        # Verificar consistencia
        print(f"\n=== VERIFICACIÓN DE CONSISTENCIA ===")
        
        # Verificar que todas tienen vacancia_activa=true y vacancia_fecha
        ids_creadas = tuple(prop['id'] for prop in propiedades_creadas)
        verificacion_query = text("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN vacancia_activa = true THEN 1 END) as con_vacancia_activa,
                COUNT(CASE WHEN vacancia_fecha IS NOT NULL THEN 1 END) as con_fecha_vacancia,
                COUNT(CASE WHEN propiedad_status_id = 5 THEN 1 END) as en_estado_retirada
            FROM propiedades 
            WHERE id IN :ids
        """)
        
        result = db.execute(verificacion_query, {'ids': ids_creadas})
        stats = result.fetchone()
        
        print(f"✓ Propiedades con vacancia_activa=true: {stats.con_vacancia_activa}/{stats.total}")
        print(f"✓ Propiedades con vacancia_fecha: {stats.con_fecha_vacancia}/{stats.total}")
        print(f"✓ Propiedades en estado RETIRADA: {stats.en_estado_retirada}/{stats.total}")
        
        # Verificar logs de estado (cada propiedad debe tener 2 logs)
        logs_query = text("""
            SELECT COUNT(*) as total_logs
            FROM propiedades_log_status 
            WHERE propiedad_id IN :ids
        """)
        
        result = db.execute(logs_query, {'ids': ids_creadas})
        logs_count = result.fetchone().total_logs
        
        expected_logs = len(propiedades_creadas) * 2  # 2 logs por propiedad
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