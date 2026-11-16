"""Tipos explícitos y dependencias entre cuentas Cash."""
from alembic import op
import sqlalchemy as sa

revision = "20261114_cash_relacional"
down_revision = "20261114_cash_local"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_metodo_proyeccion_base_calculo", "metodo_proyeccion", type_="check")
    op.alter_column("metodo_proyeccion", "base_calculo", new_column_name="tipo_calculo", server_default="HISTORICO")
    op.execute("UPDATE metodo_proyeccion SET tipo_calculo='HISTORICO' WHERE tipo_calculo='PROYECTADO'")
    op.create_check_constraint("ck_metodo_proyeccion_tipo_calculo", "metodo_proyeccion", "tipo_calculo IN ('HISTORICO','RELACIONAL','PENDIENTE')")
    op.add_column("erp_cash_cuentas", sa.Column("cuenta_cash_referencia_id", sa.Integer(), nullable=True))
    op.add_column("erp_cash_cuentas", sa.Column("porcentaje", sa.Numeric(12, 6), nullable=True))
    op.create_foreign_key("fk_cash_cuenta_referencia", "erp_cash_cuentas", "erp_cash_cuentas", ["cuenta_cash_referencia_id"], ["id"])
    op.create_index("ix_erp_cash_cuentas_cuenta_cash_referencia_id", "erp_cash_cuentas", ["cuenta_cash_referencia_id"])
    op.drop_table("metodo_proyeccion_cuenta")
    op.drop_column("erp_cash_proyectado", "total_proyectado")
    op.drop_constraint("ck_erp_cash_proyectado_base_calculo", "erp_cash_proyectado", type_="check")
    op.alter_column("erp_cash_proyectado", "base_calculo", new_column_name="tipo_calculo", server_default="HISTORICO")
    op.execute("UPDATE erp_cash_proyectado SET tipo_calculo='HISTORICO' WHERE tipo_calculo='PROYECTADO'")
    op.create_check_constraint("ck_erp_cash_proyectado_tipo_calculo", "erp_cash_proyectado", "tipo_calculo IN ('HISTORICO','RELACIONAL','PENDIENTE')")
    op.add_column("erp_cash_proyectado", sa.Column("total_proyectado", sa.Numeric(18, 2), sa.Computed(
        "CASE WHEN tipo_calculo = 'PENDIENTE' THEN importe_pendiente ELSE importe_proyectado END + importe_comprometido", persisted=True), nullable=False))
    # Las reglas históricas no aplican a Pendiente.
    op.execute("DELETE FROM metodo_proyeccion_detalle WHERE id_metodo_proyeccion IN (SELECT id FROM metodo_proyeccion WHERE tipo_calculo='PENDIENTE')")


def downgrade():
    raise RuntimeError("La migración descarta las asociaciones ERP; restaurar desde respaldo para revertir")
