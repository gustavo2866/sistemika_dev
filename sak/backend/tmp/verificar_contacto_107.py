"""
Verificar contacto de la oportunidad 107 y filtro
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMOportunidad, CRMContacto

with Session(engine) as session:
    # Obtener oportunidad 107
    oportunidad = session.get(CRMOportunidad, 107)
    
    if oportunidad:
        print(f"\n=== OPORTUNIDAD 107 ===")
        print(f"ID: {oportunidad.id}")
        print(f"Título: {oportunidad.titulo}")
        print(f"Contacto ID: {oportunidad.contacto_id}")
        
        # Obtener datos del contacto
        if oportunidad.contacto_id:
            contacto = session.get(CRMContacto, oportunidad.contacto_id)
            if contacto:
                print(f"\n=== CONTACTO #{oportunidad.contacto_id} ===")
                print(f"Nombre Completo: {contacto.nombre_completo}")
                print(f"Teléfonos: {contacto.telefonos}")
                print(f"Email: {contacto.email}")
                print(f"Responsable ID: {contacto.responsable_id}")
        
        # Buscar contactos con nombre 'Gustavo'
        print(f"\n=== CONTACTOS CON 'GUSTAVO' EN EL NOMBRE ===")
        stmt = select(CRMContacto).where(
            CRMContacto.nombre_completo.ilike("%gustavo%")
        )
        contactos_gustavo = session.exec(stmt).all()
        
        print(f"Total encontrados: {len(contactos_gustavo)}")
        for contacto in contactos_gustavo:
            print(f"  - ID: {contacto.id}, Nombre: {contacto.nombre_completo}")
            
            # Buscar oportunidades de este contacto
            stmt_op = select(CRMOportunidad).where(
                CRMOportunidad.contacto_id == contacto.id
            )
            oportunidades = session.exec(stmt_op).all()
            print(f"    Oportunidades: {[op.id for op in oportunidades]}")
