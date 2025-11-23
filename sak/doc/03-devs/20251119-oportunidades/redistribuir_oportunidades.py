"""
Redistribuir oportunidades existentes entre todos los contactos
"""
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMContacto, CRMOportunidad
import random

def redistribuir_oportunidades():
    session = Session(engine)
    
    # Obtener todos los contactos
    contactos = session.exec(select(CRMContacto)).all()
    contactos_ids = [c.id for c in contactos]
    
    # Obtener todas las oportunidades
    oportunidades = session.exec(select(CRMOportunidad)).all()
    
    print(f"\n📊 Estado actual:")
    print(f"   - Contactos: {len(contactos)}")
    print(f"   - Oportunidades: {len(oportunidades)}")
    
    # Contar oportunidades por contacto ANTES
    print(f"\n📋 Distribución ANTES:")
    dist_antes = {}
    for opp in oportunidades:
        dist_antes[opp.contacto_id] = dist_antes.get(opp.contacto_id, 0) + 1
    
    for contacto_id, count in sorted(dist_antes.items(), key=lambda x: x[1], reverse=True)[:10]:
        contacto = session.get(CRMContacto, contacto_id)
        print(f"   - {contacto.nombre_completo[:30]:<30}: {count} oportunidades")
    
    print(f"\n🔄 Redistribuyendo oportunidades...\n")
    
    actualizadas = 0
    for opp in oportunidades:
        # Asignar contacto aleatorio
        nuevo_contacto_id = random.choice(contactos_ids)
        
        if opp.contacto_id != nuevo_contacto_id:
            opp.contacto_id = nuevo_contacto_id
            actualizadas += 1
    
    session.commit()
    
    # Contar oportunidades por contacto DESPUÉS
    oportunidades = session.exec(select(CRMOportunidad)).all()
    dist_despues = {}
    for opp in oportunidades:
        dist_despues[opp.contacto_id] = dist_despues.get(opp.contacto_id, 0) + 1
    
    print(f"\n📋 Distribución DESPUÉS:")
    for contacto_id, count in sorted(dist_despues.items(), key=lambda x: x[1], reverse=True)[:10]:
        contacto = session.get(CRMContacto, contacto_id)
        print(f"   - {contacto.nombre_completo[:30]:<30}: {count} oportunidades")
    
    print(f"\n{'='*70}")
    print(f"✅ Actualizadas: {actualizadas} oportunidades")
    print(f"📊 Promedio: {len(oportunidades) / len(contactos):.1f} oportunidades por contacto")
    print(f"{'='*70}")
    
    session.close()

if __name__ == "__main__":
    print("="*70)
    print("REDISTRIBUCIÓN DE OPORTUNIDADES")
    print("="*70)
    redistribuir_oportunidades()
