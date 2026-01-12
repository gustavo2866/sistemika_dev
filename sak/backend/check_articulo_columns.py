#!/usr/bin/env python3
"""Verificar columnas articulo_id en tablas PO."""

from app.core.database import engine
from sqlalchemy import inspect

def main():
    inspector = inspect(engine)
    
    print("===== VERIFICANDO CAMBIOS EN ENTIDAD ARTICULOS =====")
    
    # Verificar po_factura_detalles
    print("\n📋 Tabla: po_factura_detalles")
    try:
        cols_factura = [col['name'] for col in inspector.get_columns('po_factura_detalles')]
        has_articulo_id_factura = 'articulo_id' in cols_factura
        print(f"✅ Campo 'articulo_id' presente: {has_articulo_id_factura}")
        if has_articulo_id_factura:
            print("✅ Migración aplicada correctamente en po_factura_detalles")
        else:
            print("❌ Campo 'articulo_id' NO encontrado en po_factura_detalles")
            print(f"   Columnas presentes: {cols_factura}")
    except Exception as e:
        print(f"❌ Error verificando po_factura_detalles: {e}")
    
    # Verificar po_orden_compra_detalles  
    print("\n📋 Tabla: po_orden_compra_detalles")
    try:
        cols_orden = [col['name'] for col in inspector.get_columns('po_orden_compra_detalles')]
        has_articulo_id_orden = 'articulo_id' in cols_orden
        print(f"✅ Campo 'articulo_id' presente: {has_articulo_id_orden}")
        if has_articulo_id_orden:
            print("✅ Migración aplicada correctamente en po_orden_compra_detalles")
        else:
            print("❌ Campo 'articulo_id' NO encontrado en po_orden_compra_detalles")
            print(f"   Columnas presentes: {cols_orden}")
    except Exception as e:
        print(f"❌ Error verificando po_orden_compra_detalles: {e}")
    
    # Verificar tabla articulos
    print("\n📋 Tabla: articulos")
    try:
        if 'articulos' in inspector.get_table_names():
            articulos_count = engine.execute("SELECT COUNT(*) FROM articulos").scalar()
            print(f"✅ Tabla 'articulos' existe con {articulos_count} registros")
        else:
            print("❌ Tabla 'articulos' NO existe")
    except Exception as e:
        print(f"❌ Error verificando tabla articulos: {e}")
    
    print("\n🔍 RESUMEN:")
    print("=" * 50)
    
    # Resumen final
    tables_ok = 0
    
    try:
        if 'articulo_id' in [col['name'] for col in inspector.get_columns('po_factura_detalles')]:
            print("✅ po_factura_detalles.articulo_id - OK")
            tables_ok += 1
        else:
            print("❌ po_factura_detalles.articulo_id - FALTA")
    except:
        print("❌ po_factura_detalles - ERROR")
    
    try:
        if 'articulo_id' in [col['name'] for col in inspector.get_columns('po_orden_compra_detalles')]:
            print("✅ po_orden_compra_detalles.articulo_id - OK")
            tables_ok += 1
        else:
            print("❌ po_orden_compra_detalles.articulo_id - FALTA")
    except:
        print("❌ po_orden_compra_detalles - ERROR")
    
    if tables_ok == 2:
        print("\n🎉 TODAS LAS MIGRACIONES DE ARTÍCULOS SE APLICARON CORRECTAMENTE")
    else:
        print(f"\n⚠️  FALTAN APLICAR MIGRACIONES: {2-tables_ok} de 2 tablas sin actualizar")

if __name__ == "__main__":
    main()