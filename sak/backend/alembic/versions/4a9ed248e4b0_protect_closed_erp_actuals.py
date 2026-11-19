"""Protect synchronized actuals in closed ERP periods.

Revision ID: 4a9ed248e4b0
Revises: 20261118_cash_clear_auto
"""
from alembic import op

revision = "4a9ed248e4b0"
down_revision = "20261118_cash_clear_auto"
branch_labels = None
depends_on = None

TABLES = {
    "erp_libro_diario": "'periodo_anio', 'periodo_mes'",
    "erp_libro_mayor": "'periodo_anio', 'periodo_mes'",
    "erp_cash_diarios": "'periodo_anio', 'periodo_mes'",
    "erp_cash_saldos": "'periodo_anio', 'periodo_mes'",
    "erp_presupuestos": "'fecha'",
    "erp_cash_periodos": "'fecha_periodo'",
}


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION protect_closed_erp_actuals() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            previous_data jsonb;
            next_data jsonb;
            previous_month date;
            next_month date;
            period_state text;
        BEGIN
            previous_data := to_jsonb(OLD);
            IF TG_NARGS = 1 THEN
                previous_month := date_trunc('month', (previous_data->>TG_ARGV[0])::date)::date;
            ELSE
                previous_month := make_date((previous_data->>TG_ARGV[0])::integer,
                                            (previous_data->>TG_ARGV[1])::integer, 1);
            END IF;
            IF TG_OP = 'UPDATE' THEN
                next_data := to_jsonb(NEW);
                IF TG_NARGS = 1 THEN
                    next_month := date_trunc('month', (next_data->>TG_ARGV[0])::date)::date;
                ELSE
                    next_month := make_date((next_data->>TG_ARGV[0])::integer,
                                            (next_data->>TG_ARGV[1])::integer, 1);
                END IF;
                -- Permitir ediciones y la reapertura expl?cita; impedir ocultar o trasladar datos.
                IF previous_month IS NOT DISTINCT FROM next_month
                   AND (next_data->>'deleted_at' IS NULL OR previous_data->>'deleted_at' IS NOT NULL) THEN
                    RETURN NEW;
                END IF;
            END IF;
            -- El esquema del propio registro evita depender del search_path del cliente.
            -- FOR SHARE serializa el borrado con un cierre/reapertura concurrente.
            EXECUTE format('SELECT estado FROM %I.erp_cash_periodos
                WHERE fecha_periodo = $1 AND deleted_at IS NULL FOR SHARE', TG_TABLE_SCHEMA)
                INTO period_state USING previous_month;
            IF period_state = 'CERRADO' THEN
                RAISE EXCEPTION 'El per?odo % est? cerrado; debe reabrirse para eliminar o reemplazar datos de %',
                    to_char(previous_month, 'YYYY-MM'), TG_TABLE_NAME USING ERRCODE = '23514';
            END IF;
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        CREATE FUNCTION protect_closed_erp_truncate() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE closed_month date;
        BEGIN
            EXECUTE format('SELECT fecha_periodo FROM %I.erp_cash_periodos
                WHERE estado = ''CERRADO'' AND deleted_at IS NULL
                ORDER BY fecha_periodo LIMIT 1 FOR SHARE', TG_TABLE_SCHEMA)
                INTO closed_month;
            IF closed_month IS NOT NULL THEN
                RAISE EXCEPTION 'No se puede vaciar % mientras existan per?odos cerrados', TG_TABLE_NAME
                    USING ERRCODE = '23514';
            END IF;
            RETURN NULL;
        END;
        $$;
    """)
    for table, args in TABLES.items():
        op.execute(f"""CREATE TRIGGER protect_closed_actuals
            BEFORE DELETE OR UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION protect_closed_erp_actuals({args})""")
        op.execute(f"""CREATE TRIGGER protect_closed_truncate
            BEFORE TRUNCATE ON {table}
            FOR EACH STATEMENT EXECUTE FUNCTION protect_closed_erp_truncate()""")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP TRIGGER protect_closed_truncate ON {table}")
        op.execute(f"DROP TRIGGER protect_closed_actuals ON {table}")
    op.execute("DROP FUNCTION protect_closed_erp_truncate()")
    op.execute("DROP FUNCTION protect_closed_erp_actuals()")
