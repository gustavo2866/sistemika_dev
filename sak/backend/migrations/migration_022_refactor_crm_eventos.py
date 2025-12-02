"""Refactorización del modelo de eventos CRM

Revision ID: 022_refactor_crm_eventos
Revises: 021_add_fecha_mensaje_to_crm_mensajes
Create Date: 2025-12-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "022_refactor_crm_eventos"
down_revision = "021_add_fecha_mensaje_to_crm_mensajes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Migración de crm_eventos a nueva estructura simplificada
    """
    
    # ===== PASO 1: Agregar nuevas columnas (temporalmente opcionales) =====
    
    print("Paso 1: Agregando nuevas columnas...")
    
    op.add_column(
        'crm_eventos',
        sa.Column('titulo', sa.String(255), nullable=True)
    )
    
    op.add_column(
        'crm_eventos',
        sa.Column('tipo_evento', sa.String(20), nullable=True)
    )
    
    op.add_column(
        'crm_eventos',
        sa.Column('resultado', sa.Text(), nullable=True)
    )
    
    # ===== PASO 2: Migrar datos existentes =====
    
    print("Paso 2: Migrando datos existentes...")
    
    # 2.1 Generar título desde descripción o tipo+motivo
    op.execute("""
        UPDATE crm_eventos e
        SET titulo = CASE
            -- Si tiene descripción, usar los primeros 250 caracteres
            WHEN e.descripcion IS NOT NULL AND LENGTH(e.descripcion) > 0 
                THEN LEFT(e.descripcion, 250)
            -- Si no, generar desde tipo + motivo
            ELSE CONCAT(
                COALESCE((SELECT nombre FROM crm_tipos_evento WHERE id = e.tipo_id), 'Evento'),
                ' - ',
                COALESCE((SELECT nombre FROM crm_motivos_evento WHERE id = e.motivo_id), 'General')
            )
        END
        WHERE titulo IS NULL
    """)
    
    # 2.2 Mapear tipo_id a tipo_evento (enum simplificado)
    op.execute("""
        UPDATE crm_eventos e
        SET tipo_evento = CASE
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%LLAMADA%' THEN 'llamada'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%REUNION%' THEN 'reunion'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%VISITA%' THEN 'visita'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%EMAIL%' THEN 'email'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%WHATSAPP%' THEN 'whatsapp'
            ELSE 'nota'
        END
        WHERE tipo_evento IS NULL
    """)
    
    # 2.3 Renombrar columna estado_evento a estado
    op.alter_column('crm_eventos', 'estado_evento', new_column_name='estado')
    
    # 2.4 Actualizar valores de estado: 'hecho' → '2-realizado', 'pendiente' → '1-pendiente'
    op.execute("""
        UPDATE crm_eventos 
        SET estado = CASE
            WHEN estado = 'hecho' THEN '2-realizado'
            WHEN estado = 'pendiente' THEN '1-pendiente'
            ELSE estado
        END
    """)
    
    # 2.5 Hacer descripcion opcional (eliminar restricción NOT NULL si existe)
    op.alter_column('crm_eventos', 'descripcion', nullable=True)
    
    # 2.6 Eliminar eventos sin oportunidad (no deberían existir en la nueva estructura)
    # Primero, intentar asignarles oportunidad desde contacto si es posible
    op.execute("""
        UPDATE crm_eventos e
        SET oportunidad_id = (
            SELECT o.id 
            FROM crm_oportunidades o 
            WHERE o.contacto_id = e.contacto_id 
            AND o.activo = true
            ORDER BY o.created_at DESC 
            LIMIT 1
        )
        WHERE e.oportunidad_id IS NULL 
        AND e.contacto_id IS NOT NULL
    """)
    
    # Marcar como eliminados los eventos que aún no tienen oportunidad
    op.execute("""
        UPDATE crm_eventos
        SET deleted_at = NOW()
        WHERE oportunidad_id IS NULL
        AND deleted_at IS NULL
    """)
    
    # ===== PASO 3: Hacer obligatorias las nuevas columnas =====
    
    print("Paso 3: Aplicando restricciones...")
    
    op.alter_column('crm_eventos', 'titulo', nullable=False)
    op.alter_column('crm_eventos', 'tipo_evento', nullable=False)
    op.alter_column('crm_eventos', 'oportunidad_id', nullable=False)
    
    # ===== PASO 4: Eliminar columnas y constraints obsoletos =====
    
    print("Paso 4: Eliminando columnas y constraints obsoletos...")
    
    # Eliminar foreign keys
    try:
        op.drop_constraint('crm_eventos_contacto_id_fkey', 'crm_eventos', type_='foreignkey')
    except:
        pass
    
    try:
        op.drop_constraint('crm_eventos_tipo_id_fkey', 'crm_eventos', type_='foreignkey')
    except:
        pass
    
    try:
        op.drop_constraint('crm_eventos_motivo_id_fkey', 'crm_eventos', type_='foreignkey')
    except:
        pass
    
    try:
        op.drop_constraint('crm_eventos_origen_lead_id_fkey', 'crm_eventos', type_='foreignkey')
    except:
        pass
    
    # Eliminar índices asociados a las columnas que se van a borrar
    try:
        op.drop_index('ix_crm_eventos_contacto_id', table_name='crm_eventos')
    except:
        pass
    
    # Eliminar columnas obsoletas
    op.drop_column('crm_eventos', 'contacto_id')
    op.drop_column('crm_eventos', 'tipo_id')
    op.drop_column('crm_eventos', 'motivo_id')
    op.drop_column('crm_eventos', 'origen_lead_id')
    op.drop_column('crm_eventos', 'proximo_paso')
    op.drop_column('crm_eventos', 'fecha_compromiso')
    
    # ===== PASO 5: Crear nuevos índices =====
    
    print("Paso 5: Creando índices optimizados...")
    
    op.create_index('ix_crm_eventos_tipo_evento', 'crm_eventos', ['tipo_evento'])
    op.create_index('ix_crm_eventos_estado', 'crm_eventos', ['estado'])
    
    print("Migración completada exitosamente!")


def downgrade() -> None:
    """
    Reversión de cambios (solo esquema, datos no recuperables)
    """
    
    print("ADVERTENCIA: El downgrade solo restaura el esquema, no los datos originales")
    
    # Eliminar índices nuevos
    op.drop_index('ix_crm_eventos_tipo_evento', table_name='crm_eventos')
    op.drop_index('ix_crm_eventos_estado', table_name='crm_eventos')
    
    # Restaurar columnas antiguas (vacías)
    op.add_column('crm_eventos', sa.Column('contacto_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('tipo_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('motivo_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('origen_lead_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('proximo_paso', sa.String(500), nullable=True))
    op.add_column('crm_eventos', sa.Column('fecha_compromiso', sa.Date(), nullable=True))
    
    # Renombrar estado a estado_evento
    op.alter_column('crm_eventos', 'estado', new_column_name='estado_evento')
    
    # Eliminar columnas nuevas
    op.drop_column('crm_eventos', 'titulo')
    op.drop_column('crm_eventos', 'tipo_evento')
    op.drop_column('crm_eventos', 'resultado')
    
    # Restaurar foreign keys (sin datos)
    op.create_foreign_key('crm_eventos_contacto_id_fkey', 'crm_eventos', 'crm_contactos', ['contacto_id'], ['id'])
    op.create_foreign_key('crm_eventos_tipo_id_fkey', 'crm_eventos', 'crm_tipos_evento', ['tipo_id'], ['id'])
    op.create_foreign_key('crm_eventos_motivo_id_fkey', 'crm_eventos', 'crm_motivos_evento', ['motivo_id'], ['id'])
    
    op.alter_column('crm_eventos', 'descripcion', nullable=False)
    op.alter_column('crm_eventos', 'oportunidad_id', nullable=True)
