#!/usr/bin/env python3
"""
Crear vista optimizada y verificar impacto de corrección
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak")

def crear_vista_y_verificar():
    """Crear vista optimizada y verificar impacto de la corrección"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔧 CREAR VISTA Y VERIFICAR IMPACTO")
    print("=" * 50)
    
    with engine.begin() as conn:
        
        # 1. Crear la vista optimizada
        print("1️⃣ CREANDO VISTA OPTIMIZADA...")
        
        # Primero verificar estructura de po_order_status_log
        check_log = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'po_order_status_log' 
            AND column_name IN ('status_id', 'status_nuevo_id', 'fecha', 'fecha_registro')
        ORDER BY column_name;
        """
        
        log_columns = conn.execute(text(check_log)).fetchall()
        print(f"   📋 Columnas log disponibles: {[c.column_name for c in log_columns]}")
        
        # Determinar las columnas correctas
        has_status_nuevo_id = any(c.column_name == 'status_nuevo_id' for c in log_columns)
        has_fecha_registro = any(c.column_name == 'fecha_registro' for c in log_columns)
        
        status_field = 'status_nuevo_id' if has_status_nuevo_id else 'status_id'
        fecha_field = 'fecha_registro' if has_fecha_registro else 'fecha'
        
        print(f"   🔧 Usando: {status_field} y {fecha_field}")
        
        # Crear vista con campos correctos
        create_vista = f"""
        CREATE OR REPLACE VIEW vw_kpis_proyectos_po_orders AS
        SELECT 
            o.id as nro_orden,
            o.tipo_solicitud_id,
            p.id as proyecto_id,
            p.nombre as proyecto_nombre,
            o.oportunidad_id,
            log_emision.{fecha_field} as fecha_emision,
            os.nombre as estado,
            -- Mapeo de tipo_solicitud a concepto de proyecto
            CASE 
                WHEN o.tipo_solicitud_id = 7 THEN 'mo_propia'
                WHEN o.tipo_solicitud_id IN (3, 5, 6) THEN 'mo_terceros'  -- Servicios, Transporte, Mensajería
                WHEN o.tipo_solicitud_id IN (1, 2, 4) THEN 'materiales'   -- Materiales, Ferretería, Insumos
                ELSE 'otros'
            END as concepto_proyecto,
            o.total as importe_orden
        FROM po_orders o
        -- Join con log para obtener fecha de emisión (estado = 3 'emitida')
        INNER JOIN po_order_status_log log_emision 
            ON o.id = log_emision.order_id 
            AND log_emision.{status_field} = 3  -- Estado 'emitida'
        -- Join para obtener estado actual
        INNER JOIN po_order_status os ON o.order_status_id = os.id
        -- Join con proyectos a través de oportunidad_id  
        INNER JOIN proyectos p ON o.oportunidad_id = p.oportunidad_id
        WHERE 
            o.oportunidad_id IS NOT NULL
            AND p.oportunidad_id IS NOT NULL
            AND log_emision.{fecha_field} IS NOT NULL;
        """
        
        try:
            conn.execute(text(create_vista))
            print("   ✅ Vista creada exitosamente")
        except Exception as e:
            print(f"   ❌ Error creando vista: {e}")
            return
        
        # 2. Verificar impacto
        print("\n2️⃣ VERIFICANDO IMPACTO DE LA CORRECCIÓN")
        
        query_vista = """
        SELECT 
            EXTRACT(YEAR FROM fecha_emision) as año,
            EXTRACT(MONTH FROM fecha_emision) as mes,
            COUNT(*) as total_ordenes,
            SUM(importe_orden) as total_importe
        FROM vw_kpis_proyectos_po_orders
        WHERE fecha_emision >= '2025-12-01' 
            AND fecha_emision <= '2026-03-31'
        GROUP BY EXTRACT(YEAR FROM fecha_emision), EXTRACT(MONTH FROM fecha_emision)
        ORDER BY año, mes;
        """
        
        result_vista = conn.execute(text(query_vista)).fetchall()
        total_ordenes = sum(r.total_ordenes for r in result_vista)
        total_importe = sum(r.total_importe or 0 for r in result_vista)
        
        print(f"   📊 Total órdenes en vista: {total_ordenes}")
        print(f"   💰 Total importe: ${total_importe:,.2f}")
        
        if len(result_vista) > 0:
            print("   📅 Distribución mensual:")
            for r in result_vista:
                mes_nombre = {12: 'Dic', 1: 'Ene', 2: 'Feb', 3: 'Mar'}.get(int(r.mes), str(r.mes))
                print(f"       {int(r.año)}-{mes_nombre}: {r.total_ordenes} órdenes, ${r.total_importe or 0:,.0f}")
        
        # 3. Comparar antes vs después
        print(f"\n3️⃣ COMPARACIÓN ANTES/DESPUÉS")
        print(f"   📈 Antes corrección: 15 órdenes")
        print(f"   📈 Después corrección: {total_ordenes} órdenes")
        
        if total_ordenes > 15:
            incremento = total_ordenes - 15
            print(f"   🚀 Incremento: +{incremento} órdenes")
            print(f"   📊 Incremento %: {(incremento/15)*100:.1f}%")
            print("   ✅ ¡Los KPIs ahora incluyen MÁS datos de proyectos!")
        elif total_ordenes == 15:
            print("   🤔 Misma cantidad - pueden ser órdenes sin fecha emisión aún")
        else:
            print("   ⚠️ Menos órdenes - revisar vista")
        
        # 4. Detalle por proyecto
        if total_ordenes > 0:
            print(f"\n4️⃣ DETALLE POR PROYECTO EN VISTA")
            query_proyectos = """
            SELECT 
                proyecto_id,
                proyecto_nombre,
                concepto_proyecto,
                COUNT(*) as total_ordenes,
                SUM(importe_orden) as total_importe
            FROM vw_kpis_proyectos_po_orders
            WHERE proyecto_id BETWEEN 14 AND 17
            GROUP BY proyecto_id, proyecto_nombre, concepto_proyecto
            ORDER BY proyecto_id, concepto_proyecto;
            """
            
            result_proyectos = conn.execute(text(query_proyectos)).fetchall()
            
            if result_proyectos:
                print(f"   {'Proyecto':<10} {'Concepto':<12} {'Órdenes':<8} {'Importe':<15}")
                print("   " + "-" * 50)
                for r in result_proyectos:
                    concepto_corto = str(r.concepto_proyecto or "")[:10]
                    print(f"   {r.proyecto_id:<10} {concepto_corto:<12} {r.total_ordenes:<8} ${r.total_importe or 0:<14,.0f}")

    print("\n✅ Verificación completada")

if __name__ == "__main__":
    crear_vista_y_verificar()