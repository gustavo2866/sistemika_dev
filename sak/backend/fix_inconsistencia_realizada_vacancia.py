"""
Script para corregir inconsistencia: propiedades 'realizada' con vacancia activa.

Acciones:
1. Actualizar vacancia_activa = false en propiedades
2. Cerrar ciclo activo en vacancias (ciclo_activo = false)
3. Establecer fecha_alquilada = fecha del estado 'realizada'
"""

import os
from sqlalchemy import create_engine, text
from sqlmodel import Session
from dotenv import load_dotenv
from datetime import datetime

# Cargar variables de entorno
load_dotenv()

os.environ.setdefault("PGCLIENTENCODING", "LATIN1")

DATABASE_URL = os.getenv("DATABASE_URL")


def main() -> None:
    print("Corrigiendo inconsistencia: propiedades 'realizada' con vacancia activa")
    print("=" * 70)

    if not DATABASE_URL:
        print("Error: DATABASE_URL no configurada")
        return

    try:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"options": "-c client_encoding=LATIN1"},
        )
    except Exception as exc:
        print(f"Error conectando a base de datos: {exc}")
        return

    try:
        with Session(engine) as session:
            # Primero identificar los registros problemáticos
            query_identificar = """
            SELECT 
                p.id,
                p.nombre,
                p.estado_fecha,
                v.id as vacancia_id
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada' 
            AND p.vacancia_activa = true
            ORDER BY p.id;
            """
            
            result = session.execute(text(query_identificar))
            registros = result.fetchall()
            
            if not registros:
                print("No se encontraron registros para corregir.")
                return
            
            print(f"Se encontraron {len(registros)} registros para corregir:")
            for reg in registros:
                print(f"  - Propiedad ID: {reg.id}, Nombre: {reg.nombre}")
                print(f"    Vacancia ID: {reg.vacancia_id}, Fecha estado: {reg.estado_fecha}")
            
            # Confirmar antes de proceder
            print("\n" + "="*50)
            print("ACCIONES A REALIZAR:")
            print("1. Actualizar vacancia_activa = false en propiedades")
            print("2. Cerrar ciclo activo en vacancias (ciclo_activo = false)")
            print("3. Establecer fecha_alquilada = fecha del estado realizada")
            print("="*50)
            
            respuesta = input("\n¿Proceder con la corrección? (si/no): ").lower().strip()
            if respuesta not in ['si', 's', 'yes', 'y']:
                print("Operación cancelada.")
                return
            
            # Ejecutar correcciones
            registros_actualizados = 0
            vacancias_cerradas = 0
            
            for reg in registros:
                try:
                    # 1. Actualizar vacancia_activa = false en propiedades
                    update_propiedad = """
                    UPDATE propiedades 
                    SET vacancia_activa = false,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :propiedad_id 
                    AND estado = '4-realizada' 
                    AND vacancia_activa = true;
                    """
                    
                    result_prop = session.execute(text(update_propiedad), {"propiedad_id": reg.id})
                    
                    if result_prop.rowcount > 0:
                        registros_actualizados += 1
                        print(f"✓ Propiedad {reg.id}: vacancia_activa = false")
                    
                    # 2. Cerrar ciclo en vacancias si existe
                    if reg.vacancia_id:
                        update_vacancia = """
                        UPDATE vacancias 
                        SET ciclo_activo = false,
                            fecha_alquilada = :fecha_alquiler,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :vacancia_id 
                        AND ciclo_activo = true;
                        """
                        
                        result_vac = session.execute(text(update_vacancia), {
                            "vacancia_id": reg.vacancia_id,
                            "fecha_alquiler": reg.estado_fecha
                        })
                        
                        if result_vac.rowcount > 0:
                            vacancias_cerradas += 1
                            print(f"✓ Vacancia {reg.vacancia_id}: ciclo cerrado, fecha_alquilada = {reg.estado_fecha}")
                
                except Exception as e:
                    print(f"✗ Error procesando propiedad {reg.id}: {e}")
                    session.rollback()
                    raise
            
            # Confirmar cambios
            session.commit()
            
            print("\n" + "="*50)
            print("CORRECCIÓN COMPLETADA:")
            print(f"- Propiedades actualizadas: {registros_actualizados}")
            print(f"- Vacancias cerradas: {vacancias_cerradas}")
            print("="*50)
            
            # Verificar que no queden inconsistencias
            print("\nVerificando resultado...")
            result_check = session.execute(text("""
                SELECT COUNT(*) as restantes
                FROM propiedades 
                WHERE estado = '4-realizada' 
                AND vacancia_activa = true;
            """))
            
            restantes = result_check.fetchone().restantes
            if restantes == 0:
                print("✓ No quedan inconsistencias. Corrección exitosa.")
            else:
                print(f"⚠ Quedan {restantes} registros inconsistentes para revisar.")

    except Exception as e:
        print(f"Error durante la corrección: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()