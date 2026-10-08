#!/usr/bin/env python
"""Sincroniza en BD las cuentas y mapeos Fondo definidos en los CSV.

Uso tipico sobre test:
    $env:DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL_TEST" --project="sak-wcl"
    python scripts/sync_erp_cash_fondo_maps.py --dry-run
    python scripts/sync_erp_cash_fondo_maps.py --apply
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_cuenta import ErpCashCuenta  # noqa: E402
from app.models.erp.cash_map import ErpCashMap  # noqa: E402


CASH_CUENTAS_CSV = BACKEND_ROOT / "data" / "erp_cash_cuentas.csv"
CASH_MAP_CSV = BACKEND_ROOT / "data" / "erp_cash_map.csv"
FONDO_CUENTA_ID = 30
LEGACY_FONDO_CUENTA_ID = 31


@dataclass(frozen=True)
class FondoCuentaSeed:
    id: int
    descripcion: str
    tipo: str | None


@dataclass(frozen=True)
class FondoMapSeed:
    nro_cta: int
    moneda: str
    categoria: str | None
    map_debe_id: int
    map_haber_id: int


def normalize_nullable_text(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza en BD los mapeos Fondo de erp_cash_map y sus cuentas cash.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra el diff sin aplicar cambios.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica los cambios en la base.",
    )
    return parser.parse_args()


def load_fondo_cuentas(path: Path) -> list[FondoCuentaSeed]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows: list[FondoCuentaSeed] = []
        for raw in reader:
            cuenta_id = int(str(raw["id"]).strip())
            if cuenta_id != FONDO_CUENTA_ID:
                continue
            rows.append(
                FondoCuentaSeed(
                    id=cuenta_id,
                    descripcion=str(raw["descripcion"] or "").strip(),
                    tipo=str(raw.get("tipo") or "").strip() or None,
                )
            )
    return rows


def load_fondo_maps(path: Path) -> list[FondoMapSeed]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows: list[FondoMapSeed] = []
        for raw in reader:
            map_debe_id = int(str(raw["map_debe_id"]).strip())
            map_haber_id = int(str(raw["map_haber_id"]).strip())
            if map_debe_id != FONDO_CUENTA_ID or map_haber_id != FONDO_CUENTA_ID:
                continue
            rows.append(
                FondoMapSeed(
                    nro_cta=int(str(raw["nro_cta"]).strip()),
                    moneda=str(raw["Moneda"] or "").strip(),
                    categoria="Fondo",
                    map_debe_id=map_debe_id,
                    map_haber_id=map_haber_id,
                )
            )
    return rows


def sync_fondo_cuentas(
    session: Session,
    seeds: list[FondoCuentaSeed],
    *,
    apply_changes: bool,
) -> Counter[str]:
    stats: Counter[str] = Counter()
    for seed in seeds:
        existing = session.get(ErpCashCuenta, seed.id)
        if existing is None:
            stats["cuentas_to_create"] += 1
            print(f"Crear cuenta cash Fondo {seed.id}: {seed.descripcion} ({seed.tipo})")
            if apply_changes:
                session.add(
                    ErpCashCuenta(
                        id=seed.id,
                        descripcion=seed.descripcion,
                        tipo=seed.tipo,
                    )
                )
            continue

        changed = False
        if existing.descripcion != seed.descripcion:
            changed = True
            print(
                f"Actualizar cuenta cash {seed.id} descripcion: "
                f"{existing.descripcion!r} -> {seed.descripcion!r}"
            )
            if apply_changes:
                existing.descripcion = seed.descripcion
        if normalize_nullable_text(existing.tipo) != normalize_nullable_text(seed.tipo):
            changed = True
            print(f"Actualizar cuenta cash {seed.id} tipo: {existing.tipo!r} -> {seed.tipo!r}")
            if apply_changes:
                existing.tipo = seed.tipo

        if changed:
            stats["cuentas_to_update"] += 1
        else:
            stats["cuentas_unchanged"] += 1
    return stats


def sync_fondo_maps(
    session: Session,
    seeds: list[FondoMapSeed],
    *,
    apply_changes: bool,
) -> Counter[str]:
    stats: Counter[str] = Counter()
    for seed in seeds:
        existing = session.exec(
            select(ErpCashMap)
            .where(ErpCashMap.nro_cta == seed.nro_cta)
            .where(ErpCashMap.moneda == seed.moneda)
            .order_by(ErpCashMap.id)
        ).first()

        if existing is None:
            stats["maps_to_create"] += 1
            print(
                f"Crear mapeo Fondo ({seed.nro_cta}, {seed.moneda}) -> "
                f"debe {seed.map_debe_id}, haber {seed.map_haber_id}"
            )
            if apply_changes:
                session.add(
                    ErpCashMap(
                        nro_cta=seed.nro_cta,
                        moneda=seed.moneda,
                        categoria=seed.categoria,
                        map_debe_id=seed.map_debe_id,
                        map_haber_id=seed.map_haber_id,
                    )
                )
            continue

        changed = False
        if existing.categoria != seed.categoria:
            changed = True
            print(
                f"Actualizar mapeo ({seed.nro_cta}, {seed.moneda}) categoria: "
                f"{existing.categoria!r} -> {seed.categoria!r}"
            )
            if apply_changes:
                existing.categoria = seed.categoria
        if existing.map_debe_id != seed.map_debe_id:
            changed = True
            print(
                f"Actualizar mapeo ({seed.nro_cta}, {seed.moneda}) debe: "
                f"{existing.map_debe_id} -> {seed.map_debe_id}"
            )
            if apply_changes:
                existing.map_debe_id = seed.map_debe_id
        if existing.map_haber_id != seed.map_haber_id:
            changed = True
            print(
                f"Actualizar mapeo ({seed.nro_cta}, {seed.moneda}) haber: "
                f"{existing.map_haber_id} -> {seed.map_haber_id}"
            )
            if apply_changes:
                existing.map_haber_id = seed.map_haber_id

        if changed:
            stats["maps_to_update"] += 1
        else:
            stats["maps_unchanged"] += 1
    return stats


def cleanup_legacy_fondo_account(session: Session, *, apply_changes: bool) -> Counter[str]:
    stats: Counter[str] = Counter()
    legacy = session.get(ErpCashCuenta, LEGACY_FONDO_CUENTA_ID)
    if legacy is None:
        stats["legacy_absent"] += 1
        return stats

    referenced_map = session.exec(
        select(ErpCashMap)
        .where(
            (ErpCashMap.map_debe_id == LEGACY_FONDO_CUENTA_ID)
            | (ErpCashMap.map_haber_id == LEGACY_FONDO_CUENTA_ID)
        )
        .order_by(ErpCashMap.id)
    ).first()
    if referenced_map is not None:
        stats["legacy_still_referenced"] += 1
        print(
            "Cuenta cash Fondo legado 31 sigue referenciada por erp_cash_map; "
            "no se elimina."
        )
        return stats

    print("Eliminar cuenta cash Fondo legado 31")
    stats["legacy_to_delete"] += 1
    if apply_changes:
        session.delete(legacy)
    return stats


def main() -> None:
    args = parse_args()
    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    fondo_cuentas = load_fondo_cuentas(CASH_CUENTAS_CSV)
    fondo_maps = load_fondo_maps(CASH_MAP_CSV)

    print(f"Cuentas Fondo leidas desde CSV: {len(fondo_cuentas)}")
    print(f"Mapeos Fondo leidos desde CSV: {len(fondo_maps)}")

    with Session(engine) as session:
        cuenta_stats = sync_fondo_cuentas(session, fondo_cuentas, apply_changes=args.apply)
        map_stats = sync_fondo_maps(session, fondo_maps, apply_changes=args.apply)
        cleanup_stats = cleanup_legacy_fondo_account(session, apply_changes=args.apply)

        if args.apply:
            session.commit()
            print("Cambios aplicados.")
        else:
            session.rollback()
            print("Dry run: no se aplicaron cambios.")

    print(f"Resumen cuentas: {dict(cuenta_stats)}")
    print(f"Resumen mapeos: {dict(map_stats)}")
    print(f"Resumen cleanup: {dict(cleanup_stats)}")


if __name__ == "__main__":
    main()