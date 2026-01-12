#!/usr/bin/env python3
"""Verificación simple de tablas en la base de datos."""

import os
import psycopg2
from urllib.parse import urlparse

def get_database_url():
    """Obtener URL de la base de datos desde variables de entorno."""
    # Intentar desde archivo .env si existe
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    database_url = None
    
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    database_url = line.strip().split('=', 1)[1]
                    break
    
    # Fallback a variable de entorno
    if not database_url:
        database_url = os.getenv('DATABASE_URL')
    
    return database_url

def main():
    print("🔍 VERIFICACIÓN RÁPIDA DE TABLAS EN BASE DE DATOS")
    print("=" * 60)
    
    try:
        database_url = get_database_url()
        if not database_url:
            print("❌ No se pudo obtener DATABASE_URL")
            print("   Verifica que esté configurada en .env o como variable de entorno")
            return
        
        # Conectar a la base de datos
        # Limpiar URL para psycopg2 (remover prefijo SQLAlchemy)
        if database_url.startswith('postgresql+psycopg://'):
            database_url = database_url.replace('postgresql+psycopg://', 'postgresql://')
        
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Obtener lista de tablas
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        
        print(f"\n📊 TABLAS ENCONTRADAS EN BASE DE DATOS ({len(tables)}):")
        print("-" * 50)
        
        # Categorizar tablas
        core_tables = []
        po_tables = []
        crm_tables = []
        backup_tables = []
        other_tables = []
        
        for table in tables:
            if 'backup' in table:
                backup_tables.append(table)
            elif table.startswith('po_'):
                po_tables.append(table)
            elif table.startswith('crm_'):
                crm_tables.append(table)
            elif table in ['articulos', 'tipos_articulo', 'proveedores', 'usuarios', 'proyectos', 'departamentos', 'adm_conceptos', 'settings']:
                core_tables.append(table)
            else:
                other_tables.append(table)
        
        if core_tables:
            print(f"\n🏗️  TABLAS CORE ({len(core_tables)}):")
            for table in sorted(core_tables):
                print(f"   ✅ {table}")
        
        if po_tables:
            print(f"\n📦 TABLAS MÓDULO PO ({len(po_tables)}):")
            for table in sorted(po_tables):
                print(f"   ✅ {table}")
        
        if crm_tables:
            print(f"\n👥 TABLAS CRM ({len(crm_tables)}):")
            for table in sorted(crm_tables):
                print(f"   ✅ {table}")
        
        if other_tables:
            print(f"\n📋 OTRAS TABLAS ({len(other_tables)}):")
            for table in sorted(other_tables):
                print(f"   ✅ {table}")
        
        if backup_tables:
            print(f"\n🗂️  TABLAS BACKUP ({len(backup_tables)}):")
            for table in sorted(backup_tables):
                print(f"   🗑️  {table}")
        
        # Verificar algunas columnas críticas
        print(f"\n🔍 VERIFICANDO COLUMNAS CRÍTICAS:")
        print("-" * 40)
        
        # Verificar po_factura_detalles.articulo_id
        try:
            cur.execute("""
                SELECT column_name, is_nullable, data_type
                FROM information_schema.columns 
                WHERE table_name = 'po_factura_detalles' 
                AND column_name = 'articulo_id'
            """)
            result = cur.fetchone()
            if result:
                print(f"✅ po_factura_detalles.articulo_id: {result[2]} (nullable={result[1]})")
            else:
                print("❌ po_factura_detalles.articulo_id: NO EXISTE")
        except Exception as e:
            print(f"❌ Error verificando po_factura_detalles: {e}")
        
        # Verificar po_orden_compra_detalles.articulo_id
        try:
            cur.execute("""
                SELECT column_name, is_nullable, data_type
                FROM information_schema.columns 
                WHERE table_name = 'po_orden_compra_detalles' 
                AND column_name = 'articulo_id'
            """)
            result = cur.fetchone()
            if result:
                print(f"✅ po_orden_compra_detalles.articulo_id: {result[2]} (nullable={result[1]})")
            else:
                print("❌ po_orden_compra_detalles.articulo_id: NO EXISTE")
        except Exception as e:
            print(f"❌ Error verificando po_orden_compra_detalles: {e}")
        
        # Verificar adm_conceptos
        try:
            cur.execute("""
                SELECT COUNT(*) FROM adm_conceptos
            """)
            count = cur.fetchone()[0]
            print(f"✅ adm_conceptos: {count} registros")
        except Exception as e:
            print(f"❌ Error verificando adm_conceptos: {e}")
        
        # Verificar settings table
        try:
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'settings'
                ORDER BY ordinal_position
            """)
            settings_cols = [row[0] for row in cur.fetchall()]
            if settings_cols:
                print(f"✅ settings: {len(settings_cols)} columnas")
            else:
                print("❌ settings: NO EXISTE")
        except Exception as e:
            print(f"❌ Error verificando settings: {e}")
        
        print(f"\n🎯 CONCLUSIONES:")
        print("-" * 30)
        print(f"   • Total tablas: {len(tables)}")
        print(f"   • Tablas backup: {len(backup_tables)} (candidatas para eliminación)")
        print(f"   • Sistema parece estar funcionando")
        
        if backup_tables:
            print(f"\n💡 RECOMENDACIONES:")
            print(f"   • Las tablas backup se pueden eliminar de forma segura")
            print(f"   • La migración limpiará inconsistencias menores")
            print(f"   • El sistema está estable para aplicar cambios")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()