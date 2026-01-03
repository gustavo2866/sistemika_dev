"""Script para verificar logs y ejecutar el proceso paso a paso"""
from app.db import get_session
from app.models import CRMContacto, Propiedad
from sqlmodel import select

session = next(get_session())

# 1. Buscar Pablo Navarro
print("=" * 60)
print("1. BUSCAR CONTACTO PABLO NAVARRO")
print("=" * 60)

contacto = session.exec(
    select(CRMContacto).where(CRMContacto.nombre_completo.ilike('%pablo%navarro%'))
).first()

if not contacto:
    print("❌ Contacto no encontrado")
    print("\nBuscando por teléfono +5491162652312...")
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import cast
    
    stmt = select(CRMContacto).where(
        cast(CRMContacto.telefonos, JSONB).op('@>')(
            cast(["+5491162652312"], JSONB)
        )
    )
    contacto = session.exec(stmt).first()

if contacto:
    print(f"✅ Contacto encontrado:")
    print(f"   ID: {contacto.id}")
    print(f"   Nombre: {contacto.nombre_completo}")
    print(f"   Teléfonos: {contacto.telefonos}")
    
    # 2. Buscar propiedades
    print("\n" + "=" * 60)
    print("2. BUSCAR PROPIEDADES DEL CONTACTO")
    print("=" * 60)
    
    propiedades = session.exec(
        select(Propiedad).where(Propiedad.contacto_id == contacto.id)
    ).all()
    
    print(f"Total propiedades: {len(propiedades)}\n")
    
    for p in propiedades:
        print(f"Propiedad ID {p.id}:")
        print(f"  Nombre: {p.nombre}")
        print(f"  tipo_operacion_id: {p.tipo_operacion_id}")
        print(f"  Estado: {p.estado}")
        print()
    
    # 3. Simular lógica de determinación
    print("=" * 60)
    print("3. SIMULAR LÓGICA DE DETERMINACIÓN")
    print("=" * 60)
    
    stmt_alquiler = select(Propiedad).where(
        Propiedad.contacto_id == contacto.id,
        Propiedad.tipo_operacion_id == 1,  # Alquiler
        Propiedad.estado.in_(["3-disponible", "4-alquilada"])
    )
    prop_alquiler = session.exec(stmt_alquiler).first()
    
    if prop_alquiler:
        print(f"✅ Encontrada propiedad en alquiler:")
        print(f"   ID: {prop_alquiler.id}")
        print(f"   Nombre: {prop_alquiler.nombre}")
        print(f"   → tipo_operacion_id para oportunidad: 3 (mantenimiento)")
    else:
        print("❌ No se encontró propiedad en alquiler operativa")
        print("   → tipo_operacion_id para oportunidad: None")
        
else:
    print("❌ Contacto Pablo Navarro no encontrado en la base de datos")
    print("   El webhook creará un nuevo contacto")
