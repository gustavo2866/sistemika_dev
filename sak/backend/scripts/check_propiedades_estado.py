from app.models.propiedad import Propiedad
from sqlmodel import Session, select
from app.db import engine

with Session(engine) as session:
    # Contar todas las propiedades
    total = session.exec(select(Propiedad)).all()
    print(f"Total propiedades: {len(total)}")
    
    # Propiedades por estado
    estados = {}
    for p in total:
        estados[p.estado] = estados.get(p.estado, 0) + 1
    
    print("\nPropiedades por estado:")
    for estado, count in sorted(estados.items()):
        print(f"  {estado}: {count}")
    
    # Propiedades con estado 4-realizada
    result = session.exec(select(Propiedad).where(Propiedad.estado == '4-realizada')).all()
    print(f"\nPropiedades con estado '4-realizada': {len(result)}")
    for p in result[:5]:
        print(f"  - {p.id}: {p.nombre} (estado: {p.estado})")
