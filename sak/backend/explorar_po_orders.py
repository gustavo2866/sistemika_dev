#!/usr/bin/env python3

from sqlmodel import select, text
from app.db import get_session
from app.models.tipo_solicitud import TipoSolicitud
from app.models.compras import PoOrder
from app.models.proyecto import Proyecto

def explorar_estructura_po_orders():
    """Explora la estructura de po_orders y tipos_solicitud para entender los datos"""
    
    with next(get_session()) as db:
        print("=== EXPLORACIÓN ESTRUCTURA PO_ORDERS ===\n")
        
        # Ver tipos de solicitud existentes
        print("📋 TIPOS DE SOLICITUD:")
        tipos = db.exec(select(TipoSolicitud)).all()
        for tipo in tipos:
            print(f"  - ID {tipo.id}: {tipo.nombre} - {tipo.descripcion}")
        
        # Ver estructura de po_orders
        print(f"\n📊 ESTRUCTURA PO_ORDERS:")
        result = db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'po_orders' ORDER BY column_name"))
        columns = result.fetchall()
        
        for col_name, col_type in columns:
            print(f"  - {col_name}: {col_type}")
        
        # Ver si hay alguna conexión con proyectos
        print(f"\n🔍 BUSCANDO CONEXIÓN CON PROYECTOS:")
        po_sample = db.exec(select(PoOrder).limit(5)).all()
        
        for po in po_sample:
            print(f"  PO ID {po.id}: {po.titulo} - Tipo: {po.tipo_solicitud_id} - Depto: {po.departamento_id}")
        
        # Verificar si departamentos podrían ser proyectos
        print(f"\n🏢 DEPARTAMENTOS EN PO_ORDERS:")
        result = db.execute(text("""
            SELECT DISTINCT departamento_id, COUNT(*) as count 
            FROM po_orders 
            WHERE departamento_id IS NOT NULL 
            GROUP BY departamento_id 
            ORDER BY departamento_id
        """))
        
        dept_counts = result.fetchall()
        for dept_id, count in dept_counts:
            print(f"  - Departamento {dept_id}: {count} órdenes")
        
        # Ver algunos proyectos para comparar
        print(f"\n📋 PROYECTOS (sample):")
        proyectos = db.exec(select(Proyecto).limit(10)).all()
        for p in proyectos:
            print(f"  - ID {p.id}: {p.nombre} - Centro costo: {p.centro_costo}")

if __name__ == "__main__":
    explorar_estructura_po_orders()