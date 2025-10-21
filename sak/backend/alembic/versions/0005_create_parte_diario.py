"""Create parte diario tables and seed sample data."""

from datetime import date
from decimal import Decimal

from alembic import op
from sqlmodel import Session, select

# revision identifiers, used by Alembic.
revision = "0005_create_parte_diario"
down_revision = "0004_add_idproyecto_to_nominas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    import app.models as models

    bind = op.get_bind()

    models.ParteDiario.__table__.create(bind, checkfirst=True)
    models.ParteDiarioDetalle.__table__.create(bind, checkfirst=True)

    with Session(bind=bind) as session:
        if session.exec(select(models.ParteDiario).limit(1)).first():
            return

        proyectos = session.exec(
            select(models.Proyecto).order_by(models.Proyecto.id).limit(2)
        ).all()
        nominas = session.exec(
            select(models.Nomina).order_by(models.Nomina.id).limit(5)
        ).all()

        if not proyectos or not nominas:
            return

        parte1 = models.ParteDiario(
            idproyecto=proyectos[0].id,
            fecha=date.today(),
            estado=models.EstadoParteDiario.PENDIENTE,
            descripcion="Avance de estructura y tareas generales.",
        )
        parte1.detalles = [
            models.ParteDiarioDetalle(
                idnomina=nominas[0].id,
                horas=Decimal("8.00"),
                descripcion="Montaje de vigas principales.",
            ),
            models.ParteDiarioDetalle(
                idnomina=nominas[1].id if len(nominas) > 1 else nominas[0].id,
                horas=Decimal("4.00"),
                tipolicencia=models.TipoLicencia.ENFERMEDAD
                if len(nominas) > 1
                else None,
                descripcion="Asistencia parcial por turno mañana.",
            ),
        ]

        parte2 = models.ParteDiario(
            idproyecto=proyectos[-1].id,
            fecha=date.today(),
            estado=models.EstadoParteDiario.CERRADO,
            descripcion="Cierre de tareas administrativas y control de avance.",
        )
        parte2.detalles = [
            models.ParteDiarioDetalle(
                idnomina=nominas[2].id if len(nominas) > 2 else nominas[0].id,
                horas=Decimal("6.50"),
                descripcion="Revisión de planos y coordinación de cuadrilla.",
            ),
            models.ParteDiarioDetalle(
                idnomina=nominas[3].id if len(nominas) > 3 else nominas[0].id,
                horas=Decimal("0.00"),
                tipolicencia=models.TipoLicencia.LEGAL
                if len(nominas) > 3
                else None,
                descripcion="Día asignado por licencia legal.",
            ),
        ]

        session.add_all([parte1, parte2])
        session.commit()


def downgrade() -> None:
    import app.models as models

    bind = op.get_bind()

    models.ParteDiarioDetalle.__table__.drop(bind, checkfirst=True)
    models.ParteDiario.__table__.drop(bind, checkfirst=True)
