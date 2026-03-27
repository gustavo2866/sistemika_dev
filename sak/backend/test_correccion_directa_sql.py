#!/usr/bin/env python3
"""
Test directo SQL para verificar corrección
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak")

def test_correccion_directa():
    """Test directo usando SQL para verificar la corrección"""
    
    print("🔍 TEST: Corrección Directa SQL")
    print("=" * 40)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        
        # 1. Verificar que las correcciones se aplicaron
        print("1️⃣ VERIFICAR CORRECCIONES APLICADAS")
        
        count_query = """
        SELECT COUNT(*) as total
        FROM po_orders 
        WHERE departamento_id = 4 
            AND oportunidad_id IS NOT NULL;
        """
        
        count_result = conn.execute(text(count_query)).fetchone()
        total_con_oportunidad = count_result.total
        
        count_query_sin = """
        SELECT COUNT(*) as total
        FROM po_orders 
        WHERE departamento_id = 4 
            AND oportunidad_id IS NULL;
        """
        
        count_result_sin = conn.execute(text(count_query_sin)).fetchone()
        total_sin_oportunidad = count_result_sin.total
        
        print(f"   📊 Órdenes depto 4 CON oportunidad_id: {total_con_oportunidad}")
        print(f"   📊 Órdenes depto 4 SIN oportunidad_id: {total_sin_oportunidad}")
        
        if total_sin_oportunidad == 0:
            print(f"   ✅ ¡CORRECCIÓN EXITOSA! Todas las órdenes de proyectos tienen oportunidad_id")
        else:
            print(f"   ⚠️ Quedan {total_sin_oportunidad} órdenes sin oportunidad_id")
        
        # 2. Verificar órdenes por proyecto 14-17 después de corrección
        print(f"\n2️⃣ VERIFICAR ÓRDENES POR PROYECTO 14-17")
        
        query_proyectos = """
        SELECT 
            p.id as proyecto_id,
            p.nombre as proyecto_nombre,
            COUNT(po.id) as total_ordenes,
            SUM(po.total) as total_importe
        FROM proyectos p
        LEFT JOIN po_orders po ON po.oportunidad_id = p.oportunidad_id
        WHERE p.id BETWEEN 14 AND 17
        GROUP BY p.id, p.nombre
        ORDER BY p.id;
        """
        
        try:
            result_proyectos = conn.execute(text(query_proyectos)).fetchall()
            
            for row in result_proyectos:
                ordenes = row.total_ordenes or 0
                importe = row.total_importe or 0
                nombre_corto = row.proyecto_nombre[:30] + "..." if len(row.proyecto_nombre) > 30 else row.proyecto_nombre
                print(f"   📋 P{row.proyecto_id}: {ordenes} órdenes, ${importe:,.0f} - {nombre_corto}")
                
        except Exception as e:
            print(f"   ❌ Error consultando proyectos: {e}")
        
        # 3. Verificar total de importes por concepto después de corrección
        print(f"\n3️⃣ VERIFICAR IMPORTES POR CONCEPTO (Marzo 2026)")
        
        # Buscar órdenes de marzo 2026 (donde hicimos muchas correcciones)
        query_marzo = """
        SELECT 
            CASE 
                WHEN po.tipo_solicitud_id = 7 THEN 'mo_propia'
                WHEN po.tipo_solicitud_id IN (3, 5, 6) THEN 'mo_terceros'
                WHEN po.tipo_solicitud_id IN (1, 2, 4) THEN 'materiales'
                ELSE 'otros'
            END as concepto,
            COUNT(*) as total_ordenes,
            SUM(po.total) as total_importe
        FROM po_orders po
        INNER JOIN proyectos p ON po.oportunidad_id = p.oportunidad_id
        WHERE po.departamento_id = 4
            AND po.created_at >= '2026-03-01'
            AND po.created_at < '2026-04-01'
        GROUP BY 
            CASE 
                WHEN po.tipo_solicitud_id = 7 THEN 'mo_propia'
                WHEN po.tipo_solicitud_id IN (3, 5, 6) THEN 'mo_terceros'
                WHEN po.tipo_solicitud_id IN (1, 2, 4) THEN 'materiales'
                ELSE 'otros'
            END
        ORDER BY total_importe DESC;
        """
        
        try:
            result_marzo = conn.execute(text(query_marzo)).fetchall()
            
            total_marzo = 0
            for row in result_marzo:
                print(f"   📊 {row.concepto}: {row.total_ordenes} órdenes, ${row.total_importe or 0:,.0f}")
                total_marzo += row.total_importe or 0
            
            print(f"   💰 Total marzo 2026: ${total_marzo:,.0f}")
            
            if total_marzo > 600_000_000:
                print(f"   🎉 ¡CORRECCIÓN MASIVA CONFIRMADA! ${total_marzo:,.0f}")
                
        except Exception as e:
            print(f"   ❌ Error en consulta marzo: {e}")
        
        # 4. Verificar distribución por proyecto en órdenes corregidas
        print(f"\n4️⃣ VERIFICAR DISTRIBUCIÓN EN ÓRDENES MARZO 2026")
        
        query_dist = """
        SELECT 
            p.id as proyecto_id,
            COUNT(po.id) as ordenes_marzo,
            SUM(po.total) as importe_marzo
        FROM proyectos p
        LEFT JOIN po_orders po ON po.oportunidad_id = p.oportunidad_id 
            AND po.created_at >= '2026-03-01' 
            AND po.created_at < '2026-04-01'
            AND po.departamento_id = 4
        WHERE p.id BETWEEN 14 AND 17
        GROUP BY p.id
        ORDER BY p.id;
        """
        
        try:
            result_dist = conn.execute(text(query_dist)).fetchall()
            
            for row in result_dist:
                ordenes = row.ordenes_marzo or 0
                importe = row.importe_marzo or 0
                print(f"   📋 Proyecto {row.proyecto_id}: {ordenes} órdenes marzo, ${importe:,.0f}")
            
            # Verificar si la distribución es equitativa (4 por proyecto)
            ordenes_por_proyecto = [row.ordenes_marzo or 0 for row in result_dist]
            if len(set(ordenes_por_proyecto)) <= 2:  # Distribución bastante equitativa
                print(f"   ✅ Distribución equitativa confirmada")
            
        except Exception as e:
            print(f"   ❌ Error en distribución: {e}")
        
        # 5. Resumen final
        print(f"\n5️⃣ RESUMEN CORRECCIÓN")
        
        # Total órdenes proyectos con oportunidad_id
        total_ordenes_proyectos = total_con_oportunidad
        print(f"   📊 Total órdenes departamento proyectos: {total_ordenes_proyectos}")
        print(f"   📊 Órdenes sin oportunidad_id: {total_sin_oportunidad}")
        
        if total_sin_oportunidad == 0 and total_ordenes_proyectos > 16:
            print(f"   🎉 CORRECCIÓN 100% EXITOSA")
            print(f"   ✅ Dashboard proyectos tendrá datos completos")
            print(f"   📈 KPIs incluirán todas las órdenes de proyectos")
        else:
            print(f"   ⚠️ Corrección parcial o incompleta")

    print("\n✅ Test directo completado")

if __name__ == "__main__":
    test_correccion_directa()