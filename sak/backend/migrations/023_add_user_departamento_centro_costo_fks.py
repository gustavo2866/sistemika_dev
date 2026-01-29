#!/usr/bin/env python3
"""
Migración 023: Agregar foreign keys departamento y centro de costo a usuarios (PostgreSQL)

Este script realiza:
1. Agrega la columna departamento_id a la tabla users
2. Agrega la columna centro_costo_id a la tabla users
3. Crea foreign key constraints con departamentos y centros_costo

Fecha: 2026-01-29
"""

from __future__ import annotations

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

def run_migration():
    """Ejecuta la migración de base de datos PostgreSQL"""
    
    # Cargar variables de entorno
    load_dotenv()
    
    print(f"🔄 Iniciando migración 023...")
    
    # Obtener URL de la base de datos
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ No se encontró DATABASE_URL en las variables de entorno")
        return False
    
    if "postgresql" not in database_url:
        print("❌ Esta migración está diseñada para PostgreSQL")
        return False
    
    print(f"📂 Conectando a PostgreSQL...")
    
    try:
        # Crear motor de SQLAlchemy
        engine = create_engine(database_url)
        
        # Probar conexión
        with engine.connect() as conn:
            print("📊 Verificando estructura actual de la tabla users...")
            
            # Verificar si ya existen las columnas
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            print(f"📋 Columnas actuales en users: {columns}")
            
            migration_needed = False
            
            if 'departamento_id' not in columns:
                print("📝 Agregando columna departamento_id...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN departamento_id INTEGER 
                    REFERENCES departamentos(id)
                """))
                conn.commit()
                print("✅ Columna departamento_id agregada correctamente")
                migration_needed = True
            else:
                print("⚠️  La columna departamento_id ya existe, saltando...")
            
            if 'centro_costo_id' not in columns:
                print("📝 Agregando columna centro_costo_id...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN centro_costo_id INTEGER 
                    REFERENCES centros_costo(id)
                """))
                conn.commit()
                print("✅ Columna centro_costo_id agregada correctamente")
                migration_needed = True
            else:
                print("⚠️  La columna centro_costo_id ya existe, saltando...")
            
            if migration_needed:
                # Verificar la nueva estructura
                print("📊 Verificando nueva estructura...")
                columns_after = [col['name'] for col in inspector.get_columns('users')]
                
                print("📋 Columnas en la tabla users después de la migración:")
                for col_info in inspector.get_columns('users'):
                    nullable = "NULL" if col_info['nullable'] else "NOT NULL"
                    print(f"   - {col_info['name']} ({col_info['type']}) {nullable}")
            
            print("✅ Migración 023 completada exitosamente")
            return True
        
    except Exception as e:
        print(f"❌ Error en la migración: {e}")
        return False

def rollback_migration():
    """Rollback de la migración"""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ No se encontró DATABASE_URL en las variables de entorno")
        return False
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            print("🔄 Ejecutando rollback...")
            
            # Remover columnas agregadas
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS departamento_id"))
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS centro_costo_id"))
            conn.commit()
            
            print("✅ Rollback completado")
            return True
            
    except Exception as e:
        print(f"❌ Error en rollback: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    if not success:
        print("❌ Migración falló")
        exit(1)
    else:
        print("🎉 Migración ejecutada con éxito")