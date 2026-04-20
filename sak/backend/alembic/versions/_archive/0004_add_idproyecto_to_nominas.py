"""Add idproyecto foreign key to nominas."""

import random

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlmodel import Session

# revision identifiers, used by Alembic.
revision = "0004_add_idproyecto_to_nominas"
down_revision = "0003_create_nomina"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector = inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("nominas")}
    if "idproyecto" not in columns:
        op.add_column(
            "nominas",
            sa.Column("idproyecto", sa.Integer(), nullable=True),
        )
        if dialect != "sqlite":
            op.create_foreign_key(
                "fk_nominas_proyectos_idproyecto",
                "nominas",
                "proyectos",
                ["idproyecto"],
                ["id"],
                ondelete="SET NULL",
            )

    with Session(bind=bind) as session:
        rows = session.exec(sa.text("SELECT id FROM nominas")).all()
        update_stmt = sa.text(
            "UPDATE nominas SET idproyecto = :idproyecto WHERE id = :id"
        )
        for (nomina_id,) in rows:
            session.execute(
                update_stmt,
                {
                    "idproyecto": random.choice((1, 2)),
                    "id": nomina_id,
                },
            )
        session.commit()


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector = inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("nominas")}
    if "idproyecto" not in columns:
        return

    if dialect != "sqlite":
        op.drop_constraint(
            "fk_nominas_proyectos_idproyecto",
            "nominas",
            type_="foreignkey",
        )
    op.drop_column("nominas", "idproyecto")
