from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from app.models.propiedad import DEFAULT_PROPIEDADES
from app.models import Propiedad

load_dotenv()
engine = create_engine(os.environ['DATABASE_URL'])

with Session(engine) as session:
    for prop_id, nombre, tipo, propietario, estado in DEFAULT_PROPIEDADES:
        existing = session.get(Propiedad, prop_id)
        if existing:
            existing.nombre = nombre
            existing.tipo = tipo
            existing.propietario = propietario
            existing.estado = estado
        else:
            session.add(Propiedad(id=prop_id, nombre=nombre, tipo=tipo, propietario=propietario, estado=estado))
    session.commit()
