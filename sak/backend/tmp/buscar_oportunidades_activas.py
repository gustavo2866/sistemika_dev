"""Buscar OPORTUNIDADES activas de alquiler y venta para pruebas"""
from app.db import get_session
from app.models import CRMContacto, CRMOportunidad
from sqlmodel import select

session = next(get_session())

print("=" * 70)
print("OPORTUNIDADES ACTIVAS PARA PRUEBAS")
print("=" * 70)

# 1. Oportunidades de ALQUILER activas
print("\n1. OPORTUNIDADES ACTIVAS DE ALQUILER (tipo_operacion_id=1):")
print("-" * 70)
ops_alquiler = session.exec(
    select(CRMOportunidad).where(
        CRMOportunidad.tipo_operacion_id == 1,  # Alquiler
        CRMOportunidad.activo == True
    ).limit(5)
).all()

if ops_alquiler:
    for op in ops_alquiler:
        contacto = session.get(CRMContacto, op.contacto_id)
        telefono = contacto.telefonos[0] if contacto.telefonos else "sin teléfono"
        print(f"  - Oportunidad ID: {op.id}")
        print(f"    Título: {op.titulo}")
        print(f"    Estado: {op.estado}")
        print(f"    Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
        print(f"    Teléfono: {telefono}")
        print()
else:
    print("  ❌ No se encontraron oportunidades de alquiler activas")

# 2. Oportunidades de VENTA activas
print("\n2. OPORTUNIDADES ACTIVAS DE VENTA (tipo_operacion_id=2):")
print("-" * 70)
ops_venta = session.exec(
    select(CRMOportunidad).where(
        CRMOportunidad.tipo_operacion_id == 2,  # Venta
        CRMOportunidad.activo == True
    ).limit(5)
).all()

if ops_venta:
    for op in ops_venta:
        contacto = session.get(CRMContacto, op.contacto_id)
        telefono = contacto.telefonos[0] if contacto.telefonos else "sin teléfono"
        print(f"  - Oportunidad ID: {op.id}")
        print(f"    Título: {op.titulo}")
        print(f"    Estado: {op.estado}")
        print(f"    Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
        print(f"    Teléfono: {telefono}")
        print()
else:
    print("  ❌ No se encontraron oportunidades de venta activas")

# 3. Contacto nuevo (ya probado)
print("\n3. CONTACTO NUEVO (YA PROBADO):")
print("-" * 70)
print("  - Contacto: María Rodriguez")
print("    Teléfono: 11-9999-8888")
print("    Esperado: tipo_operacion_id = NULL")
print("    ✅ Webhook procesado exitosamente")
