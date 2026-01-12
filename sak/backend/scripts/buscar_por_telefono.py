"""
Script para buscar contacto por teléfono
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm import CRMMensaje, CRMContacto, CRMOportunidad


def buscar_por_telefono(telefono: str):
    """Busca contacto por teléfono"""
    
    with Session(engine) as session:
        # Buscar contacto por teléfono en el array JSON
        from sqlalchemy import cast, Text
        stmt = select(CRMContacto).where(
            cast(CRMContacto.telefonos, Text).contains(telefono)
        )
        contacto = session.exec(stmt).first()
        
        if not contacto:
            print(f"❌ No se encontró contacto con teléfono '{telefono}'")
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
            contenido_preview = msg.contenido[:50] + "..." if msg.contenido and len(msg.contenido) > 50 else msg.contenido
            print(f"Mensaje ID {msg.id}:")
            print(f"  - Tipo: {msg.tipo}")
            print(f"  - Estado: {msg.estado}")
            print(f"  - Contenido: {contenido_preview}")
            print(f"  - Oportunidad ID: {msg.oportunidad_id}")
            print(f"  - Fecha: {msg.fecha_mensaje}\n")
        
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
    print("BUSCAR CONTACTO POR TELÉFONO")
    print("=" * 60)
    
    buscar_por_telefono("+5491155443322")
