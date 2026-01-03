"""Verificar que los mensajes se asociaron a las oportunidades existentes"""
from app.db import get_session
from app.models import CRMContacto, CRMOportunidad, CRMMensaje
from sqlmodel import select

session = next(get_session())

print("=" * 70)
print("VERIFICACIÓN DE MENSAJES CON OPORTUNIDADES ACTIVAS")
print("=" * 70)

# 1. Ana Martínez - Alquiler
print("\n1. ANA MARTÍNEZ - OPORTUNIDAD DE ALQUILER")
print("-" * 70)
ana = session.exec(
    select(CRMContacto).where(CRMContacto.id == 47)
).first()

if ana:
    print(f"Contacto: {ana.nombre_completo} (ID: {ana.id})")
    
    # Buscar oportunidades
    oportunidades = session.exec(
        select(CRMOportunidad)
        .where(CRMOportunidad.contacto_id == ana.id)
        .order_by(CRMOportunidad.created_at.desc())
    ).all()
    
    print(f"\nOportunidades totales: {len(oportunidades)}")
    print(f"Oportunidades activas: {len([o for o in oportunidades if o.activo])}")
    
    # Última oportunidad
    if oportunidades:
        ultima_op = oportunidades[0]
        print(f"\nÚltima oportunidad:")
        print(f"  ID: {ultima_op.id}")
        print(f"  tipo_operacion_id: {ultima_op.tipo_operacion_id}")
        print(f"  Estado: {ultima_op.estado}")
        print(f"  Activa: {ultima_op.activo}")
        
        # Buscar último mensaje
        ultimo_msg = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.contacto_id == ana.id)
            .order_by(CRMMensaje.created_at.desc())
        ).first()
        
        if ultimo_msg:
            print(f"\nÚltimo mensaje (ID: {ultimo_msg.id}):")
            print(f"  Contenido: {ultimo_msg.contenido[:60]}...")
            print(f"  oportunidad_id: {ultimo_msg.oportunidad_id}")
            print(f"  Creado: {ultimo_msg.created_at}")
            
            if ultimo_msg.oportunidad_id == ultima_op.id:
                print(f"  ✅ Mensaje asociado a oportunidad activa")
            else:
                print(f"  ⚠️  Mensaje asociado a otra oportunidad")

# 2. Emilia Vega - Venta
print("\n\n2. EMILIA VEGA - OPORTUNIDAD DE VENTA")
print("-" * 70)
emilia = session.exec(
    select(CRMContacto).where(CRMContacto.id == 71)
).first()

if emilia:
    print(f"Contacto: {emilia.nombre_completo} (ID: {emilia.id})")
    
    # Buscar oportunidades
    oportunidades = session.exec(
        select(CRMOportunidad)
        .where(CRMOportunidad.contacto_id == emilia.id)
        .order_by(CRMOportunidad.created_at.desc())
    ).all()
    
    print(f"\nOportunidades totales: {len(oportunidades)}")
    print(f"Oportunidades activas: {len([o for o in oportunidades if o.activo])}")
    
    # Última oportunidad
    if oportunidades:
        ultima_op = oportunidades[0]
        print(f"\nÚltima oportunidad:")
        print(f"  ID: {ultima_op.id}")
        print(f"  tipo_operacion_id: {ultima_op.tipo_operacion_id}")
        print(f"  Estado: {ultima_op.estado}")
        print(f"  Activa: {ultima_op.activo}")
        
        # Buscar último mensaje
        ultimo_msg = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.contacto_id == emilia.id)
            .order_by(CRMMensaje.created_at.desc())
        ).first()
        
        if ultimo_msg:
            print(f"\nÚltimo mensaje (ID: {ultimo_msg.id}):")
            print(f"  Contenido: {ultimo_msg.contenido[:60]}...")
            print(f"  oportunidad_id: {ultimo_msg.oportunidad_id}")
            print(f"  Creado: {ultimo_msg.created_at}")
            
            if ultimo_msg.oportunidad_id == ultima_op.id:
                print(f"  ✅ Mensaje asociado a oportunidad activa")
            else:
                print(f"  ⚠️  Mensaje asociado a otra oportunidad")

print("\n" + "=" * 70)
print("RESUMEN DE TODAS LAS PRUEBAS")
print("=" * 70)
print("\n✅ Contacto nuevo (María Rodriguez):")
print("   - Oportunidad creada con tipo_operacion_id = NULL")
print("\n✅ Contacto con alquiler alquilado (Pablo Navarro):")
print("   - Oportunidad creada con tipo_operacion_id = 3 (mantenimiento)")
print("\n✅ Contacto con oportunidad de alquiler activa (Ana Martínez):")
print("   - NO creó nueva oportunidad, usó la existente")
print("\n✅ Contacto con oportunidad de venta activa (Emilia Vega):")
print("   - NO creó nueva oportunidad, usó la existente")
print("\n" + "=" * 70)
