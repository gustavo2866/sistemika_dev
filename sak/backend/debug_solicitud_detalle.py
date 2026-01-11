import os
import sys
sys.path.append('.')

try:
    from app.db import get_session
    from sqlmodel import select
    from app.models.compras import PoSolicitudDetalle
    
    print("Modules imported successfully")
    
    # Verificar conexión
    with next(get_session()) as session:
        print("Database connection established")
        
        # Verificar si existe el registro con ID 16
        detalle = session.get(PoSolicitudDetalle, 16)
        if detalle:
            print(f'Detalle encontrado: ID={detalle.id}, descripcion={detalle.descripcion}')
        else:
            print('Detalle con ID 16 NO existe')
            
        # Mostrar todos los detalles disponibles
        detalles = session.exec(select(PoSolicitudDetalle)).all()
        print(f'Total detalles en la tabla: {len(detalles)}')
        if detalles:
            print(f'IDs disponibles: {[d.id for d in detalles]}')
            print(f'Último detalle: ID={detalles[-1].id}, desc={detalles[-1].descripcion[:30]}...')
        else:
            print('No hay detalles en la tabla')
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()