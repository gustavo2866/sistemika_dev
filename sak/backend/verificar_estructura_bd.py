#!/usr/bin/env python3
"""
Verificar estructura de base de datos
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak")

def verificar_estructura_bd():
    """Verificar qué tablas existen en la base de datos"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔍 VERIFICAR ESTRUCTURA BASE DE DATOS")
    print("=" * 50)
    
    with engine.begin() as conn:
        
        # 1. Listar todas las tablas
        print("1️⃣ TABLAS DISPONIBLES")
        query_tables = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        """
        
        tables = conn.execute(text(query_tables)).fetchall()
        print(f"   📊 Total tablas: {len(tables)}")
        
        table_names = [t.table_name for t in tables]
        
        # Buscar tablas relacionadas a órdenes
        order_tables = [t for t in table_names if 'order' in t.lower() or 'po_' in t.lower()]
        print(f"   📝 Tablas de órdenes: {order_tables}")
        
        # Buscar tablas relacionadas a proyectos
        proyecto_tables = [t for t in table_names if 'proyecto' in t.lower() or 'oportunidad' in t.lower()]
        print(f"   📝 Tablas de proyectos: {proyecto_tables}")
        
        # 2. Verificar si existe tabla de órdenes con nombre diferente
        print("\n2️⃣ BUSCAR TABLA DE ÓRDENES CORRECTA")
        
        # Probar variaciones comunes
        possible_names = ['po_orders', 'po_order', 'orders', 'compras', 'solicitudes']
        
        for name in possible_names:
            if name in table_names:
                print(f"   ✅ Encontrada: {name}")
                
                # Verificar estructura 
                query_columns = """
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = :table_name
                ORDER BY ordinal_position;
                """
                
                columns = conn.execute(text(query_columns), {'table_name': name}).fetchall()
                print(f"   📋 Columnas de {name}:")
                for col in columns[:10]:  # Mostrar primeras 10 columnas
                    print(f"       {col.column_name} ({col.data_type})")
                if len(columns) > 10:
                    print(f"       ... y {len(columns)-10} columnas más")
                break
        
        # 3. Verificar tabla de proyectos
        print("\n3️⃣ VERIFICAR TABLA PROYECTOS")
        if 'proyectos' in table_names:
            print("   ✅ Tabla 'proyectos' encontrada")
        else:
            print("   ❌ Tabla 'proyectos' no encontrada")
            proyecto_similares = [t for t in table_names if 'proyecto' in t]
            if proyecto_similares:
                print(f"   📝 Similares: {proyecto_similares}")
        
        # 4. Verificar tabla oportunidades
        print("\n4️⃣ VERIFICAR TABLA OPORTUNIDADES")
        oportunidad_tables = [t for t in table_names if 'oportunidad' in t]
        if oportunidad_tables:
            print(f"   ✅ Tablas oportunidades: {oportunidad_tables}")
        else:
            print("   ❌ No se encontraron tablas de oportunidades")
        
        # 5. Verificar conexión a proyectos 14-17
        print("\n5️⃣ VERIFICAR PROYECTOS 14-17 EN BD")
        
        # Intentar diferentes nombres de tabla
        for table_name in ['proyectos', 'proyecto']:
            if table_name in table_names:
                try:
                    query_proyectos = f"""
                    SELECT id, nombre, oportunidad_id
                    FROM {table_name}
                    WHERE id BETWEEN 14 AND 17
                    ORDER BY id;
                    """
                    
                    result = conn.execute(text(query_proyectos)).fetchall()
                    print(f"   ✅ Proyectos 14-17 en tabla '{table_name}': {len(result)}")
                    for r in result:
                        print(f"       {r.id}: {r.nombre[:40]}... (oportunidad: {r.oportunidad_id})")
                    break
                except Exception as e:
                    print(f"   ❌ Error consultando {table_name}: {e}")

    print("\n✅ Verificación de estructura completada")

if __name__ == "__main__":
    verificar_estructura_bd()