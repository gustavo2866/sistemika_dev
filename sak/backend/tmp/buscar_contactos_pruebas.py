"""Buscar contactos con propiedades en venta y en alquiler disponible para pruebas"""
from app.db import get_session
from app.models import CRMContacto, Propiedad, CRMOportunidad
from sqlmodel import select

session = next(get_session())

print("=" * 70)
print("CONTACTOS CON PROPIEDADES PARA PRUEBAS")
print("=" * 70)

# 1. Buscar contacto con propiedad EN VENTA
print("\n1. PROPIEDADES EN VENTA CON CONTACTO:")
print("-" * 70)
props_venta = session.exec(
    select(Propiedad).where(
        Propiedad.tipo_operacion_id == 2,  # Venta
        Propiedad.contacto_id.isnot(None),
        Propiedad.estado.in_(["3-disponible", "2-en_reparacion"])
    ).limit(5)
).all()

if props_venta:
    for p in props_venta:
        contacto = session.get(CRMContacto, p.contacto_id)
        telefono = contacto.telefonos[0] if contacto.telefonos else "sin teléfono"
        print(f"  - Propiedad: {p.nombre} (ID: {p.id}, estado: {p.estado})")
        print(f"    Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
        print(f"    Teléfono: {telefono}")
        print()
else:
    print("  ❌ No se encontraron propiedades en venta con contacto")

# 2. Buscar contacto con propiedad EN ALQUILER DISPONIBLE (no alquilada)
print("\n2. PROPIEDADES EN ALQUILER DISPONIBLE CON CONTACTO:")
print("-" * 70)
props_alquiler_disp = session.exec(
    select(Propiedad).where(
        Propiedad.tipo_operacion_id == 1,  # Alquiler
        Propiedad.contacto_id.isnot(None),
        Propiedad.estado == "3-disponible"  # Disponible, no alquilada
    ).limit(5)
).all()

if props_alquiler_disp:
    for p in props_alquiler_disp:
        contacto = session.get(CRMContacto, p.contacto_id)
        telefono = contacto.telefonos[0] if contacto.telefonos else "sin teléfono"
        print(f"  - Propiedad: {p.nombre} (ID: {p.id}, estado: {p.estado})")
        print(f"    Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
        print(f"    Teléfono: {telefono}")
        print()
else:
    print("  ❌ No se encontraron propiedades en alquiler disponible con contacto")

# 3. Verificar Pablo Navarro (alquiler alquilada - ya probado)
print("\n3. PROPIEDAD EN ALQUILER ALQUILADA (YA PROBADA):")
print("-" * 70)
print("  - Propiedad: Torre Palermo (ID: 4, estado: 4-alquilada)")
print("    Contacto: Pablo Navarro (ID: 66)")
print("    Teléfono: 11-6265-2312")
print("    ✅ Ya probado exitosamente")
