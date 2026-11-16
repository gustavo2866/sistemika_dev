"""Verifica en PostgreSQL el alcance de importación, sin tocar datos operativos."""
import os
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import MetaData, create_engine


def test_importacion_incluye_cash_sin_ampliar_el_alcance_de_obras():
    url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Definir MIGRATION_TEST_DATABASE_URL para probar PostgreSQL")
    from app.models.erp.libro_diario import ErpLibroDiario
    from app.models.erp.libro_mayor import ErpLibroMayor
    from app.models.erp.libro_diario_sync import SELECT_QUERY, INSERT_QUERY, build_insert_rows
    from app.models.erp.libro_mayor_sync import SOURCE_QUERY

    engine = create_engine(url.replace("postgresql://", "postgresql+psycopg://"))
    schema = "test_cash_sources_" + uuid4().hex
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            metadata = MetaData()
            diario = ErpLibroDiario.__table__.to_metadata(metadata, schema=schema, name="libro_diario")
            mayor = ErpLibroMayor.__table__.to_metadata(metadata, schema=schema, name="libro_mayor")
            target = ErpLibroDiario.__table__.to_metadata(metadata, schema=schema, name="erp_libro_diario")
            metadata.create_all(conn)
            conn.exec_driver_sql(f'CREATE TABLE "{schema}".dim_cuenta (nro_cta integer, extendido text, sub_rubro text)')
            conn.exec_driver_sql(f"INSERT INTO {schema}.dim_cuenta VALUES (1,'1.1','Fondos'),(4100,'4.1','01 - OBRAS')")
            for source_id, company, account, center in [
                (1,1,1,None), (2,1,4100,None), (3,2,4100,"10"),
                (4,6,4100,"10"), (5,3,4100,"10"), (6,1,999,None), (7,6,999,None),
            ]:
                base = dict(id=source_id,source_id=source_id,empresa_id=company,
                    cuenta_codigo=account,centro_costo=center,periodo_anio=2026,periodo_mes=10)
                conn.execute(diario.insert(), {**base,"fecha":date(2026,10,1)})
                conn.execute(mayor.insert(), {**base,"nivel":"subcuenta"})
            conn.execute(mayor.insert(), dict(id=8, source_id=8, empresa_id=1,
                cuenta_codigo=1, periodo_anio=2026, periodo_mes=10, nivel="cuenta"))
            params = (["10"],2026,10,["10"])
            rows = conn.exec_driver_sql(SELECT_QUERY.replace("public.",schema+"."),params).all()
            assert [row[0] for row in rows] == [1,2,3,4,6]
            assert [row[-1] for row in rows] == [False,False,True,True,False]
            # El INSERT de producción acepta el nuevo formato y conserva origen.
            for row in build_insert_rows(rows):
                conn.exec_driver_sql(INSERT_QUERY.replace("public.",schema+"."),row)
            assert conn.execute(target.select()).fetchall()
            saldos = conn.exec_driver_sql(SOURCE_QUERY.replace("public.",schema+"."),params).mappings().all()
            assert [row["source_id"] for row in saldos] == [1,2,3,4,6]
            assert [row["es_obra"] for row in saldos] == [False,False,True,True,False]
            from app.services.erp_sync_periods_service import SOURCE_PERIODS_QUERY
            for record_id, company, year, month, account, center in [
                (9, 1, 2026, 11, 1, None),
                (12, 3, 2027, 3, 1, None),
                (13, 6, 2027, 3, 4100, "999"),
                (14, 6, 2027, 2, 4100, "10"),
            ]:
                conn.execute(diario.insert(), dict(id=record_id,source_id=record_id,empresa_id=company,
                    periodo_anio=year,periodo_mes=month,fecha=date(year,month,1),
                    cuenta_codigo=account,centro_costo=center))
            for record_id, month, level in [(10,1,"subcuenta"),(11,4,"cuenta")]:
                conn.execute(mayor.insert(), dict(id=record_id,source_id=record_id,empresa_id=2,
                    periodo_anio=2027,periodo_mes=month,cuenta_codigo=1,nivel=level))
            available = conn.exec_driver_sql(SOURCE_PERIODS_QUERY.replace("public.",schema+"."),
                (2026,10,["10"],2026,10,["10"])).all()
            assert available == [(2026,10),(2026,11),(2027,1),(2027,2)]
            available = conn.exec_driver_sql(SOURCE_PERIODS_QUERY.replace("public.",schema+"."),
                (2026,11,["10"],2026,11,["10"])).all()
            assert available == [(2026,11),(2027,1),(2027,2)]
        finally:
            transaction.rollback()
    engine.dispose()
