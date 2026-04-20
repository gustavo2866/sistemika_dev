"""Seed core catalog data.

Revision inserts baseline records for paises, tipos_operacion, proveedores y usuarios.
"""

from alembic import op
from sqlmodel import Session, select, delete

# revision identifiers, used by Alembic.
revision = "0002_seed_core_data"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


PAISES_DATA = [
    {"name": "Argentina"},
    {"name": "Brasil"},
]

TIPO_OPERACION_DATA = [
    {
        "codigo": "SERV",
        "descripcion": "Servicios generales",
        "requiere_iva": True,
        "porcentaje_iva_default": 21.0,
        "cuenta_contable": "5000",
    },
]

PROVEEDOR_DATA = [
    {
        "nombre": "Proveedor Demo",
        "razon_social": "Proveedor Demo SA",
        "cuit": "20-00000000-1",
        "telefono": "01112345678",
        "email": "demo@proveedor.com",
        "direccion": "Av. Siempre Viva 742",
    },
]

USUARIO_DATA = [
    {
        "nombre": "Usuario Demo",
        "email": "demo@example.com",
        "telefono": "+54 11 5555-0000",
        "pais_name": "Argentina",
    },
]


def upgrade() -> None:
    import app.models as models

    bind = op.get_bind()
    with Session(bind=bind) as session:
        # Seed paises
        if not session.exec(select(models.Paises)).first():
            session.add_all([models.Paises(**data) for data in PAISES_DATA])
            session.flush()

        # Seed tipos de operacion
        if not session.exec(select(models.TipoOperacion)).first():
            session.add_all([models.TipoOperacion(**data) for data in TIPO_OPERACION_DATA])
            session.flush()

        # Seed proveedores
        if not session.exec(select(models.Proveedor)).first():
            session.add_all([models.Proveedor(**data) for data in PROVEEDOR_DATA])
            session.flush()

        # Seed usuarios
        if not session.exec(select(models.User)).first():
            pais_map = {}
            for pais in session.exec(select(models.Paises)).all():
                pais_map[pais.name] = pais.id

            users = []
            for data in USUARIO_DATA:
                data = data.copy()
                pais_name = data.pop("pais_name", None)
                if pais_name:
                    data["pais_id"] = pais_map.get(pais_name)
                users.append(models.User(**data))
            session.add_all(users)

        session.commit()


def downgrade() -> None:
    import app.models as models

    bind = op.get_bind()
    with Session(bind=bind) as session:
        session.exec(delete(models.User).where(models.User.email == "demo@example.com"))
        session.exec(delete(models.Proveedor).where(models.Proveedor.cuit == "20-00000000-1"))
        session.exec(delete(models.TipoOperacion).where(models.TipoOperacion.codigo == "SERV"))
        session.exec(delete(models.Paises).where(models.Paises.name.in_([data["name"] for data in PAISES_DATA])))
        session.commit()
