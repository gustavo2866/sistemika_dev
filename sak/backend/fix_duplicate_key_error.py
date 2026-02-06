#!/usr/bin/env python3
"""
Script para reparar el problema de ID=0 en po_solicitud_detalles

Este problema causa errores de clave duplicada al intentar insertar nuevos registros.
La solución es asignar un ID válido al registro problemático y ajustar la secuencia.
"""

from app.db import get_session
from sqlalchemy import text
import sys


def analyze_current_state(session):
    """Analiza el estado actual de la tabla y secuencia"""
    print("=== ESTADO ACTUAL ===")
    
    # Verificar registros con ID=0
    result = session.execute(text("SELECT COUNT(*) FROM po_solicitud_detalles WHERE id = 0"))
    zero_count = result.fetchone()[0]
    print(f"Registros con ID=0: {zero_count}")
    
    # Verificar MAX ID
    result = session.execute(text("SELECT MAX(id) FROM po_solicitud_detalles WHERE id > 0"))
    max_id = result.fetchone()[0]
    print(f"MAX ID válido en tabla: {max_id}")
    
    # Verificar secuencia
    result = session.execute(text("SELECT last_value, is_called FROM po_solicitud_detalles_id_seq"))
    last_value, is_called = result.fetchone()
    print(f"Secuencia - último valor: {last_value}, is_called: {is_called}")
    
    return zero_count, max_id, last_value


def fix_zero_id_record(session):
    """Actualiza el registro con ID=0 para que tenga un ID válido"""
    print("\n=== REPARANDO REGISTRO ID=0 ===")
    
    # Obtener el siguiente ID válido de la secuencia
    result = session.execute(text("SELECT nextval('po_solicitud_detalles_id_seq')"))
    new_id = result.fetchone()[0]
    print(f"Nuevo ID asignado desde secuencia: {new_id}")
    
    # Actualizar el registro
    result = session.execute(text("""
        UPDATE po_solicitud_detalles 
        SET id = :new_id 
        WHERE id = 0
    """), {"new_id": new_id})
    
    rows_affected = result.rowcount
    print(f"Registros actualizados: {rows_affected}")
    
    if rows_affected > 0:
        # Verificar que se actualizó correctamente
        result = session.execute(text("""
            SELECT id, solicitud_id, articulo_id 
            FROM po_solicitud_detalles 
            WHERE id = :new_id
        """), {"new_id": new_id})
        
        updated_record = result.fetchone()
        if updated_record:
            print(f"✅ Registro actualizado correctamente:")
            print(f"   ID: {updated_record[0]}, solicitud_id: {updated_record[1]}")
        
        # Commit los cambios
        session.commit()
        print("✅ Cambios guardados en la base de datos")
    
    return new_id


def verify_fix(session):
    """Verifica que la reparación fue exitosa"""
    print("\n=== VERIFICACIÓN ===")
    
    # Verificar que no hay más registros con ID=0
    result = session.execute(text("SELECT COUNT(*) FROM po_solicitud_detalles WHERE id = 0"))
    zero_count = result.fetchone()[0]
    print(f"Registros con ID=0: {zero_count}")
    
    # Verificar que la secuencia funciona
    result = session.execute(text("SELECT nextval('po_solicitud_detalles_id_seq')"))
    next_id = result.fetchone()[0]
    print(f"Próximo ID de secuencia: {next_id}")
    
    # Resetear la secuencia (consumimos uno para verificar)
    session.execute(text("SELECT setval('po_solicitud_detalles_id_seq', last_value - 1)"))
    
    if zero_count == 0:
        print("✅ Reparación exitosa: No quedan registros con ID=0")
        return True
    else:
        print("❌ Error: Aún quedan registros con ID=0")
        return False


def main():
    """Función principal"""
    print("="*60)
    print("REPARACIÓN: Problema ID=0 en po_solicitud_detalles")
    print("="*60)
    
    try:
        session = next(get_session())
        
        # Analizar estado actual
        zero_count, max_id, seq_value = analyze_current_state(session)
        
        if zero_count == 0:
            print("\n✅ No hay registros con ID=0. El sistema está correcto.")
            return
        
        # Confirmar reparación
        print(f"\n⚠️  Se encontraron {zero_count} registros con ID=0")
        print("   Esto causa errores de clave duplicada al insertar nuevos registros.")
        confirm = input("¿Proceder con la reparación? (y/N): ")
        
        if confirm.lower() not in ['y', 'yes', 's', 'si']:
            print("❌ Reparación cancelada por el usuario")
            return
        
        # Ejecutar reparación
        new_id = fix_zero_id_record(session)
        
        # Verificar resultado
        if verify_fix(session):
            print(f"\n🎉 REPARACIÓN COMPLETADA EXITOSAMENTE")
            print(f"   Registro ID=0 → ID={new_id}")
            print("   El sistema ahora puede insertar nuevos registros sin errores.")
        else:
            print(f"\n❌ REPARACIÓN FALLÓ")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ ERROR durante la reparación: {e}")
        sys.exit(1)
    finally:
        if 'session' in locals():
            session.close()


if __name__ == "__main__":
    main()