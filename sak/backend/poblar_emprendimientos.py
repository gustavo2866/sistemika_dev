from sqlmodel import Session
from app.models.emprendimiento import Emprendimiento
from app.db import engine

EMPRENDIMIENTOS = [
    {"nombre": "Torre Central", "descripcion": "Edificio de oficinas premium", "activo": True},
    {"nombre": "Barrio Norte", "descripcion": "Complejo residencial en zona norte", "activo": True},
    {"nombre": "Puerto Madero Suites", "descripcion": "Departamentos de lujo en Puerto Madero", "activo": True},
]

def poblar_emprendimientos():
    from sqlmodel import select
    with Session(engine) as session:
        for emp in EMPRENDIMIENTOS:
            existe = session.exec(
                select(Emprendimiento).where(Emprendimiento.nombre == emp["nombre"])
            ).first()
            if not existe:
                session.add(Emprendimiento(**emp))
        session.commit()
        print("Emprendimientos cargados correctamente.")

if __name__ == "__main__":
    poblar_emprendimientos()
