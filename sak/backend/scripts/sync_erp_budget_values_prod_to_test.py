"""Copia solo ingres/egreso por mes de producción a test, sin borrar registros.

python scripts/sync_erp_budget_values_prod_to_test.py --year 2026 --months 11 12
python scripts/sync_erp_budget_values_prod_to_test.py --year 2026 --months 11 12 --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import bindparam, create_engine, text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.sync_erp_budget_prod_to_test import read_db_url  # noqa: E402

FIELDS = ("ingres", "egreso")


def money(value):
    return Decimal(str(value or 0))


def row_key(row):
    return (row["fecha"].replace(day=1), row["proyecto_id"], row["erp_cuenta_id"])


def build_plan(source, target, projects, accounts):
    """Identidad por mes/proyecto/cuenta; IDs iguales deben referir a la misma entidad."""
    source_by_key, target_by_key = {}, {}
    for rows, index, label in ((source, source_by_key, "producción"), (target, target_by_key, "test")):
        for row in rows:
            key = row_key(row)
            if key in index:
                raise ValueError(f"Presupuesto duplicado en {label}: {key}")
            index[key] = row
    for row in source:
        project = projects.get(row["proyecto_id"])
        account = accounts.get(row["erp_cuenta_id"])
        if not project or (project["nombre"], project["centro_costo"]) != (row["proyecto_nombre"], row["centro_costo"]):
            raise ValueError(f"El proyecto {row['proyecto_id']} no coincide entre producción y test")
        if not account or account["cod_cuenta"] != row["cod_cuenta"]:
            raise ValueError(f"La cuenta {row['erp_cuenta_id']} no coincide entre producción y test")

    updates, inserts = [], []
    for key in source_by_key.keys() | target_by_key.keys():
        origin, destination = source_by_key.get(key), target_by_key.get(key)
        desired = {field: money(origin[field]) if origin else Decimal("0") for field in FIELDS}
        if destination:
            if any(money(destination[field]) != desired[field] for field in FIELDS):
                updates.append({"id": destination["id"], "version": destination["version"], **desired})
        elif any(desired.values()):
            inserts.append({"fecha": key[0], "proyecto_id": key[1], "erp_cuenta_id": key[2], **desired})
    return {"updates": sorted(updates, key=lambda row: row["id"]),
            "inserts": sorted(inserts, key=row_key)}


def apply_plan(conn, plan):
    for row in plan["updates"]:
        result = conn.execute(text("""UPDATE erp_presupuestos
            SET ingres=:ingres, egreso=:egreso, updated_at=CURRENT_TIMESTAMP, version=version+1
            WHERE id=:id AND version=:version AND deleted_at IS NULL"""), row)
        if result.rowcount != 1:
            raise ValueError("Los datos de test cambiaron durante la copia; volver a simular")
    for row in plan["inserts"]:
        conn.execute(text("""INSERT INTO erp_presupuestos
            (fecha,proyecto_id,erp_cuenta_id,ingres,egreso,real_ingreso,real_egreso,
             obreros_cantidad,obreros_costo,created_at,updated_at,version)
            VALUES (:fecha,:proyecto_id,:erp_cuenta_id,:ingres,:egreso,0,0,0,0,
                    CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)"""), row)


def read_rows(conn, year, months, *, source=False, lock=False):
    extra = ",p.nombre AS proyecto_nombre,p.centro_costo,c.cod_cuenta" if source else ""
    joins = "JOIN proyectos p ON p.id=b.proyecto_id JOIN erp_cuentas c ON c.id=b.erp_cuenta_id" if source else ""
    query = text(f"""SELECT b.* {extra} FROM erp_presupuestos b {joins}
        WHERE b.deleted_at IS NULL AND b.fecha>=:start AND b.fecha<:end
        AND EXTRACT(MONTH FROM b.fecha) IN :months ORDER BY b.id
        {"FOR UPDATE OF b" if lock else ""}""").bindparams(bindparam("months", expanding=True))
    return [dict(row) for row in conn.execute(query, {
        "start": date(year, 1, 1), "end": date(year+1, 1, 1), "months": months,
    }).mappings()]


def run(year, months, *, apply=False):
    source_url = read_db_url(ROOT / ".env.production.local")
    target_url = read_db_url(ROOT / ".env")
    if source_url == target_url:
        raise ValueError("Producción y test deben ser bases distintas")
    production = create_engine(source_url, echo=False)
    test = create_engine(target_url, echo=False)
    try:
        with production.connect() as origin, test.connect() as destination:
            origin.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            if not apply:
                destination.execute(text("SET TRANSACTION READ ONLY"))
            source = read_rows(origin, year, months, source=True)
            for month in months:
                if not any(row["fecha"].month == month for row in source):
                    raise ValueError(f"Producción no tiene presupuestos activos para {year}-{month:02d}")
            target = read_rows(destination, year, months, lock=apply)
            projects = {row["id"]: row for row in destination.execute(text(
                "SELECT id,nombre,centro_costo FROM proyectos WHERE deleted_at IS NULL")).mappings()}
            accounts = {row["id"]: row for row in destination.execute(text(
                "SELECT id,cod_cuenta FROM erp_cuentas WHERE deleted_at IS NULL")).mappings()}
            plan = build_plan(source, target, projects, accounts)
            report = {"apply": apply, "year": year, "months": months,
                      "updated": len(plan["updates"]), "inserted": len(plan["inserts"]),
                      "source_rows": len(source), "target_rows_before": len(target)}
            report["source_totals"] = {
                str(month): {field: str(sum((money(row[field]) for row in source if row["fecha"].month == month), Decimal("0")))
                             for field in FIELDS} for month in months}
            if apply:
                backup = ROOT / "tmp" / f"budget_values_{year}_{datetime.now(UTC):%Y%m%dT%H%M%S%fZ}.json"
                backup.parent.mkdir(parents=True, exist_ok=True)
                backup.write_text(json.dumps({"report": report, "before": target, "plan": plan}, default=str, indent=2), encoding="utf-8")
                apply_plan(destination, plan)
                after = read_rows(destination, year, months)
                # Los reales, obreros y referencias de cada fila existente deben permanecer iguales.
                after_by_id = {row["id"]: row for row in after}
                untouched = set(target[0]) - {*FIELDS, "updated_at", "version"} if target else set()
                for row in target:
                    assert all(row[field] == after_by_id[row["id"]][field] for field in untouched)
                for month in months:
                    for field in FIELDS:
                        assert sum(money(row[field]) for row in source if row["fecha"].month == month) == sum(money(row[field]) for row in after if row["fecha"].month == month)
                destination.commit()
                report["backup"] = str(backup)
            else:
                destination.rollback()
            origin.rollback()
            return report
    finally:
        production.dispose()
        test.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--months", type=int, choices=range(1, 13), nargs="+", required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.year, sorted(set(args.months)), apply=args.apply), indent=2))


if __name__ == "__main__":
    main()
