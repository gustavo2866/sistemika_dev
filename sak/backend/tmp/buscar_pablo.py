"""Script para buscar contacto Pablo Navarro y sus propiedades"""
from app.db import get_session
from app.models import CRMContacto, Propiedad
from sqlmodel import select

session = next(get_session())

# Buscar Pablo Navarro
contacto = session.exec(
    select(CRMContacto).where(CRMContacto.nombre_completo.ilike('%pablo%navarro%'))
).first()

if contacto:
    print(f"Contacto encontrado:")
    print(f"  ID: {contacto.id}")
    print(f"  Nombre: {contacto.nombre_completo}")
    print(f"  Telefonos: {contacto.telefonos}")
    
    # Buscar propiedades
    propiedades = session.exec(
        select(Propiedad).where(Propiedad.contacto_id == contacto.id)
    ).all()
    
    print(f"\nPropiedades ({len(propiedades)}):")
    for p in propiedades:
        print(f"  - ID {p.id}: {p.nombre}")
        print(f"    tipo_operacion_id: {p.tipo_operacion_id}")
        print(f"    estado: {p.estado}")
        print(f"    activo: {p.activo}")
else:
    print("Contacto Pablo Navarro no encontrado")
