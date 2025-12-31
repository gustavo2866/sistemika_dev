"""
Script para verificar el estado de los mensajes de un contacto
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_mensaje import CRMMensaje
from app.models.crm_contacto import CRMContacto
from app.models.crm_oportunidad import CRMOportunidad


def verificar_mensajes_contacto(nombre_contacto: str):
    """Verifica el estado de mensajes de un contacto por nombre"""
    
    with Session(engine) as session:
        # Buscar contacto por nombre
        stmt = select(CRMContacto).where(CRMContacto.nombre_completo.ilike(f"%{nombre_contacto}%"))
        contacto = session.exec(stmt).first()
        
        if not contacto:
            print(f"❌ No se encontró contacto con nombre '{nombre_contacto}'")
            return
        
        print(f"✅ Contacto encontrado: {contacto.nombre_completo} (ID: {contacto.id})")
        print(f"   Teléfonos: {contacto.telefonos}")
        
        # Buscar mensajes del contacto
        stmt_mensajes = select(CRMMensaje).where(
            CRMMensaje.contacto_id == contacto.id
        ).order_by(CRMMensaje.fecha_mensaje.desc())
        
        mensajes = session.exec(stmt_mensajes).all()
        
        print(f"\n📨 Mensajes encontrados: {len(mensajes)}\n")
        
        for msg in mensajes:
            print(f"Mensaje ID {msg.id}:")
            print(f"  - Tipo: {msg.tipo}")
            print(f"  - Estado: {msg.estado}")
            print(f"  - Contenido: {msg.contenido[:50]}...")
            print(f"  - Oportunidad ID: {msg.oportunidad_id}")
            print(f"  - Fecha: {msg.fecha_mensaje}")
            print()
        
        # Buscar oportunidad del contacto
        stmt_oport = select(CRMOportunidad).where(
            CRMOportunidad.contacto_id == contacto.id,
            CRMOportunidad.activo == True
        )
        oportunidad = session.exec(stmt_oport).first()
        
        if oportunidad:
            print(f"✅ Oportunidad activa: ID {oportunidad.id}")
            print(f"   Título: {oportunidad.titulo}")
            print(f"   Estado: {oportunidad.estado}")
        else:
            print("⚠️  No tiene oportunidad activa")


if __name__ == "__main__":
    print("=" * 60)
    print("VERIFICAR ESTADO DE MENSAJES")
    print("=" * 60)
    
    verificar_mensajes_contacto("Laura Fernández")
