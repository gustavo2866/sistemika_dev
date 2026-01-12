"""
Script para agregar tipos de artículo específicos y corregir filtros de tipos de solicitud
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine
from app.models import TipoSolicitud, TipoArticulo
from app.models.adm import AdmConcepto


DEFAULT_CONCEPTO_NOMBRE = "Concepto default"
DEFAULT_CONCEPTO_CUENTA = "DEFAULT"

def get_default_concepto_id(session: Session) -> int:
    concepto = session.exec(
        select(AdmConcepto).where(AdmConcepto.cuenta == DEFAULT_CONCEPTO_CUENTA)
    ).first()
    if concepto:
        return concepto.id
    concepto = AdmConcepto(
        nombre=DEFAULT_CONCEPTO_NOMBRE,
        descripcion="Concepto por defecto para tipos de articulo",
        cuenta=DEFAULT_CONCEPTO_CUENTA,
    )
    session.add(concepto)
    session.commit()
    session.refresh(concepto)
    return concepto.id


def crear_tipos_especificos():
    """Crea tipos de artículo específicos y corrige filtros"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        default_concepto_id = get_default_concepto_id(session)
        print("🔄 Creando tipos de artículo específicos...")
        
        # Verificar si ya existen los tipos
        transporte = session.exec(select(TipoArticulo).where(TipoArticulo.nombre == "Transporte")).first()
        mensajeria = session.exec(select(TipoArticulo).where(TipoArticulo.nombre == "Mensajería")).first()
        
        # Crear Transporte si no existe
        if not transporte:
            transporte = TipoArticulo(
                nombre="Transporte",
                descripcion="Servicios de transporte y movilidad",
                adm_concepto_id=default_concepto_id,
                activo=True
            )
            session.add(transporte)
            session.commit()
            session.refresh(transporte)
            print(f"  ✅ Creado: Transporte (ID: {transporte.id})")
        else:
            print(f"  ℹ️ Ya existe: Transporte (ID: {transporte.id})")
            
        # Crear Mensajería si no existe
        if not mensajeria:
            mensajeria = TipoArticulo(
                nombre="Mensajería",
                descripcion="Servicios de mensajería y paquetería",
                adm_concepto_id=default_concepto_id,
                activo=True
            )
            session.add(mensajeria)
            session.commit()
            session.refresh(mensajeria)
            print(f"  ✅ Creado: Mensajería (ID: {mensajeria.id})")
        else:
            print(f"  ℹ️ Ya existe: Mensajería (ID: {mensajeria.id})")
        
        # Actualizar tipos de solicitud
        print("\n🔄 Actualizando filtros de tipos de solicitud...")
        
        # Actualizar Transporte
        tipo_transporte = session.exec(select(TipoSolicitud).where(TipoSolicitud.nombre == "Transporte")).first()
        if tipo_transporte:
            tipo_transporte.tipo_articulo_filter_id = transporte.id
            session.add(tipo_transporte)
            print(f"  ✅ Transporte → Filtro ID {transporte.id}")
        
        # Actualizar Mensajería
        tipo_mensajeria = session.exec(select(TipoSolicitud).where(TipoSolicitud.nombre == "Mensajería")).first()
        if tipo_mensajeria:
            tipo_mensajeria.tipo_articulo_filter_id = mensajeria.id
            session.add(tipo_mensajeria)
            print(f"  ✅ Mensajería → Filtro ID {mensajeria.id}")
        
        session.commit()
        print("\n✅ Actualización completada")
        
        # Verificar estado final
        print("\n📊 Estado final de filtros:")
        tipos_solicitud = session.exec(select(TipoSolicitud)).all()
        for tipo in tipos_solicitud:
            if tipo.tipo_articulo_filter_id:
                tipo_articulo = session.get(TipoArticulo, tipo.tipo_articulo_filter_id)
                print(f"  {tipo.nombre}: → {tipo_articulo.nombre if tipo_articulo else 'NO ENCONTRADO'} (ID: {tipo.tipo_articulo_filter_id})")
            else:
                print(f"  {tipo.nombre}: Sin filtro")

if __name__ == "__main__":
    crear_tipos_especificos()
