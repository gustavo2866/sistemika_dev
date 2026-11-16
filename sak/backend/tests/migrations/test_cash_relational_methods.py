"""Migración y seeds en un esquema PostgreSQL aislado, siempre revertido."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError


def test_migracion_relacional_y_seeds_preservan_importes():
    url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Definir MIGRATION_TEST_DATABASE_URL")
    engine = create_engine(url.replace("postgresql://", "postgresql+psycopg://"))
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            schema = "test_cash_relacional_" + uuid4().hex
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            conn.exec_driver_sql(f'SET LOCAL search_path TO "{schema}", public')
            conn.exec_driver_sql("""CREATE TABLE metodo_proyeccion (
                id serial primary key, nombre text unique, descripcion text, activo boolean default true,
                created_at timestamp default now(), updated_at timestamp default now(), deleted_at timestamp,
                version integer default 1, base_calculo varchar(20) default 'PROYECTADO',
                CONSTRAINT ck_metodo_proyeccion_base_calculo CHECK (base_calculo IN ('PROYECTADO','PENDIENTE')));
                CREATE TABLE erp_cash_cuentas (id integer primary key, id_metodo_proyeccion integer);
                CREATE TABLE metodo_proyeccion_cuenta (id integer);
                CREATE TABLE metodo_proyeccion_detalle (id integer, id_metodo_proyeccion integer);
                CREATE TABLE erp_cash_proyectado (id integer primary key, id_metodo_proyeccion integer,
                    importe_proyectado numeric(18,2), importe_pendiente numeric(18,2), importe_comprometido numeric(18,2),
                    base_calculo varchar(20) default 'PROYECTADO',
                    CONSTRAINT ck_erp_cash_proyectado_base_calculo CHECK (base_calculo IN ('PROYECTADO','PENDIENTE')),
                    total_proyectado numeric(18,2) GENERATED ALWAYS AS
                    (CASE WHEN base_calculo='PENDIENTE' THEN importe_pendiente ELSE importe_proyectado END + importe_comprometido) STORED);
                INSERT INTO metodo_proyeccion (nombre,base_calculo) VALUES ('Mes anterior','PROYECTADO'),('Pendiente','PENDIENTE');
                INSERT INTO metodo_proyeccion_detalle VALUES (1,1),(2,2);
                INSERT INTO erp_cash_cuentas VALUES (1,1),(2,2);
                INSERT INTO erp_cash_proyectado VALUES (1,1,100,20,5,'PROYECTADO',DEFAULT),(2,2,999,50,7,'PENDIENTE',DEFAULT);
            """)
            before = conn.exec_driver_sql("SELECT importe_proyectado,importe_pendiente,importe_comprometido,total_proyectado FROM erp_cash_proyectado ORDER BY id").all()
            for filename in ["20261114_cash_metodos_relacionales.py", "20261114_seed_cash_projection_methods.py", "20261114_seed_cash_projection_methods.py"]:
                path = Path(__file__).resolve().parents[2] / "alembic/versions" / filename
                spec = importlib.util.spec_from_file_location("migration_under_test", path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                with Operations.context(MigrationContext.configure(conn)):
                    module.upgrade()
            after = conn.exec_driver_sql("SELECT importe_proyectado,importe_pendiente,importe_comprometido,total_proyectado FROM erp_cash_proyectado ORDER BY id").all()
            assert before == after
            assert conn.exec_driver_sql("SELECT nombre,tipo_calculo FROM metodo_proyeccion ORDER BY id").all() == [
                ("Mes anterior", "HISTORICO"), ("Pendientes", "PENDIENTE"), ("Relacional", "RELACIONAL")]
            assert conn.exec_driver_sql("SELECT * FROM metodo_proyeccion_detalle").all() == [(1, 1)]
            assert conn.exec_driver_sql(f"SELECT to_regclass('{schema}.metodo_proyeccion_cuenta')").scalar_one() is None
            conn.exec_driver_sql("UPDATE erp_cash_cuentas SET cuenta_cash_referencia_id=1, porcentaje=5 WHERE id=2")
            with pytest.raises(IntegrityError), conn.begin_nested():
                conn.exec_driver_sql("UPDATE erp_cash_cuentas SET cuenta_cash_referencia_id=999 WHERE id=2")
            conn.exec_driver_sql("UPDATE erp_cash_proyectado SET tipo_calculo='RELACIONAL' WHERE id=1")
            assert conn.exec_driver_sql("SELECT total_proyectado FROM erp_cash_proyectado WHERE id=1").scalar_one() == 105
        finally:
            tx.rollback()
    engine.dispose()
