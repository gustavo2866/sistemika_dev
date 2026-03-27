#!/usr/bin/env python3
"""
Verificar columnas específicas de tablas clave
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak")

def verificar_columnas_detalladas():
    """Verificar columnas de tablas clave"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔍 VERIFICAR COLUMNAS DETALLADAS")
    print("=" * 50)
    
    with engine.begin() as conn:
        
        # 1. Tabla solicitudes (equivale a po_orders)
        print("1️⃣ TABLA SOLICITUDES")
        query_cols_solicitudes = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'solicitudes'
        ORDER BY ordinal_position;
        """
        
        cols_solicitudes = conn.execute(text(query_cols_solicitudes)).fetchall()
        print(f"   📋 Columnas encontradas: {len(cols_solicitudes)}")
        for col in cols_solicitudes:
            nullable = "NULL" if col.is_nullable == "YES" else "NOT NULL"
            print(f"       {col.column_name:<25} {col.data_type:<20} {nullable}")
        
        # 2. Tabla proyectos  
        print(f"\n2️⃣ TABLA PROYECTOS")
        query_cols_proyectos = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'proyectos'
        ORDER BY ordinal_position;
        """
        
        cols_proyectos = conn.execute(text(query_cols_proyectos)).fetchall()
        print(f"   📋 Columnas encontradas: {len(cols_proyectos)}")
        for col in cols_proyectos:
            nullable = "NULL" if col.is_nullable == "YES" else "NOT NULL"
            print(f"       {col.column_name:<25} {col.data_type:<20} {nullable}")
        
        # 3. Tabla crm_oportunidades
        print(f"\n3️⃣ TABLA CRM_OPORTUNIDADES")
        query_cols_oportunidades = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'crm_oportunidades'
        ORDER BY ordinal_position;
        """
        
        cols_oportunidades = conn.execute(text(query_cols_oportunidades)).fetchall()
        print(f"   📋 Columnas encontradas: {len(cols_oportunidades)}")
        for col in cols_oportunidades:
            nullable = "NULL" if col.is_nullable == "YES" else "NOT NULL"
            print(f"       {col.column_name:<25} {col.data_type:<20} {nullable}")
        
        # 4. Verificar si hay tablas de status/log
        print(f"\n4️⃣ TABLAS LOG/STATUS")
        query_log_tables = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
            AND (table_name LIKE '%log%' OR table_name LIKE '%status%')
        ORDER BY table_name;
        """
        
        log_tables = conn.execute(text(query_log_tables)).fetchall()
        if log_tables:
            print(f"   📝 Tablas encontradas: {[t.table_name for t in log_tables]}")
        else:
            print("   ❌ No se encontraron tablas de log/status")
        
        # 5. Buscar conexión entre proyectos y oportunidades
        print(f"\n5️⃣ BUSCAR RELACIÓN PROYECTOS-OPORTUNIDADES")
        
        # Ver datos de algunos proyectos 14-17
        query_sample_proyectos = """
        SELECT id, nombre
        FROM proyectos
        WHERE id BETWEEN 14 AND 17
        ORDER BY id;
        """
        
        sample_proyectos = conn.execute(text(query_sample_proyectos)).fetchall()
        print(f"   📊 Proyectos 14-17 encontrados: {len(sample_proyectos)}")
        for p in sample_proyectos:
            print(f"       Proyecto {p.id}: {p.nombre[:50]}...")
        
        # Ver estructura de crm_oportunidades
        query_sample_oportunidades = """
        SELECT id, tipo_solicitud_id, cliente_id
        FROM crm_oportunidades
        WHERE id BETWEEN 200 AND 210
        ORDER BY id
        LIMIT 5;
        """
        
        try:
            sample_oportunidades = conn.execute(text(query_sample_oportunidades)).fetchall()
            print(f"   📊 Ejemplo oportunidades 200-210:")
            for o in sample_oportunidades:
                print(f"       Oportunidad {o.id}: tipo_solicitud={o.tipo_solicitud_id}, cliente={o.cliente_id}")
        except Exception as e:
            print(f"   ❌ Error consultando oportunidades: {e}")
        
        # 6. Verificar solicitudes con departamento_id=4
        print(f"\n6️⃣ VERIFICAR SOLICITUDES DEPARTAMENTO 4")
        
        # Buscar columna relacionada a oportunidades en solicitudes
        oportunidad_cols = [c.column_name for c in cols_solicitudes if 'oportunidad' in c.column_name.lower()]
        if oportunidad_cols:
            print(f"   📝 Columnas oportunidad en solicitudes: {oportunidad_cols}")
            
            oportunidad_field = oportunidad_cols[0]
            query_dept4 = f"""
            SELECT COUNT(*) as total,
                   COUNT({oportunidad_field}) as con_oportunidad,
                   COUNT(*) - COUNT({oportunidad_field}) as sin_oportunidad
            FROM solicitudes
            WHERE departamento_id = 4;
            """
            
            result_dept4 = conn.execute(text(query_dept4)).fetchone()
            print(f"   📊 Solicitudes depto 4:")
            print(f"       Total: {result_dept4.total}")
            print(f"       Con oportunidad_id: {result_dept4.con_oportunidad}")
            print(f"       Sin oportunidad_id: {result_dept4.sin_oportunidad}")
        else:
            print("   ❌ No hay columna oportunidad en solicitudes")

    print("\n✅ Verificación detallada completada")

if __name__ == "__main__":
    verificar_columnas_detalladas()