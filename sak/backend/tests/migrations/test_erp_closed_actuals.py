"""Protecci?n real PostgreSQL en un esquema aislado y revertido al finalizar."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError


def test_closed_actuals_reject_delete_soft_delete_move_and_truncate():
    url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Definir MIGRATION_TEST_DATABASE_URL para probar PostgreSQL")
    migration_path = Path(__file__).resolve().parents[2] / "alembic/versions/4a9ed248e4b0_protect_closed_erp_actuals.py"
    spec = importlib.util.spec_from_file_location("closed_actuals_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine(url.replace("postgresql://", "postgresql+psycopg://"))
    schema = "test_closed_actuals_" + uuid4().hex
    try:
        with engine.connect() as conn:
            transaction = conn.begin()
            try:
                conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
                conn.exec_driver_sql(f'SET LOCAL search_path TO "{schema}", public')
                conn.exec_driver_sql("""CREATE TABLE erp_cash_periodos (
                    id integer PRIMARY KEY, fecha_periodo date, estado text, deleted_at timestamptz)""")
                conn.exec_driver_sql("""INSERT INTO erp_cash_periodos VALUES
                    (1,'2026-09-01','CERRADO',NULL),(2,'2026-10-01','EN_CIERRE',NULL),
                    (3,'2026-11-01','ABIERTO',NULL)""")
                for table in migration.TABLES:
                    if table == "erp_cash_periodos":
                        continue
                    columns = "fecha date" if table == "erp_presupuestos" else "periodo_anio integer, periodo_mes integer"
                    conn.exec_driver_sql(f"CREATE TABLE {table} (id integer PRIMARY KEY, {columns}, deleted_at timestamptz)")
                    dates = "'2026-09-15'" if table == "erp_presupuestos" else "2026,9"
                    conn.exec_driver_sql(f"INSERT INTO {table} VALUES (1,{dates},NULL)")
                migration.op = Operations(MigrationContext.configure(conn))
                migration.upgrade()
                for table in migration.TABLES:
                    month_column = "fecha_periodo" if table == "erp_cash_periodos" else "fecha"
                    move = f"{month_column}='2026-10-01'" if table in {"erp_presupuestos", "erp_cash_periodos"} else "periodo_mes=10"
                    for statement in [
                        f"DELETE FROM {table} WHERE id=1",
                        f"UPDATE {table} SET deleted_at=now() WHERE id=1",
                        f"UPDATE {table} SET {move} WHERE id=1",
                        f"TRUNCATE {table}",
                    ]:
                        with conn.begin_nested() as savepoint:
                            with pytest.raises(IntegrityError, match="cerrado"):
                                conn.exec_driver_sql(statement)
                            savepoint.rollback()
                    assert conn.exec_driver_sql(f"SELECT count(*) FROM {table} WHERE id=1 AND deleted_at IS NULL").scalar_one() == 1
                    # Meses en cierre y abiertos mantienen su funcionamiento normal.
                    if table != "erp_cash_periodos":
                        for record_id, month in [(2,10),(3,11)]:
                            values = f"'2026-{month}-01'" if table == "erp_presupuestos" else f"2026,{month}"
                            conn.exec_driver_sql(f"INSERT INTO {table} VALUES ({record_id},{values},NULL)")
                            conn.exec_driver_sql(f"UPDATE {table} SET deleted_at=now() WHERE id={record_id}")
                            conn.exec_driver_sql(f"DELETE FROM {table} WHERE id={record_id}")
                # Reabrir expl?citamente permite una nueva importaci?n del per?odo.
                conn.exec_driver_sql("UPDATE erp_cash_periodos SET estado='EN_CIERRE' WHERE id=1")
                conn.exec_driver_sql("DELETE FROM erp_libro_diario WHERE id=1")
                assert conn.exec_driver_sql("SELECT count(*) FROM erp_libro_diario").scalar_one() == 0
                conn.exec_driver_sql("UPDATE erp_cash_periodos SET estado='CERRADO' WHERE id=1")
                migration.downgrade()
                conn.exec_driver_sql("DELETE FROM erp_libro_mayor WHERE id=1")
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
