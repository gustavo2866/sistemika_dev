from sqlmodel import Session
from app.models.tipo_propiedad import TipoPropiedad
from app.db import engine

TIPOS = [
    {"nombre": "Departamento", "descripcion": "Vivienda en edificio", "activo": True},
    {"nombre": "Casa", "descripcion": "Vivienda unifamiliar", "activo": True},
    {"nombre": "PH", "descripcion": "Propiedad horizontal", "activo": True},
    {"nombre": "Terreno", "descripcion": "Lote o terreno", "activo": True},
    {"nombre": "Cochera", "descripcion": "Espacio para auto", "activo": True},
]

def poblar_tipos_propiedad():
    from sqlmodel import select
    with Session(engine) as session:
        for tipo in TIPOS:
            existe = session.exec(
                select(TipoPropiedad).where(TipoPropiedad.nombre == tipo["nombre"])
            ).first()
            if not existe:
                session.add(TipoPropiedad(**tipo))
        session.commit()
        print("Tipos de propiedad cargados correctamente.")

if __name__ == "__main__":
    poblar_tipos_propiedad()
