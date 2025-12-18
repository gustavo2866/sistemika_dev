from sqlmodel import Session, select
from app.models import Propiedad
from app.db import engine

session = Session(engine)
prop = session.exec(select(Propiedad).limit(1)).first()
if prop:
    print(f"✅ Propiedad ID: {prop.id}")
else:
    print("❌ No hay propiedades")
session.close()
