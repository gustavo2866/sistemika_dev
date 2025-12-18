"""
Script para poblar configuración de Meta WhatsApp en la tabla settings
"""
import sys
import os

# Agregar el directorio backend al path para importar módulos
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from app.db import engine
from app.models import Setting


def poblar_settings_meta_w():
    """Pobla la tabla settings con configuraciones de Meta WhatsApp"""
    with Session(engine) as session:
        settings_meta = [
            {
                "clave": "meta_w_empresa_id",
                "valor": "123456789",  # Reemplazar con el empresa_id real de Meta
                "descripcion": "ID de la empresa en Meta WhatsApp (validar webhooks)",
            },
            {
                "clave": "meta_w_auto_create_celular",
                "valor": "true",
                "descripcion": "Auto-crear CRMCelular cuando llega webhook de celular desconocido",
            },
        ]

        for setting_data in settings_meta:
            # Verificar si ya existe
            stmt = select(Setting).where(Setting.clave == setting_data["clave"])
            existing = session.exec(stmt).first()

            if existing:
                print(f"✓ Setting '{setting_data['clave']}' ya existe: {existing.valor}")
            else:
                # Crear nuevo
                setting = Setting(**setting_data)
                session.add(setting)
                session.commit()
                session.refresh(setting)
                print(f"✓ Setting '{setting_data['clave']}' creado: {setting.valor}")

        print("\n✅ Configuración de Meta WhatsApp completada")
        print("⚠️  IMPORTANTE: Actualizar meta_w_empresa_id con el valor real desde Meta Dashboard")


if __name__ == "__main__":
    poblar_settings_meta_w()
