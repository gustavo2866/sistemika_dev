"""
Script para seed de departamentos
"""
from sqlmodel import Session, select
from app.db import engine
from app.models import Departamento


def seed_departamentos():
    """Crear departamentos iniciales"""
    with Session(engine) as session:
        # Verificar si ya existen departamentos
        existing = session.exec(select(Departamento)).first()
        if existing:
            print("⚠️  Departamentos ya existen. Skipping seed.")
            return
        
        departamentos = [
            Departamento(
                nombre="Compras",
                descripcion="Solicitudes de compra de materiales y servicios",
                activo=True
            ),
            Departamento(
                nombre="Administración",
                descripcion="Solicitudes administrativas generales",
                activo=True
            ),
            Departamento(
                nombre="Cadete",
                descripcion="Solicitudes de mensajería interna",
                activo=True
            ),
            Departamento(
                nombre="Fletero",
                descripcion="Solicitudes de transporte y logística",
                activo=True
            ),
        ]
        
        for dept in departamentos:
            session.add(dept)
        
        session.commit()
        print(f"✅ {len(departamentos)} departamentos creados exitosamente")
        
        # Mostrar IDs creados
        created = session.exec(select(Departamento)).all()
        for dept in created:
            print(f"  - {dept.id}: {dept.nombre}")


if __name__ == "__main__":
    seed_departamentos()
