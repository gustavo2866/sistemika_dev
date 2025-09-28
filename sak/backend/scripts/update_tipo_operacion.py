from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from app.models import TipoOperacion

load_dotenv()
engine = create_engine(os.environ['DATABASE_URL'])

with Session(engine) as session:
    tipos = list(session.execute(select(TipoOperacion)).scalars())
    if len(tipos) < 1:
        session.add(TipoOperacion(codigo='AUTO', descripcion='Operacion requiere propiedad', requiere_propiedad=True))
    if len(tipos) < 2:
        session.add(TipoOperacion(codigo='SERV', descripcion='Operacion sin propiedad', requiere_propiedad=False))
    session.commit()
    tipos = list(session.execute(select(TipoOperacion)).scalars())
    if tipos:
        tipos[0].requiere_propiedad = True
    if len(tipos) > 1:
        tipos[1].requiere_propiedad = False
    session.commit()
