from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Verificar po_orden_compra_detalles para codigo_producto
    print("=== PoOrdenCompraDetalle - codigo_producto ===")
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'po_orden_compra_detalles' 
        AND column_name = 'codigo_producto'
    """))
    columns_detalle = [row[0] for row in result]
    print(f"Columnas encontradas: {columns_detalle}")
    
    if not columns_detalle:
        print("✅ codigo_producto eliminado correctamente")
    else:
        print("❌ codigo_producto aún existe en la base de datos")