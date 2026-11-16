"""Consolida proyecciones por cuenta/período y genera el total en la base.

Revision ID: 20261113_cash_columnas
Revises: 20261111_cash_en_cierre
"""
from alembic import op
import sqlalchemy as sa

revision = "20261113_cash_columnas"
down_revision = "20261111_cash_en_cierre"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("metodo_proyeccion", sa.Column("base_calculo", sa.String(20), nullable=False, server_default="PROYECTADO"))
    op.execute("UPDATE metodo_proyeccion SET base_calculo = 'PENDIENTE' WHERE lower(trim(nombre)) = 'pendiente'")
    op.create_check_constraint("ck_metodo_proyeccion_base_calculo", "metodo_proyeccion", "base_calculo IN ('PROYECTADO', 'PENDIENTE')")
    for field in ("importe_proyectado", "importe_pendiente", "importe_comprometido"):
        op.add_column("erp_cash_proyectado", sa.Column(field, sa.Numeric(18, 2), nullable=False, server_default="0"))
    op.add_column("erp_cash_proyectado", sa.Column("id_metodo_proyeccion", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_cash_proyectado_metodo", "erp_cash_proyectado", "metodo_proyeccion", ["id_metodo_proyeccion"], ["id"])
    op.create_index("ix_erp_cash_proyectado_id_metodo_proyeccion", "erp_cash_proyectado", ["id_metodo_proyeccion"])
    op.add_column("erp_cash_proyectado", sa.Column("base_calculo", sa.String(20), nullable=False, server_default="PROYECTADO"))
    # Presupuesto y Ajuste se descartan por decisión funcional. Las bajas de
    # los otros tipos conservan su estado; solo se consolidan las filas activas.
    op.execute("DELETE FROM erp_cash_proyectado WHERE tipo IN ('PRESUPUESTO', 'AJUSTE')")
    op.execute("""
        UPDATE erp_cash_proyectado SET
            importe_proyectado = CASE WHEN tipo = 'PROYECCION' THEN importe ELSE 0 END,
            importe_pendiente = CASE WHEN tipo = 'pend' THEN importe ELSE 0 END,
            importe_comprometido = CASE WHEN tipo = 'COMPROMETIDO' THEN importe ELSE 0 END
    """)
    op.execute("""
        UPDATE erp_cash_proyectado p SET
            id_metodo_proyeccion = c.id_metodo_proyeccion,
            base_calculo = coalesce(m.base_calculo, 'PROYECTADO')
        FROM erp_cash_cuentas c
        LEFT JOIN metodo_proyeccion m ON m.id = c.id_metodo_proyeccion
        WHERE c.id = p.cuenta_cash_id
    """)
    op.execute("""
        WITH consolidated AS (
            SELECT min(id) AS keep_id,
                sum(importe_proyectado) AS proyectado,
                sum(importe_pendiente) AS pendiente,
                sum(importe_comprometido) AS comprometido,
                min(created_at) AS created_at, max(updated_at) AS updated_at,
                coalesce(max(CASE WHEN tipo = 'COMPROMETIDO' THEN observacion END),
                         max(CASE WHEN tipo = 'PROYECCION' THEN observacion END),
                         max(observacion)) AS observacion
            FROM erp_cash_proyectado WHERE deleted_at IS NULL
            GROUP BY cuenta_cash_id, fecha_periodo
        )
        UPDATE erp_cash_proyectado p SET
            importe_proyectado = c.proyectado, importe_pendiente = c.pendiente,
            importe_comprometido = c.comprometido, observacion = c.observacion,
            created_at = c.created_at, updated_at = c.updated_at
        FROM consolidated c WHERE p.id = c.keep_id
    """)
    op.execute("""
        DELETE FROM erp_cash_proyectado WHERE deleted_at IS NULL AND id NOT IN (
            SELECT min(id) FROM erp_cash_proyectado WHERE deleted_at IS NULL
            GROUP BY cuenta_cash_id, fecha_periodo
        )
    """)
    op.drop_index("uq_erp_cash_proyectado_activo_cuenta_periodo_tipo", table_name="erp_cash_proyectado")
    op.drop_index("ix_erp_cash_proyectado_tipo", table_name="erp_cash_proyectado")
    op.drop_constraint("ck_erp_cash_proyectado_tipo_valid", "erp_cash_proyectado", type_="check")
    op.drop_column("erp_cash_proyectado", "tipo")
    op.drop_column("erp_cash_proyectado", "importe")
    op.create_check_constraint("ck_erp_cash_proyectado_base_calculo", "erp_cash_proyectado", "base_calculo IN ('PROYECTADO', 'PENDIENTE')")
    op.create_index("uq_erp_cash_proyectado_activo_cuenta_periodo", "erp_cash_proyectado", ["cuenta_cash_id", "fecha_periodo"], unique=True, postgresql_where=sa.text("deleted_at IS NULL"))
    op.add_column("erp_cash_proyectado", sa.Column("total_proyectado", sa.Numeric(18, 2), sa.Computed("CASE WHEN base_calculo = 'PENDIENTE' THEN importe_pendiente ELSE importe_proyectado END + importe_comprometido", persisted=True), nullable=False))


def downgrade():
    # La consolidación elimina tipos y combina filas; no se inventa un historial
    # inverso ni se restauran datos descartados. Restaurar backup para revertir.
    raise RuntimeError("Migración irreversible: restaurar un backup anterior para volver al modelo por tipo")
