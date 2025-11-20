"""20251119_add_crm_core

Revision ID: 7ce9174d43c8
Revises: 2b6cc3ddf3d1
Create Date: 2025-11-20 01:31:26.361004

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "7ce9174d43c8"
down_revision: Union[str, Sequence[str], None] = "2b6cc3ddf3d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema creating CRM core tables."""
    # Catálogos
    op.create_table(
        "crm_tipos_operacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_tipos_operacion_codigo"), "crm_tipos_operacion", ["codigo"], unique=True)

    op.create_table(
        "crm_motivos_perdida",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_motivos_perdida_codigo"), "crm_motivos_perdida", ["codigo"], unique=True)

    op.create_table(
        "crm_condiciones_pago",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_condiciones_pago_codigo"), "crm_condiciones_pago", ["codigo"], unique=True)

    op.create_table(
        "crm_tipos_evento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_tipos_evento_codigo"), "crm_tipos_evento", ["codigo"], unique=True)

    op.create_table(
        "crm_motivos_evento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_motivos_evento_codigo"), "crm_motivos_evento", ["codigo"], unique=True)

    op.create_table(
        "crm_origenes_lead",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_origenes_lead_codigo"), "crm_origenes_lead", ["codigo"], unique=True)

    op.create_table(
        "monedas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("codigo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("simbolo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("es_moneda_base", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_monedas_codigo"), "monedas", ["codigo"], unique=True)

    op.create_table(
        "cotizacion_moneda",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("moneda_origen_id", sa.Integer(), nullable=False),
        sa.Column("moneda_destino_id", sa.Integer(), nullable=False),
        sa.Column("tipo_cambio", sa.DECIMAL(precision=18, scale=6), nullable=False),
        sa.Column("fecha_vigencia", sa.Date(), nullable=False),
        sa.Column("fuente", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["moneda_origen_id"], ["monedas.id"]),
        sa.ForeignKeyConstraint(["moneda_destino_id"], ["monedas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moneda_origen_id",
            "moneda_destino_id",
            "fecha_vigencia",
            name="uq_cotizacion_moneda_fecha",
        ),
    )
    op.create_index(
        "idx_cotizacion_moneda_lookup",
        "cotizacion_moneda",
        ["moneda_origen_id", "moneda_destino_id", "fecha_vigencia"],
        unique=False,
    )
    op.create_index(op.f("ix_cotizacion_moneda_moneda_origen_id"), "cotizacion_moneda", ["moneda_origen_id"], unique=False)
    op.create_index(op.f("ix_cotizacion_moneda_moneda_destino_id"), "cotizacion_moneda", ["moneda_destino_id"], unique=False)

    # Entidades principales
    op.create_table(
        "crm_contactos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("nombre_completo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("telefonos", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("red_social", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("origen_lead_id", sa.Integer(), nullable=True),
        sa.Column("responsable_id", sa.Integer(), nullable=False),
        sa.Column("notas", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["origen_lead_id"], ["crm_origenes_lead.id"]),
        sa.ForeignKeyConstraint(["responsable_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_contactos_nombre_completo"), "crm_contactos", ["nombre_completo"], unique=False)
    op.create_index(op.f("ix_crm_contactos_email"), "crm_contactos", ["email"], unique=False)

    op.create_table(
        "emprendimientos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("nombre", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("ubicacion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("estado", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=True),
        sa.Column("fecha_fin_estimada", sa.Date(), nullable=True),
        sa.Column("responsable_id", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["responsable_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_emprendimientos_nombre"), "emprendimientos", ["nombre"], unique=True)

    op.create_table(
        "crm_oportunidades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("contacto_id", sa.Integer(), nullable=False),
        sa.Column("tipo_operacion_id", sa.Integer(), nullable=False),
        sa.Column("emprendimiento_id", sa.Integer(), nullable=True),
        sa.Column("propiedad_id", sa.Integer(), nullable=False),
        sa.Column("estado", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("fecha_estado", sa.DateTime(), nullable=False),
        sa.Column("motivo_perdida_id", sa.Integer(), nullable=True),
        sa.Column("monto", sa.DECIMAL(precision=15, scale=2), nullable=True),
        sa.Column("moneda_id", sa.Integer(), nullable=True),
        sa.Column("condicion_pago_id", sa.Integer(), nullable=True),
        sa.Column("probabilidad", sa.Integer(), nullable=True),
        sa.Column("fecha_cierre_estimada", sa.Date(), nullable=True),
        sa.Column("responsable_id", sa.Integer(), nullable=False),
        sa.Column("descripcion_estado", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("cotizacion_aplicada", sa.DECIMAL(precision=18, scale=6), nullable=True),
        sa.ForeignKeyConstraint(["condicion_pago_id"], ["crm_condiciones_pago.id"]),
        sa.ForeignKeyConstraint(["contacto_id"], ["crm_contactos.id"]),
        sa.ForeignKeyConstraint(["emprendimiento_id"], ["emprendimientos.id"]),
        sa.ForeignKeyConstraint(["moneda_id"], ["monedas.id"]),
        sa.ForeignKeyConstraint(["motivo_perdida_id"], ["crm_motivos_perdida.id"]),
        sa.ForeignKeyConstraint(["propiedad_id"], ["propiedades.id"]),
        sa.ForeignKeyConstraint(["responsable_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tipo_operacion_id"], ["crm_tipos_operacion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_oportunidades_contacto_id"), "crm_oportunidades", ["contacto_id"], unique=False)
    op.create_index(op.f("ix_crm_oportunidades_emprendimiento_id"), "crm_oportunidades", ["emprendimiento_id"], unique=False)
    op.create_index(op.f("ix_crm_oportunidades_propiedad_id"), "crm_oportunidades", ["propiedad_id"], unique=False)
    op.create_index(op.f("ix_crm_oportunidades_tipo_operacion_id"), "crm_oportunidades", ["tipo_operacion_id"], unique=False)
    op.create_index(op.f("ix_crm_oportunidades_estado"), "crm_oportunidades", ["estado"], unique=False)
    op.create_index("idx_crm_oportunidad_estado_fecha", "crm_oportunidades", ["estado", "fecha_estado"], unique=False)
    op.create_index(
        "idx_crm_oportunidad_tipo_estado",
        "crm_oportunidades",
        ["tipo_operacion_id", "estado", "created_at"],
        unique=False,
    )

    op.create_table(
        "crm_eventos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("contacto_id", sa.Integer(), nullable=False),
        sa.Column("tipo_id", sa.Integer(), nullable=False),
        sa.Column("motivo_id", sa.Integer(), nullable=False),
        sa.Column("fecha_evento", sa.DateTime(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("asignado_a_id", sa.Integer(), nullable=False),
        sa.Column("oportunidad_id", sa.Integer(), nullable=True),
        sa.Column("origen_lead_id", sa.Integer(), nullable=True),
        sa.Column("proximo_paso", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("fecha_compromiso", sa.Date(), nullable=True),
        sa.Column("estado_evento", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["asignado_a_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["contacto_id"], ["crm_contactos.id"]),
        sa.ForeignKeyConstraint(["motivo_id"], ["crm_motivos_evento.id"]),
        sa.ForeignKeyConstraint(["oportunidad_id"], ["crm_oportunidades.id"]),
        sa.ForeignKeyConstraint(["origen_lead_id"], ["crm_origenes_lead.id"]),
        sa.ForeignKeyConstraint(["tipo_id"], ["crm_tipos_evento.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_eventos_contacto_id"), "crm_eventos", ["contacto_id"], unique=False)
    op.create_index(op.f("ix_crm_eventos_oportunidad_id"), "crm_eventos", ["oportunidad_id"], unique=False)
    op.create_index(op.f("ix_crm_eventos_fecha_evento"), "crm_eventos", ["fecha_evento"], unique=False)
    op.create_index(op.f("ix_crm_eventos_estado_evento"), "crm_eventos", ["estado_evento"], unique=False)

    op.create_table(
        "crm_oportunidad_log_estado",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("oportunidad_id", sa.Integer(), nullable=False),
        sa.Column("estado_anterior", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("estado_nuevo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("fecha_registro", sa.DateTime(), nullable=False),
        sa.Column("motivo_perdida_id", sa.Integer(), nullable=True),
        sa.Column("monto", sa.DECIMAL(precision=15, scale=2), nullable=True),
        sa.Column("moneda_id", sa.Integer(), nullable=True),
        sa.Column("condicion_pago_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["condicion_pago_id"], ["crm_condiciones_pago.id"]),
        sa.ForeignKeyConstraint(["moneda_id"], ["monedas.id"]),
        sa.ForeignKeyConstraint(["motivo_perdida_id"], ["crm_motivos_perdida.id"]),
        sa.ForeignKeyConstraint(["oportunidad_id"], ["crm_oportunidades.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_oportunidad_log_estado_oportunidad_id"), "crm_oportunidad_log_estado", ["oportunidad_id"], unique=False)

    # Ajustes de propiedades
    op.add_column("propiedades", sa.Column("tipo_operacion_id", sa.Integer(), nullable=True))
    op.add_column("propiedades", sa.Column("emprendimiento_id", sa.Integer(), nullable=True))
    op.add_column("propiedades", sa.Column("costo_propiedad", sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column("propiedades", sa.Column("costo_moneda_id", sa.Integer(), nullable=True))
    op.add_column("propiedades", sa.Column("precio_venta_estimado", sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column("propiedades", sa.Column("precio_moneda_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_propiedades_tipo_operacion_id"), "propiedades", ["tipo_operacion_id"], unique=False)
    op.create_index(op.f("ix_propiedades_emprendimiento_id"), "propiedades", ["emprendimiento_id"], unique=False)
    op.create_foreign_key(None, "propiedades", "crm_tipos_operacion", ["tipo_operacion_id"], ["id"])
    op.create_foreign_key(None, "propiedades", "emprendimientos", ["emprendimiento_id"], ["id"])
    op.create_foreign_key(None, "propiedades", "monedas", ["costo_moneda_id"], ["id"])
    op.create_foreign_key(None, "propiedades", "monedas", ["precio_moneda_id"], ["id"])


def downgrade() -> None:
    """Drop CRM core tables."""
    op.drop_constraint(None, "propiedades", type_="foreignkey")
    op.drop_constraint(None, "propiedades", type_="foreignkey")
    op.drop_constraint(None, "propiedades", type_="foreignkey")
    op.drop_constraint(None, "propiedades", type_="foreignkey")
    op.drop_index(op.f("ix_propiedades_emprendimiento_id"), table_name="propiedades")
    op.drop_index(op.f("ix_propiedades_tipo_operacion_id"), table_name="propiedades")
    op.drop_column("propiedades", "precio_moneda_id")
    op.drop_column("propiedades", "precio_venta_estimado")
    op.drop_column("propiedades", "costo_moneda_id")
    op.drop_column("propiedades", "costo_propiedad")
    op.drop_column("propiedades", "emprendimiento_id")
    op.drop_column("propiedades", "tipo_operacion_id")

    op.drop_index(op.f("ix_crm_oportunidad_log_estado_oportunidad_id"), table_name="crm_oportunidad_log_estado")
    op.drop_table("crm_oportunidad_log_estado")

    op.drop_index(op.f("ix_crm_eventos_estado_evento"), table_name="crm_eventos")
    op.drop_index(op.f("ix_crm_eventos_fecha_evento"), table_name="crm_eventos")
    op.drop_index(op.f("ix_crm_eventos_oportunidad_id"), table_name="crm_eventos")
    op.drop_index(op.f("ix_crm_eventos_contacto_id"), table_name="crm_eventos")
    op.drop_table("crm_eventos")

    op.drop_index("idx_crm_oportunidad_tipo_estado", table_name="crm_oportunidades")
    op.drop_index("idx_crm_oportunidad_estado_fecha", table_name="crm_oportunidades")
    op.drop_index(op.f("ix_crm_oportunidades_estado"), table_name="crm_oportunidades")
    op.drop_index(op.f("ix_crm_oportunidades_tipo_operacion_id"), table_name="crm_oportunidades")
    op.drop_index(op.f("ix_crm_oportunidades_propiedad_id"), table_name="crm_oportunidades")
    op.drop_index(op.f("ix_crm_oportunidades_emprendimiento_id"), table_name="crm_oportunidades")
    op.drop_index(op.f("ix_crm_oportunidades_contacto_id"), table_name="crm_oportunidades")
    op.drop_table("crm_oportunidades")

    op.drop_index(op.f("ix_emprendimientos_nombre"), table_name="emprendimientos")
    op.drop_table("emprendimientos")

    op.drop_index(op.f("ix_crm_contactos_email"), table_name="crm_contactos")
    op.drop_index(op.f("ix_crm_contactos_nombre_completo"), table_name="crm_contactos")
    op.drop_table("crm_contactos")

    op.drop_index(op.f("ix_cotizacion_moneda_moneda_destino_id"), table_name="cotizacion_moneda")
    op.drop_index(op.f("ix_cotizacion_moneda_moneda_origen_id"), table_name="cotizacion_moneda")
    op.drop_index("idx_cotizacion_moneda_lookup", table_name="cotizacion_moneda")
    op.drop_table("cotizacion_moneda")

    op.drop_index(op.f("ix_monedas_codigo"), table_name="monedas")
    op.drop_table("monedas")

    op.drop_index(op.f("ix_crm_origenes_lead_codigo"), table_name="crm_origenes_lead")
    op.drop_table("crm_origenes_lead")

    op.drop_index(op.f("ix_crm_motivos_evento_codigo"), table_name="crm_motivos_evento")
    op.drop_table("crm_motivos_evento")

    op.drop_index(op.f("ix_crm_tipos_evento_codigo"), table_name="crm_tipos_evento")
    op.drop_table("crm_tipos_evento")

    op.drop_index(op.f("ix_crm_condiciones_pago_codigo"), table_name="crm_condiciones_pago")
    op.drop_table("crm_condiciones_pago")

    op.drop_index(op.f("ix_crm_motivos_perdida_codigo"), table_name="crm_motivos_perdida")
    op.drop_table("crm_motivos_perdida")

    op.drop_index(op.f("ix_crm_tipos_operacion_codigo"), table_name="crm_tipos_operacion")
    op.drop_table("crm_tipos_operacion")
