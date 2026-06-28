"""proyecto encargados contactos operativos

Revision ID: 20260625_proyecto_encargados_contactos_operativos
Revises: 20260623_tarja_use_parte_diario_estados
Create Date: 2026-06-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260625_proyecto_encargados_contactos_operativos"
down_revision: Union[str, None] = "20260623_tarja_use_parte_diario_estados"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proyecto_encargados",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("proyecto_id", sa.Integer(), nullable=False),
        sa.Column("contacto_id", sa.Integer(), nullable=False),
        sa.Column("principal", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("desde", sa.Date(), nullable=True),
        sa.Column("hasta", sa.Date(), nullable=True),
        sa.Column("notas", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["contacto_id"], ["crm_contactos.id"]),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_proyecto_encargados_proyecto_contacto_active",
        "proyecto_encargados",
        ["proyecto_id", "contacto_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_proyecto_encargados_proyecto_activo",
        "proyecto_encargados",
        ["proyecto_id", "activo"],
    )
    op.create_index(
        "ix_proyecto_encargados_contacto_activo",
        "proyecto_encargados",
        ["contacto_id", "activo"],
    )

    op.add_column("nominas", sa.Column("encargado_contacto_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_nominas_encargado_contacto_id",
        "nominas",
        "crm_contactos",
        ["encargado_contacto_id"],
        ["id"],
    )
    op.create_index("ix_nominas_encargado_contacto_id", "nominas", ["encargado_contacto_id"])

    op.add_column("partes_diario", sa.Column("contacto_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_partes_diario_contacto_id",
        "partes_diario",
        "crm_contactos",
        ["contacto_id"],
        ["id"],
    )
    op.create_index("ix_partes_diario_contacto_id", "partes_diario", ["contacto_id"])

    op.add_column("tarjas", sa.Column("contacto_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tarjas_contacto_id",
        "tarjas",
        "crm_contactos",
        ["contacto_id"],
        ["id"],
    )
    op.create_index("ix_tarjas_contacto_id", "tarjas", ["contacto_id"])

    op.execute(
        """
        INSERT INTO proyecto_encargados (
            created_at,
            updated_at,
            version,
            proyecto_id,
            contacto_id,
            principal,
            activo
        )
        SELECT
            NOW(),
            NOW(),
            1,
            p.id,
            o.contacto_id,
            TRUE,
            TRUE
        FROM proyectos p
        JOIN crm_oportunidades o ON o.id = p.oportunidad_id
        WHERE p.deleted_at IS NULL
          AND o.deleted_at IS NULL
          AND o.contacto_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE partes_diario pd
        SET contacto_id = o.contacto_id
        FROM proyectos p
        JOIN crm_oportunidades o ON o.id = p.oportunidad_id
        WHERE pd.idproyecto = p.id
          AND pd.contacto_id IS NULL
          AND o.contacto_id IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE tarjas t
        SET contacto_id = o.contacto_id
        FROM proyectos p
        JOIN crm_oportunidades o ON o.id = p.oportunidad_id
        WHERE t.idproyecto = p.id
          AND t.contacto_id IS NULL
          AND o.contacto_id IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE nominas n
        SET encargado_contacto_id = o.contacto_id
        FROM proyectos p
        JOIN crm_oportunidades o ON o.id = p.oportunidad_id
        WHERE n.idproyecto = p.id
          AND n.encargado_contacto_id IS NULL
          AND o.contacto_id IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE constructora_pedidos cp
        SET contacto_id = o.contacto_id
        FROM crm_oportunidades o
        WHERE cp.oportunidad_id = o.id
          AND cp.contacto_id IS NULL
          AND o.contacto_id IS NOT NULL
        """
    )

    op.drop_constraint("uq_partes_diario_proyecto_fecha", "partes_diario", type_="unique")
    op.create_unique_constraint(
        "uq_partes_diario_proyecto_fecha_contacto",
        "partes_diario",
        ["idproyecto", "fecha", "contacto_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_partes_diario_proyecto_fecha_contacto", "partes_diario", type_="unique")
    op.create_unique_constraint(
        "uq_partes_diario_proyecto_fecha",
        "partes_diario",
        ["idproyecto", "fecha"],
    )

    op.drop_index("ix_tarjas_contacto_id", table_name="tarjas")
    op.drop_constraint("fk_tarjas_contacto_id", "tarjas", type_="foreignkey")
    op.drop_column("tarjas", "contacto_id")

    op.drop_index("ix_partes_diario_contacto_id", table_name="partes_diario")
    op.drop_constraint("fk_partes_diario_contacto_id", "partes_diario", type_="foreignkey")
    op.drop_column("partes_diario", "contacto_id")

    op.drop_index("ix_nominas_encargado_contacto_id", table_name="nominas")
    op.drop_constraint("fk_nominas_encargado_contacto_id", "nominas", type_="foreignkey")
    op.drop_column("nominas", "encargado_contacto_id")

    op.drop_index("ix_proyecto_encargados_contacto_activo", table_name="proyecto_encargados")
    op.drop_index("ix_proyecto_encargados_proyecto_activo", table_name="proyecto_encargados")
    op.drop_index("uq_proyecto_encargados_proyecto_contacto_active", table_name="proyecto_encargados")
    op.drop_table("proyecto_encargados")
