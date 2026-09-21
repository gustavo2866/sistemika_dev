#!/usr/bin/env python
"""Completa nominas.encargado_contacto_id con el encargado principal de la obra.

Uso:
    python backend/scripts/backfill_nomina_encargado_principal.py --dry-run
    python backend/scripts/backfill_nomina_encargado_principal.py --apply
    python backend/scripts/backfill_nomina_encargado_principal.py --dry-run --project-id 12
    python backend/scripts/backfill_nomina_encargado_principal.py --apply --project-id 12 --repair-invalid

El script es idempotente: solo actualiza empleados activos, no eliminados,
asignados a un proyecto y con encargado_contacto_id NULL.
Con --repair-invalid tambien corrige encargados que no estan activos para
la obra del empleado.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path

from sqlmodel import Session, select

BACKEND_PATH = Path(__file__).resolve().parents[1]
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import engine  # noqa: E402
from app.models.crm.contacto import CRMContacto  # noqa: E402
from app.models.nomina import Nomina  # noqa: E402
from app.models.proyecto import Proyecto  # noqa: E402
from app.models.proyecto_encargado import ProyectoEncargado  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Asigna el encargado principal activo del proyecto a nominas activas "
            "sin encargado_contacto_id."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra que filas se actualizarian sin aplicar cambios.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la actualizacion.",
    )
    parser.add_argument(
        "--project-id",
        type=int,
        default=None,
        help="Limita el backfill a un proyecto especifico.",
    )
    parser.add_argument(
        "--repair-invalid",
        action="store_true",
        help="Tambien reasigna nominas cuyo encargado actual no esta activo en la obra.",
    )
    return parser.parse_args()


def build_principales_by_project(session: Session) -> dict[int, list[ProyectoEncargado]]:
    rows = session.exec(
        select(ProyectoEncargado)
        .where(ProyectoEncargado.principal.is_(True))
        .where(ProyectoEncargado.activo.is_(True))
        .where(ProyectoEncargado.deleted_at.is_(None))
        .order_by(ProyectoEncargado.proyecto_id, ProyectoEncargado.id)
    ).all()
    principales: dict[int, list[ProyectoEncargado]] = defaultdict(list)
    for row in rows:
        if row.proyecto_id is not None:
            principales[int(row.proyecto_id)].append(row)
    return principales


def build_active_encargados_by_project(session: Session) -> dict[int, set[int]]:
    rows = session.exec(
        select(ProyectoEncargado)
        .where(ProyectoEncargado.activo.is_(True))
        .where(ProyectoEncargado.deleted_at.is_(None))
        .order_by(ProyectoEncargado.proyecto_id, ProyectoEncargado.id)
    ).all()
    encargados: dict[int, set[int]] = defaultdict(set)
    for row in rows:
        if row.proyecto_id is not None and row.contacto_id is not None:
            encargados[int(row.proyecto_id)].add(int(row.contacto_id))
    return encargados


def get_label_maps(session: Session, project_ids: set[int], contacto_ids: set[int]) -> tuple[dict[int, str], dict[int, str]]:
    proyectos = session.exec(
        select(Proyecto).where(Proyecto.id.in_(project_ids))
    ).all() if project_ids else []
    contactos = session.exec(
        select(CRMContacto).where(CRMContacto.id.in_(contacto_ids))
    ).all() if contacto_ids else []
    proyectos_by_id = {
        int(proyecto.id): proyecto.nombre or f"Proyecto #{proyecto.id}"
        for proyecto in proyectos
        if proyecto.id is not None
    }
    contactos_by_id = {
        int(contacto.id): contacto.nombre_completo or f"Contacto #{contacto.id}"
        for contacto in contactos
        if contacto.id is not None
    }
    return proyectos_by_id, contactos_by_id


def run(*, apply_changes: bool, project_id: int | None, repair_invalid: bool) -> int:
    with Session(engine) as session:
        stmt = (
            select(Nomina)
            .where(Nomina.idproyecto.is_not(None))
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.idproyecto, Nomina.apellido, Nomina.nombre)
        )
        if project_id is not None:
            stmt = stmt.where(Nomina.idproyecto == project_id)

        nominas = list(session.exec(stmt).all())
        principales_by_project = build_principales_by_project(session)
        active_encargados_by_project = build_active_encargados_by_project(session)

        assignable: list[tuple[Nomina, int]] = []
        skipped = Counter()
        skipped_project_ids: dict[str, set[int]] = defaultdict(set)

        for nomina in nominas:
            nomina_project_id = int(nomina.idproyecto)
            current_contacto_id = (
                int(nomina.encargado_contacto_id)
                if nomina.encargado_contacto_id is not None
                else None
            )
            current_is_valid = (
                current_contacto_id is not None
                and current_contacto_id in active_encargados_by_project.get(nomina_project_id, set())
            )
            if current_contacto_id is not None and (current_is_valid or not repair_invalid):
                continue

            principales = principales_by_project.get(nomina_project_id, [])
            if not principales:
                skipped["sin_principal"] += 1
                skipped_project_ids["sin_principal"].add(nomina_project_id)
                continue
            if len(principales) > 1:
                skipped["multiples_principales"] += 1
                skipped_project_ids["multiples_principales"].add(nomina_project_id)
                continue

            contacto_id = principales[0].contacto_id
            if contacto_id is None:
                skipped["principal_sin_contacto"] += 1
                skipped_project_ids["principal_sin_contacto"].add(nomina_project_id)
                continue
            assignable.append((nomina, int(contacto_id)))

        project_ids = {int(nomina.idproyecto) for nomina in nominas if nomina.idproyecto is not None}
        contacto_ids = {
            contacto_id
            for _nomina, contacto_id in assignable
        } | {
            int(nomina.encargado_contacto_id)
            for nomina, _contacto_id in assignable
            if nomina.encargado_contacto_id is not None
        }
        proyectos_by_id, contactos_by_id = get_label_maps(session, project_ids, contacto_ids)

        null_candidates = sum(1 for nomina in nominas if nomina.encargado_contacto_id is None)
        invalid_candidates = 0
        if repair_invalid:
            invalid_candidates = sum(
                1
                for nomina in nominas
                if nomina.encargado_contacto_id is not None
                and int(nomina.encargado_contacto_id)
                not in active_encargados_by_project.get(int(nomina.idproyecto), set())
            )
        print(f"Nominas activas revisadas: {len(nominas)}")
        print(f"Nominas sin encargado: {null_candidates}")
        if repair_invalid:
            print(f"Nominas con encargado invalido para la obra: {invalid_candidates}")
        print(f"Nominas asignables: {len(assignable)}")
        if skipped:
            print("Omitidas:")
            for reason, count in skipped.items():
                labels = [
                    proyectos_by_id.get(pid, f"Proyecto #{pid}")
                    for pid in sorted(skipped_project_ids[reason])
                ]
                print(f"  {reason}: {count} ({', '.join(labels[:10])})")
                if len(labels) > 10:
                    print(f"    ... y {len(labels) - 10} proyectos mas")

        print("Muestra de asignaciones:")
        for nomina, contacto_id in assignable[:20]:
            empleado = f"{nomina.apellido or ''}, {nomina.nombre or ''}".strip(", ")
            proyecto = proyectos_by_id.get(int(nomina.idproyecto), f"Proyecto #{nomina.idproyecto}")
            contacto = contactos_by_id.get(contacto_id, f"Contacto #{contacto_id}")
            current = (
                contactos_by_id.get(
                    int(nomina.encargado_contacto_id),
                    f"Contacto #{nomina.encargado_contacto_id}",
                )
                if nomina.encargado_contacto_id is not None
                else "Sin encargado"
            )
            print(f"  Nomina #{nomina.id}: {empleado} | {proyecto} | {current} -> {contacto}")

        if not apply_changes:
            print("Dry run: no se aplicaron cambios.")
            return len(assignable)

        for nomina, contacto_id in assignable:
            nomina.encargado_contacto_id = contacto_id

        session.commit()
        print(f"Filas actualizadas: {len(assignable)}")
        return len(assignable)


def main() -> None:
    args = parse_args()
    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    run(
        apply_changes=args.apply,
        project_id=args.project_id,
        repair_invalid=args.repair_invalid,
    )


if __name__ == "__main__":
    main()
