#!/usr/bin/env python
"""Sincroniza erp_cash_map contra erp_cash_map_1.csv preservando los mapeos Fondo.

Uso tipico sobre test:
    $env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL_TEST" --project="sak-wcl"
    python scripts/sync_erp_cash_map_from_csv1.py --dry-run
    python scripts/sync_erp_cash_map_from_csv1.py --apply
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import func, or_
from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_cuenta import ErpCashCuenta  # noqa: E402
from app.models.erp.cash_map import ErpCashMap  # noqa: E402


SOURCE_CSV = BACKEND_ROOT / "data" / "erp_cash_map_1.csv"


@dataclass(frozen=True)
class CashMapSeed:
    nro_cta: int
    moneda: str
    categoria: str | None
    map_debe: str
    map_haber: str


def normalize_nullable_text(value: str | None) -> str | None:
    normalized = " ".join(str(value or "").strip().split())
    return normalized or None


def map_key(nro_cta: int, moneda: str, categoria: str | None) -> tuple[int, str, str | None]:
    return nro_cta, moneda, normalize_nullable_text(categoria)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza erp_cash_map desde erp_cash_map_1.csv preservando filas Fondo.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Muestra cambios sin aplicar.")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios en la base.")
    return parser.parse_args()


def load_source_rows(path: Path) -> list[CashMapSeed]:
    rows: list[CashMapSeed] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for raw in reader:
            nro_cta_text = str(raw.get("nro_cta") or "").strip()
            moneda = str(raw.get("Moneda") or "").strip()
            map_debe = normalize_nullable_text(raw.get("map_debe"))
            map_haber = normalize_nullable_text(raw.get("map_haber"))
            if not nro_cta_text or not moneda or not map_debe or not map_haber:
                continue
            rows.append(
                CashMapSeed(
                    nro_cta=int(nro_cta_text),
                    moneda=moneda,
                    categoria=normalize_nullable_text(raw.get("CATEGORIA")),
                    map_debe=map_debe,
                    map_haber=map_haber,
                )
            )
    return rows


def get_cash_account_ids(session: Session) -> dict[str, int]:
    rows = session.exec(
        select(ErpCashCuenta)
        .where(ErpCashCuenta.deleted_at.is_(None))
        .order_by(ErpCashCuenta.id)
    ).all()
    ids_by_description: dict[str, int] = {}
    for row in rows:
        key = normalize_nullable_text(row.descripcion)
        if key is not None:
            ids_by_description.setdefault(key, int(row.id))
    return ids_by_description


def get_fondo_account_ids(session: Session) -> set[int]:
    rows = session.exec(
        select(ErpCashCuenta.id)
        .where(ErpCashCuenta.deleted_at.is_(None))
        .where(func.upper(func.trim(ErpCashCuenta.tipo)) == "FONDO")
    ).all()
    return {int(row) for row in rows}


def build_target_rows(
    seeds: list[CashMapSeed],
    ids_by_description: dict[str, int],
) -> dict[tuple[int, str, str | None], dict[str, int | str | None]]:
    targets: dict[tuple[int, str, str | None], dict[str, int | str | None]] = {}
    for seed in seeds:
        map_debe_id = ids_by_description.get(seed.map_debe)
        map_haber_id = ids_by_description.get(seed.map_haber)
        if map_debe_id is None:
            raise RuntimeError(f"No existe cuenta cash para map_debe={seed.map_debe!r}")
        if map_haber_id is None:
            raise RuntimeError(f"No existe cuenta cash para map_haber={seed.map_haber!r}")

        key = map_key(seed.nro_cta, seed.moneda, seed.categoria)
        if key in targets:
            raise RuntimeError(f"Clave duplicada en CSV fuente: {key}")

        targets[key] = {
            "nro_cta": seed.nro_cta,
            "moneda": seed.moneda,
            "categoria": normalize_nullable_text(seed.categoria),
            "map_debe_id": map_debe_id,
            "map_haber_id": map_haber_id,
        }
    return targets


def sync_non_fondo_rows(session: Session, *, apply_changes: bool) -> Counter[str]:
    stats: Counter[str] = Counter()

    source_rows = load_source_rows(SOURCE_CSV)
    ids_by_description = get_cash_account_ids(session)
    fondo_account_ids = get_fondo_account_ids(session)
    target_rows = build_target_rows(source_rows, ids_by_description)

    existing_rows = session.exec(
        select(ErpCashMap)
        .where(ErpCashMap.deleted_at.is_(None))
        .order_by(ErpCashMap.nro_cta, ErpCashMap.moneda, ErpCashMap.id)
    ).all()

    preserved_fondo = [
        row
        for row in existing_rows
        if row.map_debe_id in fondo_account_ids or row.map_haber_id in fondo_account_ids
    ]
    mutable_rows = [
        row
        for row in existing_rows
        if row.map_debe_id not in fondo_account_ids and row.map_haber_id not in fondo_account_ids
    ]

    stats["fondo_preserved"] = len(preserved_fondo)
    stats["source_rows"] = len(source_rows)

    mutable_by_key: dict[tuple[int, str, str | None], list[ErpCashMap]] = defaultdict(list)
    for row in mutable_rows:
        mutable_by_key[map_key(row.nro_cta, row.moneda, row.categoria)].append(row)

    used_row_ids: set[int] = set()

    for key, payload in target_rows.items():
        candidates = mutable_by_key.get(key, [])
        if candidates:
            existing = candidates[0]
            used_row_ids.add(int(existing.id))
            changed = False

            if normalize_nullable_text(existing.categoria) != payload["categoria"]:
                changed = True
                print(
                    f"Actualizar ({existing.nro_cta}, {existing.moneda}, id={existing.id}) categoria: "
                    f"{existing.categoria!r} -> {payload['categoria']!r}"
                )
                if apply_changes:
                    existing.categoria = payload["categoria"]

            if existing.map_debe_id != payload["map_debe_id"]:
                changed = True
                print(
                    f"Actualizar ({existing.nro_cta}, {existing.moneda}, id={existing.id}) map_debe_id: "
                    f"{existing.map_debe_id} -> {payload['map_debe_id']}"
                )
                if apply_changes:
                    existing.map_debe_id = int(payload["map_debe_id"])

            if existing.map_haber_id != payload["map_haber_id"]:
                changed = True
                print(
                    f"Actualizar ({existing.nro_cta}, {existing.moneda}, id={existing.id}) map_haber_id: "
                    f"{existing.map_haber_id} -> {payload['map_haber_id']}"
                )
                if apply_changes:
                    existing.map_haber_id = int(payload["map_haber_id"])

            if changed:
                stats["rows_to_update"] += 1
            else:
                stats["rows_unchanged"] += 1

            for duplicate in candidates[1:]:
                used_row_ids.add(int(duplicate.id))
                stats["rows_to_delete"] += 1
                print(
                    f"Eliminar duplicado mutable ({duplicate.nro_cta}, {duplicate.moneda}, id={duplicate.id}, categoria={duplicate.categoria!r})"
                )
                if apply_changes:
                    session.delete(duplicate)
            continue

        stats["rows_to_create"] += 1
        print(
            f"Crear ({payload['nro_cta']}, {payload['moneda']}, categoria={payload['categoria']!r}) -> "
            f"debe {payload['map_debe_id']}, haber {payload['map_haber_id']}"
        )
        if apply_changes:
            session.add(
                ErpCashMap(
                    nro_cta=int(payload["nro_cta"]),
                    moneda=str(payload["moneda"]),
                    categoria=payload["categoria"],
                    map_debe_id=int(payload["map_debe_id"]),
                    map_haber_id=int(payload["map_haber_id"]),
                )
            )

    for row in mutable_rows:
        if int(row.id) in used_row_ids:
            continue
        stats["rows_to_delete"] += 1
        print(
            f"Eliminar mutable sobrante ({row.nro_cta}, {row.moneda}, id={row.id}, categoria={row.categoria!r})"
        )
        if apply_changes:
            session.delete(row)

    return stats


def main() -> None:
    args = parse_args()
    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    with Session(engine) as session:
        stats = sync_non_fondo_rows(session, apply_changes=args.apply)
        if args.apply:
            session.commit()
            print("Cambios aplicados.")
        else:
            session.rollback()
            print("Dry run: no se aplicaron cambios.")

    print(f"Resumen: {dict(stats)}")


if __name__ == "__main__":
    main()