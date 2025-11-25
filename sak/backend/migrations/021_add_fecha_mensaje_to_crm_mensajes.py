from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision = "021_add_fecha_mensaje_to_crm_mensajes"
down_revision = "020_fix_crm_mensajes_version_pg"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column(
    "crm_mensajes",
    sa.Column("fecha_mensaje", sa.DateTime(timezone=True), nullable=True),
  )
  op.execute("UPDATE crm_mensajes SET fecha_mensaje = created_at WHERE fecha_mensaje IS NULL")
  op.alter_column("crm_mensajes", "fecha_mensaje", nullable=False)


def downgrade() -> None:
  op.drop_column("crm_mensajes", "fecha_mensaje")
