#!/usr/bin/env python3
"""
Verificación exhaustiva de órdenes PO en el rango 2025-12 a 2026-03
Compara diferentes fuentes para asegurar que no se pierdan órdenes
"""

import sys
from datetime import date, datetime
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select, func, text
from app.db import engine
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder, PoOrderStatusLog, PoOrderStatus
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders


def verificar_ordenes_completas():
    """Verifica todas las fuentes de órdenes PO"""
    print("=== VERIFICACIÓN EXHAUSTIVA ÓRDENES PO ===")
    
    # Rango de fechas a verificar
    fecha_inicio = date(2025, 12, 1)
    fecha_fin = date(2026, 3, 31)
    
    print(f"🗓️ Rango verificación: {fecha_inicio} → {fecha_fin}")
    
    with Session(engine) as session:
        
        # === 1. ÓRDENES EN VISTA OPTIMIZADA ===
        print(f"\n1️⃣ ÓRDENES EN VISTA OPTIMIZADA:")
        stmt_vista = select(VwKpisProyectosPoOrders).where(
            VwKpisProyectosPoOrders.fecha_emision >= fecha_inicio,
            VwKpisProyectosPoOrders.fecha_emision <= fecha_fin
        ).order_by(VwKpisProyectosPoOrders.fecha_emision)
        
        ordenes_vista = session.exec(stmt_vista).all()
        print(f"   📊 Total en vista: {len(ordenes_vista)} órdenes")
        
        if ordenes_vista:
            print(f"   📅 Fechas: {ordenes_vista[0].fecha_emision} → {ordenes_vista[-1].fecha_emision}")
            ordenes_vista_ids = set(o.nro_orden for o in ordenes_vista)
            
            # Por mes
            meses_vista = {}
            for o in ordenes_vista:
                mes_key = f"{o.fecha_emision.year}-{o.fecha_emision.month:02d}"
                if mes_key not in meses_vista:
                    meses_vista[mes_key] = 0
                meses_vista[mes_key] += 1
            
            for mes, count in sorted(meses_vista.items()):
                print(f"      {mes}: {count} órdenes")
        else:
            ordenes_vista_ids = set()
        
        # === 2. ÓRDENES PO_ORDERS CON OPORTUNIDAD_ID ===
        print(f"\n2️⃣ ÓRDENES EN po_orders CON oportunidad_id:")
        stmt_po_orders = select(PoOrder).where(
            PoOrder.oportunidad_id.is_not(None)
        ).order_by(PoOrder.created_at)
        
        ordenes_po_todas = session.exec(stmt_po_orders).all()
        print(f"   📊 Total con oportunidad_id: {len(ordenes_po_todas)} órdenes")
        
        if ordenes_po_todas:
            fechas_created = [o.created_at.date() for o in ordenes_po_todas]
            print(f"   📅 Fechas created_at: {min(fechas_created)} → {max(fechas_created)}")
            
            # Filtrar por rango created_at
            ordenes_po_rango = [o for o in ordenes_po_todas 
                               if fecha_inicio <= o.created_at.date() <= fecha_fin]
            print(f"   📊 En rango created_at: {len(ordenes_po_rango)} órdenes")
            
            ordenes_po_rango_ids = set(o.id for o in ordenes_po_rango)
            
            # Por mes created_at
            meses_po = {}
            for o in ordenes_po_rango:
                mes_key = f"{o.created_at.year}-{o.created_at.month:02d}"
                if mes_key not in meses_po:
                    meses_po[mes_key] = 0
                meses_po[mes_key] += 1
            
            for mes, count in sorted(meses_po.items()):
                print(f"      {mes}: {count} órdenes")
        else:
            ordenes_po_rango_ids = set()
        
        # === 3. LOG DE ESTADOS 'EMITIDA' ===
        print(f"\n3️⃣ ÓRDENES CON ESTADO 'EMITIDA' (log):")
        
        # Obtener ID del estado 'emitida'
        stmt_estado = select(PoOrderStatus).where(PoOrderStatus.nombre == 'emitida')
        estado_emitida = session.exec(stmt_estado).first()
        
        if estado_emitida:
            print(f"   🏷️ Estado emitida ID: {estado_emitida.id}")
            
            # Logs de emisión en el rango
            stmt_logs = select(PoOrderStatusLog).where(
                PoOrderStatusLog.status_nuevo_id == estado_emitida.id,
                PoOrderStatusLog.fecha_registro >= fecha_inicio,
                PoOrderStatusLog.fecha_registro <= fecha_fin
            ).order_by(PoOrderStatusLog.fecha_registro)
            
            logs_emitida = session.exec(stmt_logs).all()
            print(f"   📊 Logs emitida en rango: {len(logs_emitida)}")
            
            if logs_emitida:
                print(f"   📅 Fechas: {logs_emitida[0].fecha_registro} → {logs_emitida[-1].fecha_registro}")
                logs_emitida_order_ids = set(log.order_id for log in logs_emitida)
                
                # Por mes
                meses_logs = {}
                for log in logs_emitida:
                    mes_key = f"{log.fecha_registro.year}-{log.fecha_registro.month:02d}"
                    if mes_key not in meses_logs:
                        meses_logs[mes_key] = 0
                    meses_logs[mes_key] += 1
                
                for mes, count in sorted(meses_logs.items()):
                    print(f"      {mes}: {count} órdenes")
            else:
                logs_emitida_order_ids = set()
        else:
            print(f"   ❌ Estado 'emitida' no encontrado")
            logs_emitida_order_ids = set()
        
        # === 4. ÓRDENES CON PROYECTOS RELACIONADOS ===
        print(f"\n4️⃣ ÓRDENES RELACIONADAS CON PROYECTOS:")
        
        # Consulta directa similar a la vista
        stmt_relacion = text("""
            SELECT DISTINCT
                o.id as order_id,
                o.created_at,
                o.oportunidad_id,
                p.id as proyecto_id,
                log_emision.fecha_registro as fecha_emision,
                o.total
            FROM po_orders o
            INNER JOIN proyectos p ON o.oportunidad_id = p.oportunidad_id
            LEFT JOIN po_order_status_log log_emision 
                ON o.id = log_emision.order_id 
                AND log_emision.status_nuevo_id = 3
            WHERE 
                o.oportunidad_id IS NOT NULL
                AND p.oportunidad_id IS NOT NULL
            ORDER BY o.created_at
        """)
        
        result = session.exec(stmt_relacion)
        ordenes_relacionadas = result.all()
        
        print(f"   📊 Total órdenes con proyectos: {len(ordenes_relacionadas)}")
        
        # Con fecha emisión
        con_fecha_emision = [r for r in ordenes_relacionadas if r.fecha_emision is not None]
        print(f"   📊 Con fecha emisión: {len(con_fecha_emision)}")
        
        # En rango fecha emisión
        en_rango_emision = [r for r in con_fecha_emision 
                           if fecha_inicio <= r.fecha_emision <= fecha_fin]
        print(f"   📊 En rango fecha emisión: {len(en_rango_emision)}")
        
        if en_rango_emision:
            fechas_emision = [r.fecha_emision for r in en_rango_emision]
            print(f"   📅 Fechas emisión: {min(fechas_emision)} → {max(fechas_emision)}")
            
            # Ejemplo de órdenes
            print(f"   📝 Ejemplos:")
            for r in en_rango_emision[:5]:
                print(f"      Orden {r.order_id}: Proyecto {r.proyecto_id}, Emisión {r.fecha_emision}, ${r.total:,.0f}")
        
        # === 5. COMPARACIÓN Y ANÁLISIS ===
        print(f"\n5️⃣ ANÁLISIS COMPARATIVO:")
        
        print(f"   Vista optimizada: {len(ordenes_vista)} órdenes")
        print(f"   PO Orders created_at: {len(ordenes_po_rango)} órdenes")  
        print(f"   Logs emitida: {len(logs_emitida) if 'logs_emitida' in locals() else 0} órdenes")
        print(f"   Relación con proyectos: {len(en_rango_emision)} órdenes")
        
        # Diferencias
        if len(ordenes_vista) == len(en_rango_emision):
            print(f"   ✅ Vista optimizada coincide con relación directa")
        else:
            print(f"   ⚠️ Diferencia entre vista ({len(ordenes_vista)}) y relacion ({len(en_rango_emision)})")
        
        # Órdenes que no están en vista pero tienen fecha emisión
        if 'logs_emitida_order_ids' in locals() and ordenes_vista_ids:
            solo_en_logs = logs_emitida_order_ids - ordenes_vista_ids
            solo_en_vista = ordenes_vista_ids - logs_emitida_order_ids
            
            if solo_en_logs:
                print(f"   ⚠️ {len(solo_en_logs)} órdenes con emisión no aparecen en vista: {list(solo_en_logs)[:5]}")
                
            if solo_en_vista:
                print(f"   ⚠️ {len(solo_en_vista)} órdenes en vista sin log emisión: {list(solo_en_vista)[:5]}")
        
        # === 6. VERIFICACIÓN MANUAL MUESTRA ===
        if ordenes_vista:
            print(f"\n6️⃣ VERIFICACIÓN MANUAL (muestra):")
            
            orden_ejemplo = ordenes_vista[0]
            print(f"   📝 Ejemplo Orden {orden_ejemplo.nro_orden}:")
            print(f"      Proyecto ID: {orden_ejemplo.proyecto_id}")
            print(f"      Oportunidad ID: {orden_ejemplo.oportunidad_id}")
            print(f"      Fecha emisión: {orden_ejemplo.fecha_emision}")
            print(f"      Concepto: {orden_ejemplo.concepto_proyecto}")
            print(f"      Importe: ${orden_ejemplo.importe:,.0f}")
            
            # Verificar en po_orders
            stmt_verificar = select(PoOrder).where(PoOrder.id == orden_ejemplo.nro_orden)
            orden_original = session.exec(stmt_verificar).first()
            
            if orden_original:
                print(f"      ✅ Existe en po_orders")
                print(f"      Created at: {orden_original.created_at}")
                print(f"      Total: ${orden_original.total:,.0f}")
            else:
                print(f"      ❌ No existe en po_orders") 


def buscar_ordenes_faltantes():
    """Busca órdenes que podrían estar faltando"""
    print(f"\n=== BÚSQUEDA DE ÓRDENES FALTANTES ===")
    
    with Session(engine) as session:
        # Todas las órdenes con oportunidad_id
        stmt_todas = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
        todas_ordenes = session.exec(stmt_todas).all()
        
        print(f"📊 Total órdenes con oportunidad_id: {len(todas_ordenes)}")
        
        # Fechas de created_at
        if todas_ordenes:
            fechas_created = [o.created_at.date() for o in todas_ordenes]
            print(f"📅 Rango created_at: {min(fechas_created)} → {max(fechas_created)}")
            
            # Por año
            años = {}
            for fecha in fechas_created:
                año = fecha.year
                if año not in años:
                    años[año] = 0
                años[año] += 1
                
            for año, count in sorted(años.items()):
                print(f"   {año}: {count} órdenes")
        
        # Verificar estados
        stmt_estados = select(PoOrderStatus)
        estados = session.exec(stmt_estados).all()
        
        print(f"\n📋 Estados disponibles:")
        for estado in estados:
            print(f"   {estado.id}: {estado.nombre} (orden: {estado.orden})")
        
        # Contar por estado actual
        print(f"\n📊 Órdenes por estado actual:")
        stmt_count_estados = text("""
            SELECT os.nombre, COUNT(*) as count
            FROM po_orders o
            INNER JOIN po_order_status os ON o.order_status_id = os.id
            WHERE o.oportunidad_id IS NOT NULL
            GROUP BY os.nombre, os.id
            ORDER BY os.id
        """)
        
        result = session.exec(stmt_count_estados)
        conteo_estados = result.all()
        
        for row in conteo_estados:
            print(f"   {row.nombre}: {row.count} órdenes")


if __name__ == "__main__":
    print("🔍 VERIFICACIÓN: ¿Solo 15 órdenes en 2025-12 a 2026-03?")
    print("=" * 70)
    
    try:
        verificar_ordenes_completas()
        buscar_ordenes_faltantes()
        
        print("\n✅ Verificación completada")
        
    except Exception as e:
        print(f"\n❌ Error en verificación: {e}")
        import traceback
        traceback.print_exc()