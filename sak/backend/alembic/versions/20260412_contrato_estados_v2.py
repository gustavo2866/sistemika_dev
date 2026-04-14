"""contrato_estados_v2: reemplaza contrato_renovado_id por contrato_origen_id, nuevos estados

Revision ID: 20260412_contrato_estados_v2
Revises: f46ecf3ad07a
Create Date: 2026-04-12

Cambios:
- Agrega columna contrato_origen_id (FK a contratos.id)
- Renombra/migra registros con estado 'renovado' → 'finalizado'
- Registros con estado 'vencido' → 'vigente' (vencido es computed, no estado)
- contrato_renovado_id se mantiene en DB por compatibilidad (no se elimina para no romper datos)
"""
from alembic import op
import sqlalchemy as sa

revision = "20260412_contrato_estados_v2"
down_revision = "f46ecf3ad07a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna contrato_origen_id
    op.add_column(
        "contratos",
        sa.Column("contrato_origen_id", sa.Integer(), sa.ForeignKey("contratos.id"), nullable=True),
    )
    op.create_index("ix_contratos_contrato_origen_id", "contratos", ["contrato_origen_id"], unique=False)

    # Migrar datos: rellenar contrato_origen_id a partir de contrato_renovado_id
    # Si A.contrato_renovado_id = B.id → B.contrato_origen_id = A.id
    op.execute("""
        UPDATE contratos AS nuevo
        SET contrato_origen_id = origen.id
        FROM contratos AS origen
        WHERE origen.contrato_renovado_id = nuevo.id
    """)

    # Migrar estados obsoletos
    # 'renovado' → 'finalizado' (era el contrato anterior en una renovación)
    op.execute("UPDATE contratos SET estado = 'finalizado' WHERE estado = 'renovado'")
    # 'vencido' → 'vigente' (vencido pasa a ser una condición computable)
    op.execute("UPDATE contratos SET estado = 'vigente' WHERE estado = 'vencido'")


def downgrade() -> None:
    # Revertir estados
    op.execute("UPDATE contratos SET estado = 'vencido' WHERE estado = 'vigente' AND fecha_vencimiento < CURRENT_DATE")
    op.execute("""
        UPDATE contratos SET estado = 'renovado'
        WHERE estado = 'finalizado' AND contrato_renovado_id IS NOT NULL
    """)

    op.drop_index("ix_contratos_contrato_origen_id", table_name="contratos")
    op.drop_column("contratos", "contrato_origen_id")
