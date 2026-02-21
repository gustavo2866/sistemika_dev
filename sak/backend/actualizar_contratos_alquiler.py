#!/usr/bin/env python3
"""
Script para actualizar propiedades con tipo operación 'alquiler' y estado 'realizada'
para que tengan fechas de inicio y fin de contrato.
"""
import os
import sys
from datetime import date, timedelta
from random import randint
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

def main():
    """Función principal del script."""
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Primero, verifiquemos la estructura de la tabla y los datos actuales
        print("=== ANÁLISIS DE DATOS ACTUALES ===")
        
        # Verificar los tipos de operación existentes
        result = db.execute(text("""
            SELECT id, nombre FROM crm_tipos_operacion ORDER BY id
        """))
        tipos_operacion = result.fetchall()
        print("\nTipos de operación disponibles:")
        for tipo in tipos_operacion:
            print(f"  - ID {tipo.id}: {tipo.nombre}")
        
        # Verificar los estados existentes
        result = db.execute(text("""
            SELECT id, nombre FROM propiedades_status ORDER BY orden
        """))
        estados = result.fetchall()
        print("\nEstados disponibles:")
        for estado in estados:
            print(f"  - ID {estado.id}: {estado.nombre}")
        
        # Encontrar propiedades con tipo operación alquiler y estado realizada
        query = text("""
            SELECT 
                p.id,
                p.nombre,
                p.propiedad_status_id,
                ps.nombre as estado_nombre,
                p.tipo_operacion_id,
                tol.nombre as tipo_operacion_nombre,
                p.fecha_ingreso,
                p.vencimiento_contrato,
                p.valor_alquiler
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN crm_tipos_operacion tol ON p.tipo_operacion_id = tol.id
            WHERE tol.nombre ILIKE '%alquiler%' 
            AND ps.nombre ILIKE '%realizada%'
        """)
        
        result = db.execute(query)
        propiedades_target = result.fetchall()
        
        print(f"\n=== PROPIEDADES ENCONTRADAS: {len(propiedades_target)} ===")
        
        if not propiedades_target:
            print("No se encontraron propiedades con tipo 'alquiler' y estado 'realizada'")
            
            # Mostrar una consulta más amplia para debug
            print("\nBuscando patrones similares...")
            query_debug = text("""
                SELECT 
                    p.id,
                    p.nombre,
                    ps.nombre as estado_nombre,
                    tol.nombre as tipo_operacion_nombre,
                    p.fecha_ingreso,
                    p.vencimiento_contrato
                FROM propiedades p
                LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
                LEFT JOIN crm_tipos_operacion tol ON p.tipo_operacion_id = tol.id
                WHERE (tol.nombre IS NOT NULL OR ps.nombre IS NOT NULL)
                LIMIT 10
            """)
            result_debug = db.execute(query_debug)
            propiedades_debug = result_debug.fetchall()
            
            print("Ejemplos de propiedades existentes:")
            for prop in propiedades_debug:
                print(f"  - ID {prop.id}: {prop.nombre} | Tipo: {prop.tipo_operacion_nombre} | Estado: {prop.estado_nombre}")
            
            return
        
        # Mostrar las propiedades encontradas
        propiedades_sin_fechas = []
        for prop in propiedades_target:
            print(f"\nID {prop.id}: {prop.nombre}")
            print(f"  Estado: {prop.estado_nombre}")
            print(f"  Tipo operación: {prop.tipo_operacion_nombre}")
            print(f"  Fecha ingreso: {prop.fecha_ingreso}")
            print(f"  Vencimiento contrato: {prop.vencimiento_contrato}")
            print(f"  Valor alquiler: {prop.valor_alquiler}")
            
            # Verificar si necesita actualización
            if not prop.fecha_ingreso or not prop.vencimiento_contrato:
                propiedades_sin_fechas.append(prop)
        
        print(f"\n=== PROPIEDADES QUE NECESITAN ACTUALIZACIÓN: {len(propiedades_sin_fechas)} ===")
        
        if not propiedades_sin_fechas:
            print("Todas las propiedades ya tienen fechas de contrato definidas.")
            return
        
        # Pedir confirmación para actualizar
        print("\nLas siguientes propiedades serán actualizadas con fechas de contrato:")
        for prop in propiedades_sin_fechas:
            fecha_falta = []
            if not prop.fecha_ingreso:
                fecha_falta.append("fecha_ingreso")
            if not prop.vencimiento_contrato:
                fecha_falta.append("vencimiento_contrato")
            print(f"  - {prop.nombre} (falta: {', '.join(fecha_falta)})")
        
        respuesta = input("\n¿Desea continuar con la actualización? (s/N): ").lower().strip()
        if respuesta != 's':
            print("Operación cancelada.")
            return
        
        # Actualizar las propiedades
        print("\n=== ACTUALIZANDO PROPIEDADES ===")
        actualizadas = 0
        
        for prop in propiedades_sin_fechas:
            try:
                # Generar fechas lógicas para el contrato
                fecha_inicio = prop.fecha_ingreso
                fecha_vencimiento = prop.vencimiento_contrato
                
                # Si no tiene fecha de ingreso, usar una fecha reciente aleatoria
                if not fecha_inicio:
                    # Generar fecha entre 6 meses y 2 años atrás
                    dias_atras = randint(180, 730)
                    fecha_inicio = date.today() - timedelta(days=dias_atras)
                
                # Si no tiene fecha de vencimiento, usar fecha inicio + duración típica
                if not fecha_vencimiento:
                    # Contratos típicos de 12 a 24 meses
                    meses_contrato = randint(12, 24)
                    dias_contrato = meses_contrato * 30  # Aproximación
                    fecha_vencimiento = fecha_inicio + timedelta(days=dias_contrato)
                
                # Actualizar en la base de datos
                update_query = text("""
                    UPDATE propiedades 
                    SET 
                        fecha_ingreso = :fecha_inicio,
                        vencimiento_contrato = :fecha_vencimiento
                    WHERE id = :propiedad_id
                """)
                
                db.execute(update_query, {
                    'fecha_inicio': fecha_inicio,
                    'fecha_vencimiento': fecha_vencimiento,
                    'propiedad_id': prop.id
                })
                
                print(f"✓ Actualizada {prop.nombre}:")
                print(f"    Fecha inicio: {fecha_inicio}")
                print(f"    Fecha vencimiento: {fecha_vencimiento}")
                
                actualizadas += 1
                
            except Exception as e:
                print(f"✗ Error actualizando {prop.nombre}: {str(e)}")
                continue
        
        # Confirmar cambios
        db.commit()
        print(f"\n=== RESUMEN ===")
        print(f"Propiedades actualizadas: {actualizadas}")
        print("Cambios guardados exitosamente.")
        
    except Exception as e:
        print(f"Error durante la ejecución: {str(e)}")
        db.rollback()
        return 1
        
    finally:
        db.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())