from app.db import get_session
from sqlmodel import select
from app.models.compras import PoSolicitudDetalle

# Verificar si existe el registro con ID 16
with next(get_session()) as session:
    detalle = session.get(PoSolicitudDetalle, 16)
    if detalle:
        print(f'Detalle encontrado: ID={detalle.id}')
    else:
        print('Detalle con ID 16 NO existe')
        
    # Mostrar todos los detalles disponibles
    detalles = session.exec(select(PoSolicitudDetalle)).all()
    print(f'Detalles existentes: {[d.id for d in detalles]}')