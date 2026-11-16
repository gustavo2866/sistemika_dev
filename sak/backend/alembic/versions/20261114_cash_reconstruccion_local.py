"""Fuentes locales completas para Cash y origen de proyecciones.

Revision ID: 20261114_cash_local
Revises: 20261113_cash_columnas
"""
from alembic import op
import sqlalchemy as sa

revision = "20261114_cash_local"
down_revision = "20261113_cash_columnas"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("erp_libro_diario", "erp_libro_mayor"):
        op.add_column(table, sa.Column("es_obra", sa.Boolean(), nullable=False, server_default=sa.true()))
    for field in ("diario_cash_importado", "mayor_cash_importado"):
        op.add_column("erp_cash_periodos", sa.Column(field, sa.Boolean(), nullable=False, server_default=sa.false()))
    # El histórico no registra su origen: conservarlo como manual evita
    # reemplazar decisiones del usuario por una inferencia sobre su importe.
    op.add_column("erp_cash_proyectado", sa.Column("origen_proyectado", sa.String(15), nullable=False, server_default="MANUAL"))
    op.create_check_constraint("ck_cash_proyectado_origen", "erp_cash_proyectado", "origen_proyectado IN ('MANUAL', 'CALCULADO')")


def downgrade():
    op.drop_constraint("ck_cash_proyectado_origen", "erp_cash_proyectado", type_="check")
    op.drop_column("erp_cash_proyectado", "origen_proyectado")
    for field in ("diario_cash_importado", "mayor_cash_importado"):
        op.drop_column("erp_cash_periodos", field)
    for table in ("erp_libro_diario", "erp_libro_mayor"):
        op.drop_column(table, "es_obra")
