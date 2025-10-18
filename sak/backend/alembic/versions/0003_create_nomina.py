"""Create nominas table and seed initial employees."""

from datetime import date
from decimal import Decimal

from alembic import op
from sqlmodel import Session, select

# revision identifiers, used by Alembic.
revision = "0003_create_nomina"
down_revision = "0002_seed_core_data"
branch_labels = None
depends_on = None


INITIAL_NOMINA_DATA = [
    {
        "nombre": "Juan",
        "apellido": "Perez",
        "dni": "20123456",
        "email": "juan.perez@example.com",
        "telefono": "+54 11 5555-1000",
        "direccion": "Av. Siempre Viva 101",
        "fecha_nacimiento": date(1985, 3, 12),
        "fecha_ingreso": date(2020, 1, 15),
        "salario_mensual": Decimal("250000.00"),
        "categoria": "oficial",
        "url_foto": "https://example.com/fotos/juan_perez.jpg",
    },
    {
        "nombre": "Maria",
        "apellido": "Gonzalez",
        "dni": "23222333",
        "email": "maria.gonzalez@example.com",
        "telefono": "+54 11 5555-2000",
        "direccion": "Calle Falsa 742",
        "fecha_nacimiento": date(1990, 7, 4),
        "fecha_ingreso": date(2021, 6, 1),
        "salario_mensual": Decimal("195000.00"),
        "categoria": "medio_oficial",
        "url_foto": "https://example.com/fotos/maria_gonzalez.jpg",
    },
    {
        "nombre": "Carlos",
        "apellido": "Suarez",
        "dni": "28999888",
        "email": "carlos.suarez@example.com",
        "telefono": "+54 11 5555-3000",
        "direccion": "Boulevard Central 55",
        "fecha_nacimiento": date(1995, 11, 22),
        "fecha_ingreso": date(2022, 3, 10),
        "salario_mensual": Decimal("160000.00"),
        "categoria": "ayudante",
        "url_foto": "https://example.com/fotos/carlos_suarez.jpg",
    },
    {
        "nombre": "Laura",
        "apellido": "Martinez",
        "dni": "25666777",
        "email": "laura.martinez@example.com",
        "telefono": "+54 11 5555-4000",
        "direccion": "Ruta 3 Km 45",
        "fecha_nacimiento": date(1988, 12, 2),
        "fecha_ingreso": date(2019, 9, 17),
        "salario_mensual": Decimal("210000.00"),
        "categoria": "administrativo",
        "url_foto": "https://example.com/fotos/laura_martinez.jpg",
    },
]


def upgrade() -> None:
    import app.models as models

    bind = op.get_bind()
    nomina_table = models.Nomina.__table__
    nomina_table.create(bind, checkfirst=True)

    with Session(bind=bind) as session:
        exists = session.exec(select(models.Nomina).limit(1)).first()
        if exists:
            return

        empleados = []
        for data in INITIAL_NOMINA_DATA:
            payload = data.copy()
            categoria_value = payload.pop("categoria")
            payload["categoria"] = models.CategoriaNomina(categoria_value)
            empleados.append(models.Nomina(**payload))
        session.add_all(empleados)
        session.commit()


def downgrade() -> None:
    import app.models as models

    bind = op.get_bind()
    nomina_table = models.Nomina.__table__
    nomina_table.drop(bind, checkfirst=True)
