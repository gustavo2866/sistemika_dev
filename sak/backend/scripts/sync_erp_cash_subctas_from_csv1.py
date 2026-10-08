#!/usr/bin/env python
"""Compara y sincroniza erp_cash_subctas con erp_cash_subctas_1.csv.

El modo ``--dry-run`` genera el informe completo sin modificar la base. El modo
``--apply`` aplica exactamente ese criterio y verifica el resultado antes de
confirmar la transaccion.

Uso tipico:
    python scripts/sync_erp_cash_subctas_from_csv1.py --dry-run
    python scripts/sync_erp_cash_subctas_from_csv1.py --apply

El CSV actual declara ``descripcion;nro_subcta`` en el encabezado, pero sus
datos vienen en el orden ``nro_subcta;descripcion``. El lector detecta ambos
formatos y falla si no puede determinar el orden con seguridad.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_subcta import ErpCashSubcta  # noqa: E402


SOURCE_CSV = BACKEND_ROOT / "data" / "erp_cash_subctas_1.csv"
DEFAULT_REPORT = BACKEND_ROOT / "data" / "erp_cash_subctas_diff.csv"
EXPECTED_HEADER = ("tpo_subcta", "descripcion", "nro_subcta", "categoria")


@dataclass(frozen=True)
class CashSubctaSeed:
    tpo_subcta: int
    nro_subcta: int
    descripcion: str
    categoria: str

    @property
    def key(self) -> tuple[int, int]:
        return self.tpo_subcta, self.nro_subcta


@dataclass(frozen=True)
class FieldChange:
    field: str
    current: str
    target: str


@dataclass
class SyncPlan:
    source_rows: int
    database_rows: int
    to_create: list[CashSubctaSeed] = field(default_factory=list)
    to_update: list[tuple[ErpCashSubcta, CashSubctaSeed, tuple[FieldChange, ...]]] = field(
        default_factory=list
    )
    to_restore: list[ErpCashSubcta] = field(default_factory=list)
    to_delete: list[ErpCashSubcta] = field(default_factory=list)
    unchanged: int = 0

    @property
    def change_count(self) -> int:
        changed_ids = {
            int(row.id)
            for row, _seed, _fields in self.to_update
            if row.id is not None
        }
        changed_ids.update(
            int(row.id) for row in self.to_restore if row.id is not None
        )
        return len(self.to_create) + len(changed_ids) + len(self.to_delete)

    def stats(self) -> dict[str, int]:
        return {
            "source_rows": self.source_rows,
            "database_rows": self.database_rows,
            "rows_to_create": len(self.to_create),
            "rows_to_update": len(self.to_update),
            "rows_to_restore": len(self.to_restore),
            "rows_to_delete": len(self.to_delete),
            "rows_unchanged": self.unchanged,
            "rows_changed_total": self.change_count,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compara y sincroniza erp_cash_subctas contra "
            "backend/data/erp_cash_subctas_1.csv."
        ),
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Solo informa diferencias.")
    mode.add_argument("--apply", action="store_true", help="Aplica y verifica los cambios.")
    parser.add_argument("--source", type=Path, default=SOURCE_CSV, help="CSV de referencia.")
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="CSV donde se guarda el detalle completo de diferencias.",
    )
    parser.add_argument(
        "--details-limit",
        type=int,
        default=50,
        help="Cantidad maxima de diferencias mostradas en consola (el informe no se limita).",
    )
    return parser.parse_args()


def _read_source_text(path: Path) -> tuple[str, str]:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return path.read_text(encoding=encoding), encoding
        except UnicodeDecodeError:
            continue
    raise ValueError(f"No se pudo decodificar el archivo {path}")


def _is_integer(value: str) -> bool:
    try:
        int(value.strip())
    except (TypeError, ValueError):
        return False
    return True


def _detect_data_columns(rows: list[list[str]]) -> tuple[int, int]:
    sample = [row for row in rows if any(cell.strip() for cell in row)][:50]
    if not sample:
        raise ValueError("El CSV no contiene filas de datos")
    if any(len(row) != 4 for row in sample):
        raise ValueError("El CSV debe tener exactamente cuatro columnas")

    second_numeric = sum(_is_integer(row[1]) for row in sample)
    third_numeric = sum(_is_integer(row[2]) for row in sample)
    threshold = max(1, len(sample) * 9 // 10)

    if second_numeric >= threshold and third_numeric == 0:
        return 2, 1  # descripcion, nro_subcta: datos invertidos respecto del encabezado
    if third_numeric >= threshold and second_numeric == 0:
        return 1, 2  # descripcion, nro_subcta: orden declarado por el encabezado
    raise ValueError(
        "No se pudo determinar con seguridad el orden de descripcion y nro_subcta"
    )


def load_source_rows(path: Path) -> tuple[list[CashSubctaSeed], str, bool]:
    if not path.is_file():
        raise FileNotFoundError(f"No existe el CSV de referencia: {path}")

    text, encoding = _read_source_text(path)
    reader = csv.reader(io.StringIO(text), delimiter=";")
    try:
        header = tuple(cell.strip().lower() for cell in next(reader))
    except StopIteration as exc:
        raise ValueError("El CSV esta vacio") from exc
    if header != EXPECTED_HEADER:
        raise ValueError(f"Encabezado inesperado: {header!r}; se esperaba {EXPECTED_HEADER!r}")

    raw_rows = [row for row in reader if any(cell.strip() for cell in row)]
    descripcion_index, nro_subcta_index = _detect_data_columns(raw_rows)
    inverted_columns = descripcion_index == 2

    rows: list[CashSubctaSeed] = []
    seen: dict[tuple[int, int], int] = {}
    for line_number, raw in enumerate(raw_rows, start=2):
        if len(raw) != 4:
            raise ValueError(
                f"Linea {line_number}: se esperaban 4 columnas y se encontraron {len(raw)}"
            )
        try:
            tpo_subcta = int(raw[0].strip())
            nro_subcta = int(raw[nro_subcta_index].strip())
        except ValueError as exc:
            raise ValueError(f"Linea {line_number}: tipo o numero de subcuenta invalido") from exc

        descripcion = raw[descripcion_index].strip()
        categoria = raw[3].strip()
        if not descripcion or not categoria:
            raise ValueError(f"Linea {line_number}: descripcion y categoria son obligatorias")
        if len(descripcion) > 255:
            raise ValueError(f"Linea {line_number}: descripcion supera 255 caracteres")
        if len(categoria) > 50:
            raise ValueError(f"Linea {line_number}: categoria supera 50 caracteres")

        seed = CashSubctaSeed(
            tpo_subcta=tpo_subcta,
            nro_subcta=nro_subcta,
            descripcion=descripcion,
            categoria=categoria,
        )
        if seed.key in seen:
            raise ValueError(
                f"Clave duplicada {seed.key} en lineas {seen[seed.key]} y {line_number}"
            )
        seen[seed.key] = line_number
        rows.append(seed)

    return rows, encoding, inverted_columns


def build_sync_plan(session: Session, seeds: Iterable[CashSubctaSeed]) -> SyncPlan:
    source_rows = list(seeds)
    database_rows = session.exec(
        select(ErpCashSubcta).order_by(
            ErpCashSubcta.tpo_subcta,
            ErpCashSubcta.nro_subcta,
            ErpCashSubcta.id,
        )
    ).all()
    existing_by_key = {(row.tpo_subcta, row.nro_subcta): row for row in database_rows}
    source_by_key = {seed.key: seed for seed in source_rows}
    if len(existing_by_key) != len(database_rows):
        raise RuntimeError("La base contiene claves (tpo_subcta, nro_subcta) duplicadas")

    plan = SyncPlan(source_rows=len(source_rows), database_rows=len(database_rows))
    for seed in source_rows:
        existing = existing_by_key.get(seed.key)
        if existing is None:
            plan.to_create.append(seed)
            continue

        changes: list[FieldChange] = []
        if existing.descripcion != seed.descripcion:
            changes.append(
                FieldChange("descripcion", existing.descripcion, seed.descripcion)
            )
        if existing.categoria != seed.categoria:
            changes.append(FieldChange("categoria", existing.categoria, seed.categoria))
        if changes:
            plan.to_update.append((existing, seed, tuple(changes)))
        if existing.deleted_at is not None:
            plan.to_restore.append(existing)
        if not changes and existing.deleted_at is None:
            plan.unchanged += 1

    plan.to_delete.extend(
        row
        for row in database_rows
        if (row.tpo_subcta, row.nro_subcta) not in source_by_key
    )
    return plan


def iter_report_rows(plan: SyncPlan) -> Iterable[list[str | int]]:
    for seed in plan.to_create:
        yield ["CREATE", "", seed.tpo_subcta, seed.nro_subcta, "*", "", f"{seed.descripcion} | {seed.categoria}"]
    for row, seed, changes in plan.to_update:
        for change in changes:
            yield ["UPDATE", row.id or "", seed.tpo_subcta, seed.nro_subcta, change.field, change.current, change.target]
    for row in plan.to_restore:
        yield ["RESTORE", row.id or "", row.tpo_subcta, row.nro_subcta, "deleted_at", str(row.deleted_at or ""), ""]
    for row in plan.to_delete:
        yield ["DELETE", row.id or "", row.tpo_subcta, row.nro_subcta, "*", f"{row.descripcion} | {row.categoria}", ""]


def write_report(path: Path, plan: SyncPlan) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    report_rows = list(iter_report_rows(plan))
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, delimiter=";")
        writer.writerow(
            ["accion", "id", "tpo_subcta", "nro_subcta", "campo", "valor_actual", "valor_objetivo"]
        )
        writer.writerows(report_rows)
    return len(report_rows)


def print_plan(plan: SyncPlan, *, details_limit: int) -> None:
    print("Resumen de diferencias:")
    for key, value in plan.stats().items():
        print(f"  {key}: {value}")

    rows = list(iter_report_rows(plan))
    if not rows:
        print("No se detectaron diferencias.")
        return
    print(f"Primeras {min(max(details_limit, 0), len(rows))} diferencias:")
    for action, row_id, tpo, nro, field_name, current, target in rows[: max(details_limit, 0)]:
        print(
            f"  {action} id={row_id or '-'} clave=({tpo}, {nro}) "
            f"campo={field_name}: {current!r} -> {target!r}"
        )
    if len(rows) > max(details_limit, 0):
        print(f"  ... {len(rows) - max(details_limit, 0)} diferencias adicionales en el informe.")


def apply_sync_plan(session: Session, plan: SyncPlan) -> None:
    now = datetime.now(UTC)
    touched: dict[int, ErpCashSubcta] = {}

    for seed in plan.to_create:
        session.add(
            ErpCashSubcta(
                tpo_subcta=seed.tpo_subcta,
                nro_subcta=seed.nro_subcta,
                descripcion=seed.descripcion,
                categoria=seed.categoria,
            )
        )

    for existing, seed, _changes in plan.to_update:
        existing.descripcion = seed.descripcion
        existing.categoria = seed.categoria
        if existing.id is not None:
            touched[int(existing.id)] = existing

    for existing in plan.to_restore:
        existing.deleted_at = None
        if existing.id is not None:
            touched[int(existing.id)] = existing

    for existing in plan.to_delete:
        session.delete(existing)

    for existing in touched.values():
        existing.updated_at = now
        existing.version = int(existing.version or 0) + 1

    session.flush()


def verify_active_rows(session: Session, seeds: Iterable[CashSubctaSeed]) -> None:
    expected = {seed.key: seed for seed in seeds}
    active_rows = session.exec(
        select(ErpCashSubcta)
        .where(ErpCashSubcta.deleted_at.is_(None))
        .order_by(ErpCashSubcta.tpo_subcta, ErpCashSubcta.nro_subcta)
    ).all()
    actual = {(row.tpo_subcta, row.nro_subcta): row for row in active_rows}
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        raise RuntimeError(
            f"Verificacion fallida: claves faltantes={missing[:10]}, sobrantes={extra[:10]}"
        )
    mismatches = [
        key
        for key, seed in expected.items()
        if actual[key].descripcion != seed.descripcion
        or actual[key].categoria != seed.categoria
    ]
    if mismatches:
        raise RuntimeError(
            f"Verificacion fallida: valores distintos en claves {sorted(mismatches)[:10]}"
        )


def main() -> None:
    args = parse_args()
    seeds, encoding, inverted_columns = load_source_rows(args.source)
    print(f"Fuente: {args.source}")
    print(f"Filas validas: {len(seeds)}; codificacion: {encoding}")
    if inverted_columns:
        print(
            "Aviso: el archivo trae nro_subcta y descripcion invertidos respecto del encabezado; "
            "se interpreto el orden real de los datos."
        )

    with Session(engine) as session:
        plan = build_sync_plan(session, seeds)
        print_plan(plan, details_limit=args.details_limit)
        report_count = write_report(args.report, plan)
        print(f"Informe: {args.report} ({report_count} detalles)")

        if args.dry_run:
            session.rollback()
            print("Dry run: no se modifico la base.")
            return

        try:
            apply_sync_plan(session, plan)
            verify_active_rows(session, seeds)
            session.commit()
        except Exception:
            session.rollback()
            raise
        print("Cambios aplicados y verificados correctamente.")


if __name__ == "__main__":
    main()
