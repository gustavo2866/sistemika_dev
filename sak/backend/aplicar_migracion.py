#!/usr/bin/env python3
"""
Script para aplicar migración específica de tipos_articulo con base de datos Neon
"""
import os
from dotenv import load_dotenv
from alembic.config import Config
from alembic import command

def main():
    # Cargar variables de entorno
    load_dotenv()
    
    # Configurar Alembic
    config = Config('alembic.ini')
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
    
    print(f"🔗 Conectando a: {db_url[:50]}...")
    config.set_main_option('sqlalchemy.url', db_url)
    
    try:
        # Mostrar estado actual
        print("\n📊 Estado actual de migraciones:")
        command.current(config)
        
        # Mostrar historial reciente
        print("\n📋 Últimas migraciones:")
        command.history(config, rev_range="head-3:head")
        
        # Aplicar migración específica
        print("\n🚀 Aplicando migración de tipos_articulo...")
        command.upgrade(config, 'head')
        
        # Mostrar estado final
        print("\n✅ Estado final:")
        command.current(config)
        
        print("\n🎉 ¡Migración de tipos_articulo completada exitosamente!")
        
    except Exception as e:
        print(f"❌ ERROR durante la migración: {e}")
        print("\n💡 Sugerencia: Verifica que no haya migraciones conflictivas")
        return

if __name__ == "__main__":
    main()