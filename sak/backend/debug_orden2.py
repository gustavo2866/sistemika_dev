from app.db import engine
from app.models.compras import PoOrdenCompra, PoOrdenCompraDetalle
from sqlmodel import select, Session

with Session(engine) as session:
    # Verificar si existe una orden de compra con id=2
    orden = session.exec(select(PoOrdenCompra).where(PoOrdenCompra.id == 2)).first()
    if orden:
        print(f'Orden ID=2 encontrada: {orden.numero}')
        detalles = session.exec(select(PoOrdenCompraDetalle).where(PoOrdenCompraDetalle.orden_compra_id == 2)).all()
        print(f'Cantidad de detalles: {len(detalles)}')
        for detalle in detalles:
            print(f'  - ID: {detalle.id}, Descripcion: {detalle.descripcion[:50]}...')
            print(f'    Articulo ID: {detalle.solicitud_detalle_id}')
    else:
        print('No existe orden de compra con ID=2')
    
    # También verificar todas las ordenes disponibles
    print("\nTodas las órdenes de compra:")
    ordenes = session.exec(select(PoOrdenCompra)).all()
    for orden in ordenes:
        print(f'  - ID: {orden.id}, Numero: {orden.numero}')