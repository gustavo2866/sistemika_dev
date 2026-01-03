"""Verificar la oportunidad creada para Pablo Navarro"""
from app.db import get_session
from app.models import CRMContacto, CRMOportunidad, CRMMensaje
from sqlmodel import select

session = next(get_session())

# Buscar Pablo Navarro
contacto = session.exec(
    select(CRMContacto).where(CRMContacto.nombre_completo.ilike('%pablo%navarro%'))
).first()

if contacto:
    print("=" * 60)
    print("CONTACTO PABLO NAVARRO")
    print("=" * 60)
    print(f"ID: {contacto.id}")
    print(f"Nombre: {contacto.nombre_completo}")
    print(f"Teléfonos: {contacto.telefonos}")
    
    # Buscar oportunidades
    print("\n" + "=" * 60)
    print("OPORTUNIDADES")
    print("=" * 60)
    
    oportunidades = session.exec(
        select(CRMOportunidad)
        .where(CRMOportunidad.contacto_id == contacto.id)
        .order_by(CRMOportunidad.created_at.desc())
    ).all()
    
    print(f"Total: {len(oportunidades)}\n")
    
    for i, op in enumerate(oportunidades, 1):
        print(f"{i}. Oportunidad ID {op.id}:")
        print(f"   Título: {op.titulo}")
        print(f"   tipo_operacion_id: {op.tipo_operacion_id}")
        print(f"   Estado: {op.estado}")
        print(f"   Activo: {op.activo}")
        print(f"   Creada: {op.created_at}")
        print()
    
    # Mostrar última oportunidad con detalle
    if oportunidades:
        ultima = oportunidades[0]
        print("=" * 60)
        print("ÚLTIMA OPORTUNIDAD (MÁS RECIENTE)")
        print("=" * 60)
        print(f"ID: {ultima.id}")
        print(f"tipo_operacion_id: {ultima.tipo_operacion_id}")
        
        if ultima.tipo_operacion_id == 3:
            print("✅ CORRECTO: Se asignó tipo_operacion_id=3 (mantenimiento)")
        elif ultima.tipo_operacion_id is None:
            print("❌ ERROR: tipo_operacion_id es None (debería ser 3)")
        else:
            print(f"❌ ERROR: tipo_operacion_id={ultima.tipo_operacion_id} (debería ser 3)")
    
    # Buscar mensajes recientes
    print("\n" + "=" * 60)
    print("ÚLTIMOS 3 MENSAJES")
    print("=" * 60)
    
    mensajes = session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.contacto_id == contacto.id)
        .order_by(CRMMensaje.created_at.desc())
        .limit(3)
    ).all()
    
    for i, msg in enumerate(mensajes, 1):
        print(f"{i}. Mensaje ID {msg.id}:")
        print(f"   Contenido: {msg.contenido[:50]}...")
        print(f"   oportunidad_id: {msg.oportunidad_id}")
        print(f"   Creado: {msg.created_at}")
        print()
else:
    print("❌ Contacto no encontrado")
