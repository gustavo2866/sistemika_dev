"""
Script para poblar CRMCelulares de ejemplo
"""
import sys
import os

# Agregar el directorio backend al path para importar módulos
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMCelular


def poblar_crm_celulares():
    """Pobla la tabla crm_celulares con ejemplos"""
    with Session(engine) as session:
        celulares_ejemplo = [
            {
                "meta_celular_id": "123456789012345",  # Reemplazar con ID real de Meta
                "numero_celular": "+59899123456",
                "alias": "Canal Principal",
                "activo": True,
            },
            {
                "meta_celular_id": "123456789012346",  # Otro celular de ejemplo
                "numero_celular": "+59899654321",
                "alias": "Canal Secundario",
                "activo": False,
            },
        ]

        for celular_data in celulares_ejemplo:
            # Verificar si ya existe por meta_celular_id
            stmt = select(CRMCelular).where(
                CRMCelular.meta_celular_id == celular_data["meta_celular_id"]
            )
            existing = session.exec(stmt).first()

            if existing:
                print(f"✓ Celular '{celular_data['alias']}' ya existe: {existing.numero_celular}")
            else:
                # Crear nuevo
                celular = CRMCelular(**celular_data)
                session.add(celular)
                session.commit()
                session.refresh(celular)
                print(f"✓ Celular '{celular_data['alias']}' creado: {celular.numero_celular}")

        print("\n✅ Celulares de ejemplo creados")
        print("⚠️  IMPORTANTE: Actualizar meta_celular_id con valores reales desde Meta Dashboard")
        print("   Obtener phone_number_id desde: Meta Business Suite > WhatsApp > API Setup")


if __name__ == "__main__":
    poblar_crm_celulares()
