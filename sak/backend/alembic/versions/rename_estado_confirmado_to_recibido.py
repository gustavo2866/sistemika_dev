"""rename estado confirmado to recibido

Revision ID: rename_estado_confirmado
Revises: f8c734a461d2
Create Date: 2025-11-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'rename_estado_confirmado'
down_revision = '474a0baead68'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Paso 1: Eliminar el CHECK constraint existente primero
    op.drop_constraint('chk_crm_mensajes_estado', 'crm_mensajes', type_='check')
    
    # Paso 2: Actualizar los valores existentes en la tabla
    op.execute("""
        UPDATE crm_mensajes 
        SET estado = 'recibido' 
        WHERE estado = 'confirmado'
    """)
    
    # Paso 3: Crear el nuevo CHECK constraint con 'recibido' en lugar de 'confirmado'
    op.create_check_constraint(
        'chk_crm_mensajes_estado',
        'crm_mensajes',
        "estado IN ('nuevo','recibido','descartado','pendiente_envio','enviado','error_envio')"
    )


def downgrade() -> None:
    # Paso 1: Eliminar el nuevo CHECK constraint
    op.drop_constraint('chk_crm_mensajes_estado', 'crm_mensajes', type_='check')
    
    # Paso 2: Restaurar el CHECK constraint original
    op.create_check_constraint(
        'chk_crm_mensajes_estado',
        'crm_mensajes',
        "estado IN ('nuevo','confirmado','descartado','pendiente_envio','enviado','error_envio')"
    )
    
    # Paso 3: Revertir los valores en la tabla
    op.execute("""
        UPDATE crm_mensajes 
        SET estado = 'confirmado' 
        WHERE estado = 'recibido'
    """)
