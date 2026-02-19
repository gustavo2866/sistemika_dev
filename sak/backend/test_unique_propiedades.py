#!/usr/bin/env python3
"""
Probar si la restricción unique está activa en propiedades.nombre
"""
import sys
import os

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.database import get_session, engine
from app.models.propiedad import Propiedad
import sqlalchemy as sa

def main():
    print("=== VERIFICANDO RESTRICCIONES UNIQUE ===")
    
    # 1. Verificar en la base de datos directamente
    with engine.connect() as conn:
        # Verificar índices unique
        unique_indices = conn.execute(sa.text("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'propiedades' 
            AND indexdef LIKE '%UNIQUE%'
        """)).fetchall()
        
        if unique_indices:
            print("❌ Se encontraron índices UNIQUE:")
            for name, definition in unique_indices:
                print(f"  - {name}: {definition}")
        else:
            print("✅ No hay índices UNIQUE en la tabla propiedades")
            
        # Verificar restricciones unique  
        unique_constraints = conn.execute(sa.text("""
            SELECT conname, a.attname as column_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
            WHERE rel.relname = 'propiedades' AND con.contype = 'u'
        """)).fetchall()
        
        if unique_constraints:
            print("❌ Se encontraron restricciones UNIQUE:")
            for constraint_name, col_name in unique_constraints:
                print(f"  - {constraint_name} en columna '{col_name}'")
                
                # Si encontramos restricción en nombre, la eliminamos
                if col_name == 'nombre':
                    try:
                        conn.execute(sa.text(f"ALTER TABLE propiedades DROP CONSTRAINT {constraint_name}"))
                        conn.commit()
                        print(f"  ✅ Restricción {constraint_name} eliminada")
                    except Exception as e:
                        print(f"  ❌ Error eliminando restricción: {e}")
        else:
            print("✅ No hay restricciones UNIQUE en columnas")
    
    print("\n=== PRUEBA DE NOMBRES DUPLICADOS ===")
    
    # 2. Probar crear propiedades con nombres duplicados
    session = next(get_session())
    
    try:
        # Limpiar propiedades de prueba anteriores
        session.query(Propiedad).filter(Propiedad.nombre == 'Test Duplicado').delete()
        session.commit()
        
        # Crear primera propiedad
        prop1 = Propiedad(
            nombre='Test Duplicado',
            tipo='Casa',
            propietario='Test Owner 1'
        )
        session.add(prop1)
        session.flush()
        print(f"✅ Primera propiedad creada: ID {prop1.id}")
        
        # Crear segunda propiedad con el mismo nombre
        prop2 = Propiedad(
            nombre='Test Duplicado',
            tipo='Depto', 
            propietario='Test Owner 2'
        )
        session.add(prop2)
        session.commit()
        print(f"✅ Segunda propiedad creada: ID {prop2.id}")
        print("🎉 ÉXITO: Se pueden crear propiedades con nombres duplicados")
        
    except Exception as e:
        session.rollback()
        error_msg = str(e)
        print(f"❌ ERROR: {error_msg}")
        
        if 'unique' in error_msg.lower() or 'duplicate' in error_msg.lower():
            print("🚨 HAY UNA RESTRICCIÓN UNIQUE ACTIVA en el campo nombre")
            
            # Intentar identificar y eliminar la restricción
            if 'propiedades_nombre_key' in error_msg:
                print("Intentando eliminar restricción propiedades_nombre_key...")
                try:
                    with engine.connect() as conn:
                        conn.execute(sa.text("ALTER TABLE propiedades DROP CONSTRAINT propiedades_nombre_key"))
                        conn.commit()
                        print("✅ Restricción eliminada, intenta de nuevo")
                except Exception as drop_error:
                    print(f"❌ Error eliminando restricción: {drop_error}")
        
    finally:
        session.close()

if __name__ == "__main__":
    main()