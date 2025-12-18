from sqlmodel import Session
from app.models import CRMMensaje, CRMOportunidad
from app.db import engine

session = Session(engine)
msg5 = session.get(CRMMensaje, 5)
print(f"✅ Mensaje 5:")
print(f"   Estado: {msg5.estado}")
print(f"   Oportunidad ID: {msg5.oportunidad_id}")

if msg5.oportunidad_id:
    opp = session.get(CRMOportunidad, msg5.oportunidad_id)
    print(f"\n✅ Oportunidad {opp.id}:")
    print(f"   Estado: {opp.estado}")
    print(f"   Contacto: {opp.contacto_id}")
    print(f"   Responsable: {opp.responsable_id}")
    print(f"   Propiedad: {opp.propiedad_id}")
    print(f"   Activo: {opp.activo}")

session.close()
