"""Seed de Relacional y actualización del método Pendientes."""
from alembic import op

revision = "20261114_cash_metodos_seed"
down_revision = "20261114_cash_relacional"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE metodo_proyeccion SET nombre='Pendientes'
        WHERE nombre='Pendiente' AND NOT EXISTS
            (SELECT 1 FROM metodo_proyeccion WHERE nombre='Pendientes');
        INSERT INTO metodo_proyeccion (nombre,descripcion,activo,tipo_calculo,created_at,updated_at,version)
        VALUES ('Relacional','Porcentaje del proyectado de otra cuenta Cash del mismo mes',true,'RELACIONAL',now(),now(),1)
        ON CONFLICT (nombre) DO UPDATE SET tipo_calculo='RELACIONAL',activo=true,deleted_at=NULL,updated_at=now();
        INSERT INTO metodo_proyeccion (nombre,descripcion,activo,tipo_calculo,created_at,updated_at,version)
        VALUES ('Pendientes','Utiliza el saldo pendiente de la cuenta',true,'PENDIENTE',now(),now(),1)
        ON CONFLICT (nombre) DO UPDATE SET tipo_calculo='PENDIENTE',descripcion=EXCLUDED.descripcion,
            activo=true,deleted_at=NULL,updated_at=now();
        DELETE FROM metodo_proyeccion_detalle WHERE id_metodo_proyeccion IN
            (SELECT id FROM metodo_proyeccion WHERE tipo_calculo IN ('RELACIONAL','PENDIENTE'));
        UPDATE erp_cash_proyectado p SET tipo_calculo=m.tipo_calculo
        FROM metodo_proyeccion m WHERE p.id_metodo_proyeccion=m.id AND m.tipo_calculo='PENDIENTE';
    """)


def downgrade():
    # Los métodos podrían estar asignados a cuentas; no eliminarlos al bajar.
    pass
