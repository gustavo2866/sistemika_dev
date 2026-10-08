"""Sincroniza la tabla nominas a partir del delta entre dos maestros de nomina.

Compara el archivo maestro base contra una version actualizada y aplica:
- altas o reactivaciones para legajos presentes en el archivo nuevo,
- actualizaciones de obra/categoria/tarea/nombre para cambios detectados,
- bajas logicas (`activo=False`) para legajos que desaparecieron del nuevo.

Por defecto usa `nro_legajo` como clave. Si necesita crear un empleado nuevo y el
Excel no trae DNI, reutiliza el legajo como DNI placeholder, consistente con la
nomina ya cargada en este proyecto.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Iterable

from sqlmodel import Session, select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import engine  # noqa: E402
from app.models.nomina import Nomina  # noqa: E402
from scripts.import_nomina_maestro import (  # noqa: E402
    MaestroRow,
    build_catalog_index,
    build_nomina_name_index,
    build_project_index,
    ensure_schema,
    load_rows,
    normalize_text,
    seed_catalogs,
    split_nombre_apellido,
)


BASE_EXCEL_PATH = ROOT / "data" / "nomina_maestro.xlsx"
NEW_EXCEL_PATH = ROOT / "data" / "nomina_maestro_sep.xlsx"


@dataclass(frozen=True)
class RowChange:
    legajo: str
    before: MaestroRow
    after: MaestroRow
    changed_fields: tuple[str, ...]


def _build_row_index(rows: Iterable[MaestroRow]) -> dict[str, MaestroRow]:
    index: dict[str, MaestroRow] = {}
    duplicates: set[str] = set()
    for row in rows:
        if row.nro_legajo in index:
            duplicates.add(row.nro_legajo)
        index[row.nro_legajo] = row
    if duplicates:
        raise ValueError(
            "Legajos duplicados en el Excel: " + ", ".join(sorted(duplicates))
        )
    return index


def compute_diff(
    base_rows: list[MaestroRow],
    new_rows: list[MaestroRow],
) -> tuple[list[MaestroRow], list[MaestroRow], list[RowChange]]:
    base_by_legajo = _build_row_index(base_rows)
    new_by_legajo = _build_row_index(new_rows)

    base_ids = set(base_by_legajo)
    new_ids = set(new_by_legajo)

    added = [new_by_legajo[legajo] for legajo in sorted(new_ids - base_ids)]
    removed = [base_by_legajo[legajo] for legajo in sorted(base_ids - new_ids)]

    changed: list[RowChange] = []
    for legajo in sorted(base_ids & new_ids):
        before = base_by_legajo[legajo]
        after = new_by_legajo[legajo]
        fields: list[str] = []
        if before.nombre_completo != after.nombre_completo:
            fields.append("nombre_completo")
        if before.obra != after.obra:
            fields.append("obra")
        if before.categoria_code != after.categoria_code:
            fields.append("categoria_code")
        if before.tarea_code != after.tarea_code:
            fields.append("tarea_code")
        if fields:
            changed.append(
                RowChange(
                    legajo=legajo,
                    before=before,
                    after=after,
                    changed_fields=tuple(fields),
                )
            )

    return added, removed, changed


def build_nomina_legajo_index(session: Session) -> dict[str, list[Nomina]]:
    index: dict[str, list[Nomina]] = defaultdict(list)
    nominas = session.exec(select(Nomina).where(Nomina.deleted_at.is_(None))).all()
    for nomina in nominas:
        legajo = str(nomina.nro_legajo or "").strip()
        if legajo:
            index[legajo].append(nomina)
    return index


def normalize_lookup_key(value: str | None) -> str:
    text = normalize_text(value)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def compact_lookup_key(value: str | None) -> str:
    return normalize_lookup_key(value).replace(" ", "")


def extract_project_alias(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = text.split("(", 1)[0].strip()
    text = text.split("/", 1)[0].strip()
    return text


def build_project_lookup(session: Session) -> tuple[dict[str, int], list[tuple[str, int]]]:
    projects = build_project_index(session)
    exact_index = {
        normalize_text(name): int(project.id)
        for name, project in projects.items()
        if project.id is not None
    }
    fuzzy_index = [
        (normalize_lookup_key(project.nombre), int(project.id))
        for project in projects.values()
        if project.id is not None
    ]
    return exact_index, fuzzy_index


def resolve_project_id(
    obra: str,
    *,
    exact_project_ids: dict[str, int],
    fuzzy_projects: list[tuple[str, int]],
) -> int | None:
    exact_key = normalize_text(obra)
    if exact_key in exact_project_ids:
        return exact_project_ids[exact_key]

    alias = extract_project_alias(obra)
    alias_exact_key = normalize_text(alias)
    if alias_exact_key in exact_project_ids:
        return exact_project_ids[alias_exact_key]

    alias_lookup = normalize_lookup_key(alias)
    if not alias_lookup:
        return None
    alias_compact = compact_lookup_key(alias)

    matches = [
        project_id
        for normalized_name, project_id in fuzzy_projects
        if alias_lookup == normalized_name
        or alias_lookup in normalized_name
        or normalized_name in alias_lookup
        or (alias_compact and alias_compact in normalized_name.replace(" ", ""))
    ]
    unique_matches = sorted(set(matches))
    if len(unique_matches) == 1:
        return unique_matches[0]
    return None


def sync_dni_with_legajo(
    nomina: Nomina,
    *,
    new_legajo: str,
    previous_legajo: str | None,
) -> None:
    current_dni = str(nomina.dni or "").strip()
    previous_legajo_norm = str(previous_legajo or "").strip()
    if not current_dni or current_dni == previous_legajo_norm:
        nomina.dni = new_legajo


def apply_row_to_nomina(
    nomina: Nomina,
    row: MaestroRow,
    *,
    exact_project_ids: dict[str, int],
    fuzzy_projects: list[tuple[str, int]],
    categoria_id_by_code: dict[str, int],
    tarea_id_by_code: dict[str, int],
) -> list[str]:
    warnings: list[str] = []
    previous_legajo = nomina.nro_legajo

    nombre, apellido = split_nombre_apellido(row.nombre_completo)
    if nombre:
        nomina.nombre = nombre
    if apellido:
        nomina.apellido = apellido
    nomina.nro_legajo = row.nro_legajo
    sync_dni_with_legajo(nomina, new_legajo=row.nro_legajo, previous_legajo=previous_legajo)

    proyecto_id = resolve_project_id(
        row.obra,
        exact_project_ids=exact_project_ids,
        fuzzy_projects=fuzzy_projects,
    )
    if proyecto_id is None:
        warnings.append(f"obra_sin_proyecto:{row.obra}")
    else:
        nomina.idproyecto = proyecto_id

    categoria_id = categoria_id_by_code.get(normalize_text(row.categoria_code))
    if categoria_id is None:
        warnings.append(f"categoria_sin_catalogo:{row.categoria_code}")
    else:
        nomina.nomina_categoria_id = categoria_id

    if row.tarea_code:
        tarea_id = tarea_id_by_code.get(normalize_text(row.tarea_code))
        if tarea_id is None:
            warnings.append(f"tarea_sin_catalogo:{row.tarea_code}")
        else:
            nomina.nomina_tarea_id = tarea_id

    nomina.activo = True
    nomina.fecha_egreso = None
    if hasattr(nomina, "updated_at"):
        nomina.updated_at = datetime.now(UTC)
    return warnings


def apply_baja_to_nomina(
    nomina: Nomina,
    *,
    fecha_corte: date,
) -> bool:
    changed = False
    if nomina.activo:
        nomina.activo = False
        changed = True
    if nomina.fecha_egreso is None or nomina.fecha_egreso > fecha_corte:
        nomina.fecha_egreso = fecha_corte
        changed = True
    if changed and hasattr(nomina, "updated_at"):
        nomina.updated_at = datetime.now(UTC)
    return changed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza nominas a partir del delta entre nomina_maestro y nomina_maestro_sep.",
    )
    parser.add_argument("--base-excel", type=Path, default=BASE_EXCEL_PATH, help="Archivo maestro base")
    parser.add_argument("--nuevo-excel", type=Path, default=NEW_EXCEL_PATH, help="Archivo maestro actualizado")
    parser.add_argument(
        "--fecha-corte",
        type=date.fromisoformat,
        default=date.today(),
        help="Fecha de egreso para legajos removidos (YYYY-MM-DD)",
    )
    parser.add_argument("--dry-run", action="store_true", help="No persiste cambios")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    base_rows = load_rows(args.base_excel)
    new_rows = load_rows(args.nuevo_excel)
    added_rows, removed_rows, changed_rows = compute_diff(base_rows, new_rows)

    print(f"Filas base: {len(base_rows)}")
    print(f"Filas nuevas: {len(new_rows)}")
    print(f"Altas detectadas: {len(added_rows)}")
    print(f"Bajas detectadas: {len(removed_rows)}")
    print(f"Cambios detectados: {len(changed_rows)}")

    created = 0
    reactivated = 0
    updated = 0
    deactivated = 0
    matched_by_name = 0
    unresolved_legajos: list[str] = []
    duplicate_legajos_db: list[str] = []
    warnings_counter: Counter[str] = Counter()

    with Session(engine) as session:
        ensure_schema(session)
        seed_catalogs(session)

        exact_project_ids, fuzzy_projects = build_project_lookup(session)
        categoria_id_by_code, tarea_id_by_code = build_catalog_index(session)
        nomina_by_legajo = build_nomina_legajo_index(session)
        nomina_by_name = build_nomina_name_index(session)

        rows_to_apply = added_rows + [change.after for change in changed_rows]
        for row in rows_to_apply:
            candidates = nomina_by_legajo.get(row.nro_legajo, [])
            if len(candidates) > 1:
                duplicate_legajos_db.append(row.nro_legajo)
                continue

            nomina = candidates[0] if candidates else None
            was_inactive = bool(nomina is not None and nomina.activo is False)
            if nomina is None:
                name_candidates = nomina_by_name.get(normalize_text(row.nombre_completo), [])
                unique_candidates = [candidate for candidate in name_candidates if candidate.deleted_at is None]
                if len(unique_candidates) == 1:
                    nomina = unique_candidates[0]
                    matched_by_name += 1
                    was_inactive = bool(nomina.activo is False)

            if nomina is None:
                nomina = Nomina(
                    nombre="",
                    apellido="",
                    dni=row.nro_legajo,
                    nro_legajo=row.nro_legajo,
                    activo=True,
                )
                session.add(nomina)
                created += 1

            warnings = apply_row_to_nomina(
                nomina,
                row,
                exact_project_ids=exact_project_ids,
                fuzzy_projects=fuzzy_projects,
                categoria_id_by_code=categoria_id_by_code,
                tarea_id_by_code=tarea_id_by_code,
            )
            session.add(nomina)
            if was_inactive:
                reactivated += 1
            elif row in added_rows and created == 0:
                updated += 1
            else:
                updated += 1

            for warning in warnings:
                warnings_counter[warning] += 1

            if row.nro_legajo not in nomina_by_legajo:
                nomina_by_legajo[row.nro_legajo] = [nomina]
            elif nomina not in nomina_by_legajo[row.nro_legajo]:
                nomina_by_legajo[row.nro_legajo].append(nomina)
            nomina_by_name[normalize_text(f"{nomina.apellido} {nomina.nombre}")].append(nomina)
            nomina_by_name[normalize_text(f"{nomina.nombre} {nomina.apellido}")].append(nomina)

        for row in removed_rows:
            candidates = nomina_by_legajo.get(row.nro_legajo, [])
            if len(candidates) > 1:
                duplicate_legajos_db.append(row.nro_legajo)
                continue
            if not candidates:
                unresolved_legajos.append(row.nro_legajo)
                continue
            nomina = candidates[0]
            if apply_baja_to_nomina(nomina, fecha_corte=args.fecha_corte):
                session.add(nomina)
                deactivated += 1

        if duplicate_legajos_db:
            print(
                "Legajos duplicados en nominas; se omitieron: "
                + ", ".join(sorted(set(duplicate_legajos_db)))
            )
        if unresolved_legajos:
            print(
                "Legajos removidos sin match en nominas: "
                + ", ".join(sorted(unresolved_legajos))
            )

        if not args.dry_run:
            session.commit()

    print(f"Nominas creadas: {created}")
    print(f"Nominas reactivadas: {reactivated}")
    print(f"Nominas actualizadas: {updated}")
    print(f"Nominas desactivadas: {deactivated}")
    print(f"Matches por nombre: {matched_by_name}")

    if warnings_counter:
        print("Advertencias:")
        for warning, count in warnings_counter.most_common():
            print(f"  {warning}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())