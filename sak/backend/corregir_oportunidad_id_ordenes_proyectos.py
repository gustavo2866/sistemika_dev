#!/usr/bin/env python3
"""
Corregir órdenes con departamento_id=4 (Proyectos) que no tienen oportunidad_id asignado
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from datetime import datetime

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("dotenv not available, using os.getenv directly")

# Obtener DATABASE_URL del entorno  
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment, using default local database")
    DATABASE_URL = "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak"

def investigar_y_corregir_ordenes():
    """Investigar órdenes con departamento_id=4 sin oportunidad_id y corregir"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔧 CORRECCIÓN: Órdenes departamento Proyectos sin oportunidad_id")
    print("=" * 70)
    
    with engine.begin() as conn:
        
        # 1. Verificar qué es departamento_id=4
        print("1️⃣ VERIFICAR DEPARTAMENTO_ID=4")
        query_dept = """
        SELECT id, nombre 
        FROM departamentos 
        WHERE id = 4;
        """
        dept_result = conn.execute(text(query_dept)).fetchone()
        if dept_result:
            print(f"   ✅ Departamento ID 4: {dept_result.nombre}")
        else:
            print("   ❌ No se encontró departamento ID 4")
            return
            
        # 2. Obtener oportunidad_id de proyectos 14-17
        print("\n2️⃣ OPORTUNIDAD_ID DE PROYECTOS 14-17")
        query_proyectos = """
        SELECT id as proyecto_id, oportunidad_id, nombre
        FROM proyectos 
        WHERE id BETWEEN 14 AND 17
        ORDER BY id;
        """
        proyectos_result = conn.execute(text(query_proyectos)).fetchall()
        
        if not proyectos_result:
            print("   ❌ No se encontraron proyectos 14-17")
            return
            
        print(f"   📊 Proyectos encontrados: {len(proyectos_result)}")
        oportunidad_mapping = {}
        for p in proyectos_result:
            oportunidad_mapping[p.proyecto_id] = p.oportunidad_id
            print(f"   📝 Proyecto {p.proyecto_id}: Oportunidad {p.oportunidad_id} - {p.nombre[:50]}...")
            
        # 3. Identificar órdenes problemáticas
        print("\n3️⃣ ÓRDENES CON DEPARTAMENTO_ID=4 SIN OPORTUNIDAD_ID")
        query_ordenes_problema = """
        SELECT 
            po.id,
            po.created_at,
            po.titulo,
            po.total,
            pos.nombre as status,
            po.departamento_id,
            po.oportunidad_id
        FROM po_orders po
        LEFT JOIN po_order_status pos ON po.order_status_id = pos.id
        WHERE po.departamento_id = 4 
            AND po.oportunidad_id IS NULL
        ORDER BY po.created_at DESC;
        """
        
        ordenes_problema = conn.execute(text(query_ordenes_problema)).fetchall()
        print(f"   📊 Órdenes sin oportunidad_id: {len(ordenes_problema)}")
        
        if len(ordenes_problema) > 0:
            print(f"   💰 Total importe: ${sum(row.total or 0 for row in ordenes_problema):,.2f}")
            print(f"   📅 Rango fechas: {min(row.created_at for row in ordenes_problema).date()} → {max(row.created_at for row in ordenes_problema).date()}")
            
            print("\n   📝 Ejemplos (primeras 10):")
            print(f"   {'ID':<8} {'Fecha':<12} {'Título':<30} {'Total':<12} {'Status':<12}")
            print("   " + "-" * 80)
            for row in ordenes_problema[:10]:
                total_str = f"${row.total:,.0f}" if row.total else "N/A"
                titulo_corto = str(row.titulo or "")[:27] + "..." if len(str(row.titulo or "")) > 27 else str(row.titulo or "")
                print(f"   {row.id:<8} {str(row.created_at)[:10]:<12} {titulo_corto:<30} {total_str:<12} {row.status:<12}")
        
        # 4. Estrategia de asignación
        if len(ordenes_problema) > 0:
            print(f"\n4️⃣ ESTRATEGIA DE ASIGNACIÓN")
            print(f"   📊 {len(ordenes_problema)} órdenes → {len(proyectos_result)} proyectos")
            
            # Distribuir equitativamente entre proyectos 14-17
            proyectos_ids = [14, 15, 16, 17]
            ordenes_por_proyecto = len(ordenes_problema) // len(proyectos_ids)
            ordenes_restantes = len(ordenes_problema) % len(proyectos_ids)
            
            print(f"   📋 Distribución:")
            asignaciones = []
            orden_idx = 0
            
            for i, proyecto_id in enumerate(proyectos_ids):
                cant_ordenes = ordenes_por_proyecto + (1 if i < ordenes_restantes else 0)
                oportunidad_id = oportunidad_mapping[proyecto_id]
                
                print(f"   - Proyecto {proyecto_id} (Oportunidad {oportunidad_id}): {cant_ordenes} órdenes")
                
                # Asignar órdenes a este proyecto
                for j in range(cant_ordenes):
                    if orden_idx < len(ordenes_problema):
                        orden = ordenes_problema[orden_idx]
                        asignaciones.append({
                            'orden_id': orden.id,
                            'proyecto_id': proyecto_id,
                            'oportunidad_id': oportunidad_id
                        })
                        orden_idx += 1
            
            # 5. Confirmar y ejecutar correcciones
            print(f"\n5️⃣ CORRECCIONES A REALIZAR")
            print(f"   📊 Total asignaciones: {len(asignaciones)}")
            
            # Mostrar resumen por proyecto
            for proyecto_id in proyectos_ids:
                asig_proyecto = [a for a in asignaciones if a['proyecto_id'] == proyecto_id]
                if asig_proyecto:
                    print(f"   📝 Proyecto {proyecto_id}: {len(asig_proyecto)} órdenes")
                    ejemplos = asig_proyecto[:5]
                    orden_ids = [str(a['orden_id']) for a in ejemplos]
                    print(f"        Órdenes: {', '.join(orden_ids)}{'...' if len(asig_proyecto) > 5 else ''}")
            
            # EJECUTAR CORRECCIONES
            print(f"\n6️⃣ EJECUTANDO CORRECCIONES...")
            
            # Ejecutar actualizaciones una por una
            actualizaciones = 0
            for asig in asignaciones:
                update_query = """
                UPDATE po_orders 
                SET oportunidad_id = :oportunidad_id,
                    updated_at = :now
                WHERE id = :orden_id 
                    AND departamento_id = 4 
                    AND oportunidad_id IS NULL;
                """
                
                result = conn.execute(text(update_query), {
                    'oportunidad_id': asig['oportunidad_id'],
                    'orden_id': asig['orden_id'],
                    'now': datetime.now()
                })
                
                if result.rowcount == 1:
                    actualizaciones += 1
                else:
                    print(f"   ⚠️ Orden {asig['orden_id']} no se pudo actualizar")
            
            print(f"   ✅ {actualizaciones} órdenes actualizadas correctamente")
        
        # 7. Verificación final
        print(f"\n7️⃣ VERIFICACIÓN FINAL")
        
        # Contar órdenes departamento 4 sin oportunidad_id después de corrección
        ordenes_restantes = conn.execute(text(query_ordenes_problema)).fetchall()
        print(f"   📊 Órdenes sin oportunidad_id restantes: {len(ordenes_restantes)}")
        
        # Contar por proyecto
        query_por_proyecto = """
        SELECT 
            p.id as proyecto_id,
            p.nombre as proyecto_nombre,
            COUNT(po.id) as total_ordenes,
            SUM(po.total) as total_importe
        FROM proyectos p
        LEFT JOIN po_orders po ON po.oportunidad_id = p.oportunidad_id 
            AND po.departamento_id = 4
        WHERE p.id BETWEEN 14 AND 17
        GROUP BY p.id, p.nombre
        ORDER BY p.id;
        """
        
        distribucion_final = conn.execute(text(query_por_proyecto)).fetchall()
        print("   📋 Distribución final por proyecto:")
        print(f"   {'Proyecto':<10} {'Órdenes':<10} {'Total Importe':<15} {'Nombre':<30}")
        print("   " + "-" * 70)
        
        for row in distribucion_final:
            total_str = f"${row.total_importe or 0:,.0f}"
            nombre_corto = str(row.proyecto_nombre or "")[:27] + "..." if len(str(row.proyecto_nombre or "")) > 27 else str(row.proyecto_nombre or "")
            print(f"   {row.proyecto_id:<10} {row.total_ordenes or 0:<10} {total_str:<15} {nombre_corto:<30}")

    print("\n✅ Proceso completado")

if __name__ == "__main__":
    investigar_y_corregir_ordenes()