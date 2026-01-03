"""Verificar resultados de las pruebas ejecutadas"""
from app.db import get_session
from app.models import CRMContacto, CRMOportunidad, CRMMensaje
from sqlmodel import select

session = next(get_session())

print("=" * 70)
print("RESULTADOS DE PRUEBAS")
print("=" * 70)

# PRUEBA 1: María Rodriguez (contacto nuevo)
print("\n1. CONTACTO NUEVO: María Rodriguez")
print("-" * 70)
maria = session.exec(
    select(CRMContacto).where(CRMContacto.nombre_completo.ilike('%maría%rodriguez%'))
).first()

if maria:
    print(f"✅ Contacto creado - ID: {maria.id}")
    print(f"   Teléfonos: {maria.telefonos}")
    
    oportunidades = session.exec(
        select(CRMOportunidad)
        .where(CRMOportunidad.contacto_id == maria.id)
        .order_by(CRMOportunidad.created_at.desc())
    ).all()
    
    if oportunidades:
        op = oportunidades[0]
        print(f"\n   Oportunidad ID: {op.id}")
        print(f"   tipo_operacion_id: {op.tipo_operacion_id}")
        
        if op.tipo_operacion_id is None:
            print("   ✅ CORRECTO: tipo_operacion_id = NULL (sin propiedades)")
        else:
            print(f"   ❌ ERROR: tipo_operacion_id = {op.tipo_operacion_id} (esperaba NULL)")
    else:
        print("   ⚠️  No se encontró oportunidad")
else:
    print("⚠️  Contacto no encontrado - prueba no ejecutada")

# PRUEBA 2: Último contacto con mensaje nuevo (debería tener alquiler)
print("\n\n2. ÚLTIMAS 3 OPORTUNIDADES CREADAS (ordenadas por fecha)")
print("-" * 70)

ultimas_oportunidades = session.exec(
    select(CRMOportunidad)
    .where(CRMOportunidad.titulo == "Nueva oportunidad desde WhatsApp")
    .order_by(CRMOportunidad.created_at.desc())
    .limit(3)
).all()

for i, op in enumerate(ultimas_oportunidades, 1):
    contacto = session.get(CRMContacto, op.contacto_id)
    
    # Buscar último mensaje
    ultimo_msg = session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.oportunidad_id == op.id)
        .order_by(CRMMensaje.created_at.desc())
    ).first()
    
    print(f"\n{i}. Oportunidad ID {op.id} - Creada: {op.created_at}")
    print(f"   Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
    print(f"   tipo_operacion_id: {op.tipo_operacion_id}")
    
    if ultimo_msg:
        print(f"   Mensaje: {ultimo_msg.contenido[:60]}...")
    
    # Verificar si tiene propiedades en alquiler
    from app.models import Propiedad
    props_alquiler = session.exec(
        select(Propiedad).where(
            Propiedad.contacto_id == contacto.id,
            Propiedad.tipo_operacion_id == 1,
            Propiedad.estado.in_(["3-disponible", "4-alquilada"])
        )
    ).all()
    
    if props_alquiler:
        print(f"   Propiedades en alquiler: {len(props_alquiler)}")
        for p in props_alquiler:
            print(f"     - {p.nombre} (estado: {p.estado})")
        
        if op.tipo_operacion_id == 3:
            print("   ✅ CORRECTO: tipo_operacion_id = 3 (tiene alquiler)")
        else:
            print(f"   ❌ ERROR: tipo_operacion_id = {op.tipo_operacion_id} (esperaba 3)")
    else:
        print(f"   Sin propiedades en alquiler")
        if op.tipo_operacion_id is None:
            print("   ✅ CORRECTO: tipo_operacion_id = NULL (sin alquiler)")
        else:
            print(f"   ❌ ERROR: tipo_operacion_id = {op.tipo_operacion_id} (esperaba NULL)")

print("\n" + "=" * 70)
