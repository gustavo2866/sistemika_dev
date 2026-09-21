"""Importa datos desde backend/data/nomina_maestro.xlsx y actualiza nominas existentes.

El archivo maestro no trae DNI, por lo que el match principal se hace por
`nro_legajo`. Si el legajo no existe en la tabla `nominas`, se informa como
no resuelto en lugar de crear un registro incompleto.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from collections import Counter
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import inspect, text
from sqlmodel import Session, select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import engine  # noqa: E402
from app.models.nomina import Nomina  # noqa: E402
from app.models.nomina_catalogos import NominaCategoria, NominaTarea  # noqa: E402
from app.models.proyecto import Proyecto  # noqa: E402


EXCEL_PATH = ROOT / "data" / "nomina_maestro.xlsx"


@dataclass(frozen=True)
class MaestroRow:
    nro_legajo: str
    nombre_completo: str
    obra: str
    categoria_code: str
    tarea_code: str


def normalize_text(value: str | None) -> str:
    text = str(value or "").strip().upper()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.replace("Ã‘", "N").replace("Ã±", "n")
    text = re.sub(r"\s+", " ", text)
    return text


def split_nombre_apellido(nombre_completo: str) -> tuple[str, str]:
    text = str(nombre_completo or "").strip()
    if not text:
        return "", ""
    if "," in text:
        apellido, nombre = [part.strip() for part in text.split(",", 1)]
        return nombre, apellido
    parts = [part for part in text.split() if part]
    if len(parts) == 1:
        return parts[0], ""
    apellido = parts[0]
    nombre = " ".join(parts[1:])
    return nombre, apellido


def normalize_codigo_categoria(code: str | None) -> str | None:
    normalized = normalize_text(code)
    if normalized == "MO":
        return "MOF"
    if normalized in {"OF", "AY", "MOF"}:
        return normalized
    return None


def normalize_codigo_tarea(code: str | None) -> str | None:
    normalized = normalize_text(code)
    return normalized if normalized in {"A", "E", "H", "S"} else None


def load_rows(path: Path) -> list[MaestroRow]:
    workbook = load_workbook(path, data_only=True)
    sheet = workbook.active
    rows: list[MaestroRow] = []
    for values in sheet.iter_rows(min_row=2, values_only=True):
        if not values or all(value is None for value in values):
            continue
        legajo, nombre, obra, categoria, tarea = values[:5]
        if legajo is None:
            continue
        rows.append(
            MaestroRow(
                nro_legajo=str(legajo).strip(),
                nombre_completo=str(nombre or "").strip(),
                obra=str(obra or "").strip(),
                categoria_code=normalize_codigo_categoria(str(categoria or "")) or "",
                tarea_code=normalize_codigo_tarea(str(tarea or "")) or "",
            )
        )
    return rows


def build_project_index(session: Session) -> dict[str, Proyecto]:
    proyectos = session.exec(select(Proyecto).where(Proyecto.deleted_at.is_(None))).all()
    index: dict[str, Proyecto] = {}
    for proyecto in proyectos:
        key = normalize_text(proyecto.nombre)
        if key and key not in index:
            index[key] = proyecto
    return index


def build_nomina_name_index(session: Session) -> dict[str, list[Nomina]]:
    index: dict[str, list[Nomina]] = defaultdict(list)
    nominas = session.exec(select(Nomina).where(Nomina.deleted_at.is_(None))).all()
    for nomina in nominas:
        nombre_completo = normalize_text(f"{nomina.apellido} {nomina.nombre}")
        nombre_completo_invertido = normalize_text(f"{nomina.nombre} {nomina.apellido}")
        if nombre_completo:
            index[nombre_completo].append(nomina)
        if nombre_completo_invertido and nombre_completo_invertido != nombre_completo:
            index[nombre_completo_invertido].append(nomina)
    return index


def build_catalog_index(session: Session) -> tuple[dict[str, int], dict[str, int]]:
    categorias = {
        normalize_text(item.codigo): int(item.id)
        for item in session.exec(select(NominaCategoria).where(NominaCategoria.deleted_at.is_(None))).all()
    }
    tareas = {
        normalize_text(item.codigo): int(item.id)
        for item in session.exec(select(NominaTarea).where(NominaTarea.deleted_at.is_(None))).all()
    }
    return categorias, tareas


def build_defaults(
    session: Session,
    project_index: dict[str, Proyecto],
    categoria_index: dict[str, int],
    tarea_index: dict[str, int],
) -> tuple[int | None, int | None]:
    default_categoria_id = next(iter(categoria_index.values()), None)
    default_tarea_id = next(iter(tarea_index.values()), None)
    return default_categoria_id, default_tarea_id


def ensure_schema(session: Session) -> None:
    bind = session.get_bind()
    if bind is None:
        raise RuntimeError("No se pudo obtener el engine de SQLAlchemy")

    NominaCategoria.__table__.create(bind, checkfirst=True)
    NominaTarea.__table__.create(bind, checkfirst=True)

    inspector = inspect(bind)
    nomina_columns = {column["name"] for column in inspector.get_columns("nominas")}
    if "nomina_categoria_id" not in nomina_columns:
        session.exec(text("ALTER TABLE nominas ADD COLUMN nomina_categoria_id INTEGER NULL"))
    if "nomina_tarea_id" not in nomina_columns:
        session.exec(text("ALTER TABLE nominas ADD COLUMN nomina_tarea_id INTEGER NULL"))
    session.commit()


def seed_catalogs(session: Session) -> None:
    catalogos_categorias = [
        ("OF", "Oficial"),
        ("AY", "Ayudante"),
        ("MOF", "Medio oficial"),
    ]
    catalogos_tareas = [
        ("A", "Albañileria"),
        ("E", "Estructura"),
        ("H", "Herreria"),
        ("S", "Sanitario"),
    ]

    existing_categoria_codes = {
        normalize_text(code)
        for code in session.exec(select(NominaCategoria.codigo)).all()
    }
    for codigo, descripcion in catalogos_categorias:
        if normalize_text(codigo) in existing_categoria_codes:
            continue
        session.add(NominaCategoria(codigo=codigo, descripcion=descripcion, activa=True))

    existing_tarea_codes = {
        normalize_text(code)
        for code in session.exec(select(NominaTarea.codigo)).all()
    }
    for codigo, descripcion in catalogos_tareas:
        if normalize_text(codigo) in existing_tarea_codes:
            continue
        session.add(NominaTarea(codigo=codigo, descripcion=descripcion, activa=True))

    session.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa nomina_maestro.xlsx actualizando nominas por legajo.")
    parser.add_argument("--excel", type=Path, default=EXCEL_PATH, help="Ruta al archivo xlsx")
    parser.add_argument("--dry-run", action="store_true", help="No guarda cambios, solo muestra el resultado")
    args = parser.parse_args()

    rows = load_rows(args.excel)
    print(f"Filas leidas: {len(rows)}")

    category_counter = Counter(row.categoria_code for row in rows if row.categoria_code)
    task_counter = Counter(row.tarea_code for row in rows if row.tarea_code)
    obra_counter = Counter(normalize_text(row.obra) for row in rows if row.obra)
    print(f"Categorias: {dict(category_counter)}")
    print(f"Tareas: {dict(task_counter)}")
    print(f"Obras unicas: {len(obra_counter)}")

    updated = 0
    fallback_name_updated = 0
    missing_legajo: list[str] = []
    missing_name_match: list[str] = []
    missing_projects: Counter[str] = Counter()
    missing_categories: Counter[str] = Counter()
    missing_tasks: Counter[str] = Counter()

    with Session(engine) as session:
        ensure_schema(session)
        seed_catalogs(session)
        project_index = build_project_index(session)
        name_index = build_nomina_name_index(session)
        categoria_index, tarea_index = build_catalog_index(session)
        default_categoria_id, default_tarea_id = build_defaults(
            session,
            project_index,
            categoria_index,
            tarea_index,
        )

        for row in rows:
            nomina = session.exec(
                select(Nomina)
                .where(Nomina.nro_legajo == row.nro_legajo)
                .where(Nomina.deleted_at.is_(None))
            ).first()
            matched_by_name = False
            if nomina is None:
                row_name_key = normalize_text(row.nombre_completo)
                candidates = name_index.get(row_name_key, [])
                if len(candidates) == 1:
                    nomina = candidates[0]
                    matched_by_name = True
                    fallback_name_updated += 1
                else:
                    missing_legajo.append(row.nro_legajo)
                    missing_name_match.append(row.nombre_completo)
                    continue

            nombre, apellido = split_nombre_apellido(row.nombre_completo)
            nomina.nombre = nombre or nomina.nombre
            nomina.apellido = apellido or nomina.apellido
            nomina.nro_legajo = row.nro_legajo

            proyecto = project_index.get(normalize_text(row.obra))
            if proyecto is None:
                missing_projects[row.obra] += 1
            else:
                nomina.idproyecto = int(proyecto.id)

            categoria_id = categoria_index.get(normalize_text(row.categoria_code))
            if categoria_id is None:
                missing_categories[row.categoria_code] += 1
                if default_categoria_id is not None:
                    nomina.nomina_categoria_id = default_categoria_id
            else:
                nomina.nomina_categoria_id = categoria_id

            tarea_id = tarea_index.get(normalize_text(row.tarea_code))
            if tarea_id is None:
                missing_tasks[row.tarea_code] += 1
                if default_tarea_id is not None:
                    nomina.nomina_tarea_id = default_tarea_id
            else:
                nomina.nomina_tarea_id = tarea_id

            nomina.activo = True
            session.add(nomina)
            updated += 1
            if matched_by_name:
                name_index[normalize_text(f"{nomina.apellido} {nomina.nombre}")].append(nomina)

        if default_categoria_id is not None or default_tarea_id is not None:
            all_nominas = session.exec(select(Nomina).where(Nomina.deleted_at.is_(None))).all()
            for nomina in all_nominas:
                if nomina.nomina_categoria_id is None and default_categoria_id is not None:
                    nomina.nomina_categoria_id = default_categoria_id
                if nomina.nomina_tarea_id is None and default_tarea_id is not None:
                    nomina.nomina_tarea_id = default_tarea_id
                session.add(nomina)

        if not args.dry_run:
            session.commit()

    print(f"Nominas actualizadas: {updated}")
    print(f"Actualizadas por nombre/apellido: {fallback_name_updated}")
    if missing_legajo:
        print(f"Legajos sin match ({len(missing_legajo)}): {', '.join(missing_legajo[:20])}")
    if missing_name_match:
        print(f"Nombres sin match ({len(missing_name_match)}): {', '.join(missing_name_match[:20])}")
    if missing_projects:
        print("Obras sin proyecto:")
        for obra, count in missing_projects.most_common():
            print(f"  {count}x {obra}")
    if missing_categories:
        print(f"Categorias sin catalogo: {dict(missing_categories)}")
    if missing_tasks:
        print(f"Tareas sin catalogo: {dict(missing_tasks)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
