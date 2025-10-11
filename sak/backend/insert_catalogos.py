"""Script simple para insertar catálogos básicos"""
from sqlmodel import Session, text, select
from app.db import engine
from app.models import TipoComprobante, MetodoPago

with Session(engine) as session:
    # Tipos de comprobante
    print("Insertando tipos de comprobante...")
    nombres = ["Factura A", "Factura B", "Factura C", "Nota de Crédito A", "Nota de Débito A"]
    for nombre in nombres:
        existing = session.exec(select(TipoComprobante).where(TipoComprobante.name == nombre)).first()
        if not existing:
            tc = TipoComprobante(name=nombre)
            session.add(tc)
            print(f"  ✅ {nombre}")
        else:
            print(f"  ⚠️  Ya existe: {nombre}")
    
    # Métodos de pago
    print("\nInsertando métodos de pago...")
    metodos = ["Efectivo", "Transferencia", "Cheque", "Tarjeta de Crédito", "Tarjeta de Débito"]
    for metodo in metodos:
        existing = session.exec(select(MetodoPago).where(MetodoPago.nombre == metodo)).first()
        if not existing:
            mp = MetodoPago(nombre=metodo)
            session.add(mp)
            print(f"  ✅ {metodo}")
        else:
            print(f"  ⚠️  Ya existe: {metodo}")
    
    session.commit()
    print("\n✅ Catálogos insertados")
