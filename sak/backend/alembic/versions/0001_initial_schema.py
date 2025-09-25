"""Initial schema using SQLModel metadata."""

from alembic import op
from sqlmodel import SQLModel

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    import app.models  # noqa: F401
    bind = op.get_bind()
    SQLModel.metadata.create_all(bind)


def downgrade() -> None:
    import app.models  # noqa: F401
    bind = op.get_bind()
    SQLModel.metadata.drop_all(bind)
