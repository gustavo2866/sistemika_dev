"""Prueba PostgreSQL transaccional; requiere MIGRATION_TEST_DATABASE_URL.

Usa un esquema aislado y revierte todas las operaciones, incluso ante fallos.
"""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine
from sqlalchemy.exc import DBAPIError


def test_consolidacion_y_total_persistido_postgresql():
    url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Definir MIGRATION_TEST_DATABASE_URL para probar en PostgreSQL")
    engine = create_engine(url.replace("postgresql://", "postgresql+psycopg://"))
    schema = f"test_cash_columnas_{uuid4().hex}"
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}", public')
            connection.exec_driver_sql("CREATE TABLE metodo_proyeccion (id integer PRIMARY KEY, nombre text)")
            connection.exec_driver_sql("CREATE TABLE erp_cash_cuentas (id integer PRIMARY KEY, id_metodo_proyeccion integer)")
            connection.exec_driver_sql("""
                CREATE TABLE erp_cash_proyectado (
                    id integer PRIMARY KEY, cuenta_cash_id integer NOT NULL,
                    fecha_periodo date NOT NULL, tipo varchar(30) NOT NULL,
                    importe numeric(18,2) NOT NULL DEFAULT 0, observacion varchar(255),
                    created_at timestamp NOT NULL DEFAULT now(),
                    updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
                    version integer NOT NULL DEFAULT 1,
                    CONSTRAINT ck_erp_cash_proyectado_tipo_valid CHECK
                        (tipo IN ('PROYECCION','pend','COMPROMETIDO','PRESUPUESTO','AJUSTE'))
                )
            """)
            connection.exec_driver_sql("CREATE INDEX ix_erp_cash_proyectado_tipo ON erp_cash_proyectado(tipo)")
            connection.exec_driver_sql("CREATE UNIQUE INDEX uq_erp_cash_proyectado_activo_cuenta_periodo_tipo ON erp_cash_proyectado(cuenta_cash_id,fecha_periodo,tipo) WHERE deleted_at IS NULL")
            connection.exec_driver_sql("INSERT INTO metodo_proyeccion VALUES (1,'Promedio'),(3,'Pendiente')")
            connection.exec_driver_sql("INSERT INTO erp_cash_cuentas VALUES (1,1),(2,3),(3,NULL)")
            connection.exec_driver_sql("""
                INSERT INTO erp_cash_proyectado (id,cuenta_cash_id,fecha_periodo,tipo,importe,observacion) VALUES
                (1,1,'2026-11-01','PROYECCION',100.25,'Proyección'),
                (2,1,'2026-11-01','pend',30.50,NULL),
                (3,1,'2026-11-01','COMPROMETIDO',20.25,'Orden comprometida'),
                (4,1,'2026-11-01','AJUSTE',999,NULL),
                (5,1,'2026-11-01','PRESUPUESTO',999,NULL),
                (6,2,'2026-11-01','pend',-50.25,NULL),
                (7,2,'2026-11-01','COMPROMETIDO',10.25,NULL),
                (8,3,'2026-11-01','COMPROMETIDO',5,NULL)
            """)
            connection.exec_driver_sql("INSERT INTO erp_cash_proyectado (id,cuenta_cash_id,fecha_periodo,tipo,importe,deleted_at) VALUES (9,1,'2026-11-01','PROYECCION',500,now())")
            path = Path(__file__).resolve().parents[2] / "alembic/versions/20261113_cash_proyectado_columnas.py"
            spec = importlib.util.spec_from_file_location("cash_columnas", path)
            migration = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(migration)
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
            rows = connection.exec_driver_sql("SELECT cuenta_cash_id,importe_proyectado,importe_pendiente,importe_comprometido,total_proyectado,base_calculo,observacion FROM erp_cash_proyectado WHERE deleted_at IS NULL ORDER BY cuenta_cash_id").all()
            assert len(rows) == 3
            assert tuple(map(float, rows[0][1:5])) == (100.25, 30.50, 20.25, 120.50)
            assert rows[0][-1] == "Orden comprometida"
            assert float(rows[1][4]) == -40
            assert rows[1][5] == "PENDIENTE"
            assert float(rows[2][4]) == 5
            assert connection.exec_driver_sql("SELECT count(*) FROM erp_cash_proyectado WHERE deleted_at IS NOT NULL").scalar_one() == 1
            connection.exec_driver_sql("UPDATE erp_cash_proyectado SET importe_pendiente=75,base_calculo='PENDIENTE' WHERE id=1")
            assert float(connection.exec_driver_sql("SELECT total_proyectado FROM erp_cash_proyectado WHERE id=1").scalar_one()) == 95.25
            # Renombrar el catálogo no altera el criterio guardado del período.
            connection.exec_driver_sql("UPDATE metodo_proyeccion SET nombre='Renombrado' WHERE id=3")
            assert float(connection.exec_driver_sql("SELECT total_proyectado FROM erp_cash_proyectado WHERE id=6").scalar_one()) == -40
            with pytest.raises(DBAPIError), connection.begin_nested():
                connection.exec_driver_sql("UPDATE erp_cash_proyectado SET total_proyectado=999 WHERE id=1")
            with pytest.raises(DBAPIError), connection.begin_nested():
                connection.exec_driver_sql("INSERT INTO erp_cash_proyectado (id,cuenta_cash_id,fecha_periodo) VALUES (10,1,'2026-11-01')")
        finally:
            transaction.rollback()
    engine.dispose()
