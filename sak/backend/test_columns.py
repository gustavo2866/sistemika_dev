#!/usr/bin/env python
"""Test simple para verificar que las columnas existan"""

import os
from dotenv import load_dotenv
load_dotenv()

import sqlalchemy as sa
from sqlalchemy import text

# Crear conexión directa
DATABASE_URL = os.getenv("DATABASE_URL")
engine = sa.create_engine(DATABASE_URL)

def test_columns():
    print("Testing database columns...")
    
    try:
        with engine.connect() as conn:
            # Test simple query
            result = conn.execute(text("SELECT centro_costo_id, tipo_solicitud_id FROM po_ordenes_compra LIMIT 1"))
            print("✓ Columns centro_costo_id and tipo_solicitud_id exist in po_ordenes_compra")
            
            result2 = conn.execute(text("SELECT cantidad_recibida, cantidad_facturada, centro_costo_id FROM po_orden_compra_detalles LIMIT 1"))
            print("✓ Columns cantidad_recibida, cantidad_facturada, centro_costo_id exist in po_orden_compra_detalles")
            
            result3 = conn.execute(text("SELECT centro_costo_id, tipo_solicitud_id FROM po_facturas LIMIT 1"))
            print("✓ Columns centro_costo_id and tipo_solicitud_id exist in po_facturas")
            
            print("All columns exist successfully!")
            
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_columns()