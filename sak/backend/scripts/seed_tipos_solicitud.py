"""
Script para seed de tipos de solicitud
"""
from sqlmodel import Session, select
from app.db import engine
from app.models import TipoSolicitud, Departamento


def seed_tipos_solicitud():
    """Crear tipos de solicitud iniciales"""
    with Session(engine) as session:
        # Verificar si ya existen tipos
        existing = session.exec(select(TipoSolicitud)).first()
        if existing:
            print("⚠️  Tipos de solicitud ya existen. Skipping seed.")
            return
        
        # Obtener ID del departamento "Compras" para usar como default
        compras = session.exec(select(Departamento).where(Departamento.nombre == "Compras")).first()
        if not compras:
            print("❌ Departamento 'Compras' no encontrado. Ejecute seed_departamentos.py primero.")
            return
        
        tipos = [
            TipoSolicitud(
                nombre="Materiales",
                descripcion="Solicitud de materiales de construcción y obra",
                tipo_articulo_filter="Material",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
            TipoSolicitud(
                nombre="Ferretería",
                descripcion="Solicitud de artículos de ferretería",
                tipo_articulo_filter="Ferreteria",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
            TipoSolicitud(
                nombre="Servicios",
                descripcion="Solicitud de servicios externos",
                tipo_articulo_filter="Servicio",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
            TipoSolicitud(
                nombre="Insumos de Oficina",
                descripcion="Solicitud de insumos y artículos de oficina",
                tipo_articulo_filter="Insumo",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
            TipoSolicitud(
                nombre="Transporte",
                descripcion="Solicitud de servicios de transporte",
                tipo_articulo_filter="Servicio",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
            TipoSolicitud(
                nombre="Mensajería",
                descripcion="Solicitud de servicios de mensajería",
                tipo_articulo_filter="Servicio",
                articulo_default_id=None,
                departamento_default_id=compras.id,
                activo=True
            ),
        ]
        
        for tipo in tipos:
            session.add(tipo)
        
        session.commit()
        print(f"✅ {len(tipos)} tipos de solicitud creados exitosamente")
        
        # Mostrar IDs creados
        created = session.exec(select(TipoSolicitud)).all()
        for tipo in created:
            print(f"  - {tipo.id}: {tipo.nombre}")


if __name__ == "__main__":
    seed_tipos_solicitud()
