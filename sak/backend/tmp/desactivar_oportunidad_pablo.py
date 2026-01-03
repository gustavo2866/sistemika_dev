"""Desactivar oportunidad actual de Pablo Navarro para probar creación nueva"""
from app.db import get_session
from app.models import CRMContacto, CRMOportunidad
from sqlmodel import select

session = next(get_session())

# Buscar Pablo Navarro
contacto = session.exec(
    select(CRMContacto).where(CRMContacto.nombre_completo.ilike('%pablo%navarro%'))
).first()

if contacto:
    # Buscar oportunidades activas
    oportunidades = session.exec(
        select(CRMOportunidad)
        .where(
            CRMOportunidad.contacto_id == contacto.id,
            CRMOportunidad.activo == True
        )
    ).all()
    
    print(f"Oportunidades activas encontradas: {len(oportunidades)}")
    
    for op in oportunidades:
        print(f"\nDesactivando oportunidad ID {op.id}")
        print(f"  Título: {op.titulo}")
        print(f"  tipo_operacion_id: {op.tipo_operacion_id}")
        print(f"  Estado: {op.estado}")
        
        op.activo = False
        session.add(op)
    
    session.commit()
    print("\n✅ Oportunidades desactivadas. Ahora puedes probar el webhook nuevamente.")
else:
    print("❌ Contacto no encontrado")
