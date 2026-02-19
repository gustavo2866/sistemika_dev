#!/usr/bin/env python3
import os
import sys

# Asegurar que estamos en el directorio correcto
backend_dir = r"C:\Users\gpalmieri\source\sistemika\sak\backend"
os.chdir(backend_dir)
sys.path.insert(0, backend_dir)

try:
    from app.database import get_session, engine
    from app.models.propiedad import Propiedad
    import sqlalchemy as sa
    
    print("=== VERIFICANDO RESTRICCIONES UNIQUE ===")
    
    # 1. Verificar en la base de datos directamente
    with engine.connect() as conn:
        unique_check = conn.execute(sa.text("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'propiedades' 
            AND indexdef LIKE '%UNIQUE%'
        """)).fetchall()
        
        if unique_check:
            print("❌ Se encontraron índices UNIQUE:")
            for name, definition in unique_check:
                print(f"  - {name}: {definition}")
        else:
            print("✅ No hay índices UNIQUE en la tabla propiedades")
            
        # Verificar restricciones unique
        constraints = conn.execute(sa.text("""
            SELECT conname, a.attname as column_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
            WHERE rel.relname = 'propiedades' AND con.contype = 'u'
        """)).fetchall()
        
        if constraints:
            print("❌ Se encontraron restricciones UNIQUE:")
            for constraint_name, col_name in constraints:
                print(f"  - {constraint_name} en columna '{col_name}'")
        else:
            print("✅ No hay restricciones UNIQUE en columnas")
    
    print("\n=== PRUEBA DE NOMBRES DUPLICADOS ===")
    
    # 2. Probar crear propiedades con nombres duplicados
    session = next(get_session())
    
    try:
        # Buscar si ya existe una propiedad de prueba
        existing = session.query(Propiedad).filter(Propiedad.nombre == 'Test Duplicado').first()
        if existing:
            print(f"Ya existe propiedad de prueba: ID {existing.id}")
        else:
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
        else:
            print("El error no parece estar relacionado con restricción unique")
    finally:
        session.close()
        
except ImportError as e:
    print(f"Error de importación: {e}")
    print("Asegúrate de estar en el directorio backend correcto")