from sqlmodel import Session
from app.models import CRMMensaje
from app.db import engine

session = Session(engine)
msg = session.get(CRMMensaje, 5)
if msg:
    print(f"✅ Mensaje 5 existe")
    print(f"   ID: {msg.id}")
    print(f"   Contacto ID: {msg.contacto_id}")
    print(f"   Contacto Ref: {msg.contacto_referencia}")
    print(f"   Contenido: {msg.contenido[:50] if msg.contenido else None}")
else:
    print("❌ Mensaje 5 NO EXISTE")

session.close()
