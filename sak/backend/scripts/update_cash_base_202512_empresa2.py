"""Actualiza la base de diciembre desde ERP para las cuentas 1, 2 y 2124.

Sin --apply solo verifica el alcance. Guarda respaldo antes de escribir y valida
ERP, Mayor local, Cash y continuidad con enero antes de confirmar la transacción.
"""
import argparse
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg
from psycopg.rows import dict_row
from sqlalchemy import and_, or_, text
from sqlmodel import Session, select

from app.db import engine
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.libro_diario_sync import get_source_connection_kwargs
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.libro_mayor_sync import LIBRO_MAYOR_FIELDS
from app.services.cash_projection_configuration import lock_projection_configuration
from app.services.erp_cash_reconciliation_service import reconcile_cash


ACCOUNTS = (1, 2, 2124)
FINANCIAL_FIELDS = ("total_debe", "total_haber", "saldo_anterior", "saldo_periodo", "saldo_acumulado")
KEY_FIELDS = ("empresa_id", "periodo_anio", "periodo_mes", "nivel", "cuenta_codigo",
              "tipo_subcuenta", "nro_subcuenta", "centro_costo")


def business_key(row):
    return tuple(row[field] if isinstance(row, dict) else getattr(row, field) for field in KEY_FIELDS)


def main(apply: bool):
    with psycopg.connect(**get_source_connection_kwargs(), connect_timeout=20,
                         row_factory=dict_row) as source_conn:
        source_conn.read_only = True
        with source_conn.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cursor.execute("SET LOCAL statement_timeout = '45s'")
            cursor.execute("""SELECT id AS source_id, empresa_id, periodo_anio, periodo_mes,
                nivel, cuenta_codigo, tipo_subcuenta, nro_subcuenta, centro_costo,
                total_debe, total_haber, saldo_periodo, saldo_acumulado, recalculado_en,
                saldo_anterior, fecha_periodo FROM public.libro_mayor
                WHERE empresa_id=2 AND periodo_anio=2025 AND periodo_mes=12
                  AND cuenta_codigo=ANY(%s) AND nivel IN ('cuenta','subcuenta') ORDER BY id""",
                (list(ACCOUNTS),))
            source = cursor.fetchall()
            cursor.execute("""SELECT cuenta_codigo, sum(saldo_anterior) AS anterior
                FROM public.libro_mayor WHERE empresa_id=2 AND periodo_anio=2026
                  AND periodo_mes=1 AND nivel='subcuenta' AND cuenta_codigo=ANY(%s)
                GROUP BY cuenta_codigo""", (list(ACCOUNTS),))
            january = {r["cuenta_codigo"]: r["anterior"] for r in cursor.fetchall()}
    expected = {r["source_id"]: r for r in source}
    expected_by_key = {business_key(r): r for r in source}
    assert len(source) == len(expected) == 6, "El alcance de seis registros cambió; revisar antes de actualizar"
    assert len(expected_by_key) == 6, "Claves de negocio duplicadas en ERP"
    for row in source:
        assert row["saldo_anterior"] + row["saldo_periodo"] == row["saldo_acumulado"]
        assert row["total_debe"] + row["total_haber"] == row["saldo_periodo"]
    for account in ACCOUNTS:
        assert sum(r["saldo_acumulado"] for r in source
                   if r["cuenta_codigo"] == account and r["nivel"] == "subcuenta") == january[account]

    with Session(engine) as session:
        if not apply:
            session.exec(text("SET TRANSACTION READ ONLY"))
        else:
            session.exec(text("SET LOCAL lock_timeout='20s'"))
            session.exec(text("SET LOCAL statement_timeout='60s'"))
            lock_projection_configuration(session)
        periods_query = select(ErpCashPeriodo).where(ErpCashPeriodo.deleted_at.is_(None),
            ErpCashPeriodo.fecha_periodo.in_([date(2025,12,1), date(2026,1,1)]))
        periods = session.exec(periods_query.with_for_update() if apply else periods_query).all()
        cash_query = select(ErpCashSaldo).where(ErpCashSaldo.empresa_id == 2,
            ErpCashSaldo.periodo_anio == 2025, ErpCashSaldo.periodo_mes == 12,
            ErpCashSaldo.cuenta_codigo.in_(ACCOUNTS), ErpCashSaldo.deleted_at.is_(None))
        cash = session.exec(cash_query.with_for_update() if apply else cash_query).all()
        mayor_query = select(ErpLibroMayor).where(or_(
            ErpLibroMayor.source_id.in_(expected),
            and_(ErpLibroMayor.empresa_id == 2, ErpLibroMayor.periodo_anio == 2025,
                 ErpLibroMayor.periodo_mes == 12, ErpLibroMayor.cuenta_codigo.in_(ACCOUNTS)),
        ))
        mayor = session.exec(mayor_query.with_for_update() if apply else mayor_query).all()
        assert len(cash) == 6 and {business_key(row) for row in cash} == set(expected_by_key), "Las claves de Cash no coinciden con ERP"
        cash_collisions_query = select(ErpCashSaldo).where(ErpCashSaldo.source_id.in_(expected))
        collisions = session.exec(cash_collisions_query.with_for_update() if apply else cash_collisions_query).all()
        assert {r.id for r in collisions} <= {r.id for r in cash}, "Identificador ERP ya usado por otro registro Cash"
        for row in [*cash, *mayor]:
            assert business_key(row) in expected_by_key, "Conflicto de identidad"
            assert row.deleted_at is None, "No se restauran registros eliminados"
        assert len({business_key(r) for r in mayor}) == len(mayor), "Claves duplicadas en Mayor local"
        before = reconcile_cash(session, {date(2026,m,1) for m in range(1,12)})
        changes = [{"source_id_anterior": row.source_id,
                    "source_id_erp": expected_by_key[business_key(row)]["source_id"],
                    "cuenta": row.cuenta_codigo, "nivel": row.nivel,
                    "campos": {field: {"antes": getattr(row, field), "erp": expected_by_key[business_key(row)][field]}
                               for field in FINANCIAL_FIELDS if getattr(row, field) != expected_by_key[business_key(row)][field]}}
                   for row in cash]
        summary = {"modo": "aplicar" if apply else "verificar", "cash_registros": len(cash),
            "mayor_existentes": len(mayor), "mayor_a_insertar": len(expected) - len(mayor),
            "cambios": changes, "diferencias_conciliacion_antes": before["diferencias"]}
        if not apply:
            print(json.dumps(summary, default=str, indent=2))
            session.rollback()
            return
        stamp = datetime.now(UTC)
        backup_path = Path(__file__).resolve().parents[1] / "backups" / (
            "cash_mayor_empresa2_202512_before_" + stamp.strftime("%Y%m%dT%H%M%S%fZ") + ".json")
        backup_path.write_text(json.dumps({"fecha_utc": stamp, "erp": source,
            "cash_antes": [r.model_dump(mode="json") for r in cash],
            "mayor_antes": [r.model_dump(mode="json") for r in mayor],
            "periodos_antes": [r.model_dump(mode="json") for r in periods],
            "conciliacion_antes": before}, default=str, indent=2), encoding="utf-8")
        for row in cash:
            original = expected_by_key[business_key(row)]
            changed = False
            for field in (*FINANCIAL_FIELDS, "source_id", "recalculado_en", "fecha_periodo"):
                if getattr(row, field) != original[field]:
                    setattr(row, field, original[field])
                    changed = True
            if changed:
                row.updated_at = stamp
                row.version += 1
                session.add(row)
        existing_mayor = {business_key(r): r for r in mayor}
        for source_id, original in expected.items():
            payload = {field: original[field] for field in LIBRO_MAYOR_FIELDS}
            row = existing_mayor.get(business_key(original))
            if row is None:
                session.add(ErpLibroMayor(**payload, es_obra=False))
            else:
                changed = False
                for field, value in payload.items():
                    if getattr(row, field) != value:
                        setattr(row, field, value)
                        changed = True
                if changed:
                    row.updated_at = stamp
                    row.version += 1
                    session.add(row)
        session.flush()
        for model in (ErpCashSaldo, ErpLibroMayor):
            stored = session.exec(select(model).where(model.source_id.in_(expected))).all()
            assert len(stored) == 6
            for row in stored:
                assert all(getattr(row, field) == expected[row.source_id][field] for field in FINANCIAL_FIELDS)
        after = reconcile_cash(session, {date(2026,m,1) for m in range(1,12)})
        assert after["consistente"] is True, json.dumps(after, default=str)
        # Los estados de cierre y los períodos 2026 no se actualizan.
        assert not any(row in session.dirty for row in periods)
        session.commit()
        summary.update(respaldo=str(backup_path), conciliacion_despues=after, confirmado=True)
        print(json.dumps(summary, default=str, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    main(parser.parse_args().apply)
