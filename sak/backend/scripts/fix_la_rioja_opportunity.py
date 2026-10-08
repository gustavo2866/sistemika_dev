#!/usr/bin/env python
"""Crea en PROD oportunidades de proyectos tomando TEST como modelo.

La oportunidad recibe un ID nuevo de produccion. El script mapea las referencias
por identidad de negocio, no por los IDs de TEST:

- La Rioja: TEST oportunidad 200 -> PROD proyecto 10 / contacto 306.
- AXION: TEST oportunidad 208 -> PROD proyecto 18 / contacto 283.
- El tipo de operacion se resuelve por codigo (``proyecto``).
- El responsable se toma del proyecto de produccion.
- La oportunidad y el vinculo con el proyecto se guardan en una sola transaccion.

Por defecto se comporta como dry-run. Para aplicar exige ``--apply`` y una
confirmacion explicita.

Uso:
    python backend/scripts/fix_la_rioja_opportunity.py --profile la-rioja --dry-run
    python backend/scripts/fix_la_rioja_opportunity.py --profile axion --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from sqlmodel import Session, select


BACKEND_PATH = Path(__file__).resolve().parents[1]
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import engine  # noqa: E402
from app.models.crm.catalogos import CRMTipoOperacion  # noqa: E402
from app.models.crm.contacto import CRMContacto  # noqa: E402
from app.models.crm.oportunidad import CRMOportunidad  # noqa: E402
from app.models.proyecto import Proyecto  # noqa: E402
from app.models.proyecto_encargado import ProyectoEncargado  # noqa: E402
from scripts.sync_proyectos_test_to_prod import TEST_URL as DEFAULT_TEST_URL  # noqa: E402


@dataclass(frozen=True)
class OpportunityProfile:
    key: str
    test_opportunity_id: int
    expected_test_title: str
    expected_test_contact_name: str
    prod_project_id: int
    prod_contact_id: int
    expected_project_name: str
    expected_prod_contact_name: str

    @property
    def confirmation_text(self) -> str:
        return f"CREAR OPORTUNIDAD PARA PROYECTO {self.prod_project_id}"


PROFILES = {
    "la-rioja": OpportunityProfile(
        key="la-rioja",
        test_opportunity_id=200,
        expected_test_title="La Rioja 474-Boreal",
        expected_test_contact_name="SEBASTIAN M.",
        prod_project_id=10,
        prod_contact_id=306,
        expected_project_name="La Rioja 474-Boreal",
        expected_prod_contact_name="SEBASTIAN M.",
    ),
    "axion": OpportunityProfile(
        key="axion",
        test_opportunity_id=208,
        expected_test_title="AXION ? Emilio Castelar 1003",
        expected_test_contact_name="Gustavo Test",
        prod_project_id=18,
        prod_contact_id=283,
        expected_project_name="AXION - Emilio Castelar 1003",
        expected_prod_contact_name="JUAN M. MEDINA",
    ),
    "catamarca-corrientes": OpportunityProfile(
        key="catamarca-corrientes",
        test_opportunity_id=205,
        expected_test_title="Catamarca y Corrientes",
        expected_test_contact_name="proyecto: San Pablo Residences",
        prod_project_id=15,
        prod_contact_id=303,
        expected_project_name="Catamarca y Corrientes",
        expected_prod_contact_name="RICARDO",
    ),
    "torres-sp": OpportunityProfile(
        key="torres-sp",
        test_opportunity_id=204,
        expected_test_title="Torres SP SRL-Solana Yerba s/n-San Pablo",
        expected_test_contact_name="Santiago (Torres SP)",
        prod_project_id=14,
        prod_contact_id=284,
        expected_project_name="Torres SP SRL-Solana Yerba s/n-San Pablo",
        expected_prod_contact_name="MARIO",
    ),
    "inst-sanitaria": OpportunityProfile(
        key="inst-sanitaria",
        test_opportunity_id=240,
        expected_test_title="INST. SANITARIA",
        expected_test_contact_name="proyecto: DIVISADERO II",
        prod_project_id=21,
        prod_contact_id=302,
        expected_project_name="INST. SANITARIA",
        expected_prod_contact_name="RENE",
    ),
}

UNMAPPED_REFERENCE_FIELDS = (
    "emprendimiento_id",
    "propiedad_id",
    "tipo_propiedad_id",
    "motivo_perdida_id",
    "moneda_id",
    "condicion_pago_id",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crea y vincula en PROD una oportunidad basada en TEST.",
    )
    parser.add_argument(
        "--profile",
        choices=sorted(PROFILES),
        default="la-rioja",
        help="Proyecto a procesar (predeterminado: la-rioja).",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida y muestra el plan sin modificar datos (modo predeterminado).",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Crea y vincula la oportunidad luego de una confirmacion explicita.",
    )
    return parser.parse_args()


def _psycopg_url(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


def _test_database_url() -> str:
    return _psycopg_url(os.getenv("TEST_DATABASE_URL") or DEFAULT_TEST_URL)


def _load_test_opportunity(profile: OpportunityProfile) -> dict[str, Any]:
    query = """
        SELECT
            o.id,
            o.titulo,
            o.contacto_id,
            c.nombre_completo AS contacto_nombre,
            t.codigo AS tipo_operacion_codigo,
            o.emprendimiento_id,
            o.propiedad_id,
            o.tipo_propiedad_id,
            o.estado,
            o.activo,
            o.fecha_estado,
            o.motivo_perdida_id,
            o.monto,
            o.moneda_id,
            o.condicion_pago_id,
            o.forma_pago_descripcion,
            o.probabilidad,
            o.fecha_cierre_estimada,
            o.descripcion_estado,
            o.descripcion,
            o.ultimo_mensaje_id,
            o.deleted_at
        FROM crm_oportunidades AS o
        LEFT JOIN crm_contactos AS c ON c.id = o.contacto_id
        LEFT JOIN crm_tipos_operacion AS t ON t.id = o.tipo_operacion_id
        WHERE o.id = %s
    """
    with psycopg.connect(_test_database_url(), row_factory=dict_row) as connection:
        connection.execute("SET TRANSACTION READ ONLY")
        source = connection.execute(query, (profile.test_opportunity_id,)).fetchone()
        connection.rollback()

    if source is None:
        raise SystemExit(f"No existe TEST oportunidad {profile.test_opportunity_id}.")
    source = dict(source)
    if source["deleted_at"] is not None:
        raise SystemExit(f"TEST oportunidad {profile.test_opportunity_id} esta eliminada.")
    if source["titulo"].strip() != profile.expected_test_title:
        raise SystemExit(
            f"TEST oportunidad {profile.test_opportunity_id} se titula {source['titulo']!r}; "
            f"se esperaba {profile.expected_test_title!r}."
        )
    if source["contacto_nombre"].strip() != profile.expected_test_contact_name:
        raise SystemExit(
            f"El contacto de TEST es {source['contacto_nombre']!r}; "
            f"se esperaba {profile.expected_test_contact_name!r}."
        )

    unmapped = [field for field in UNMAPPED_REFERENCE_FIELDS if source[field] is not None]
    if unmapped:
        raise SystemExit(
            "La oportunidad de TEST contiene referencias que requieren mapeo: "
            + ", ".join(unmapped)
        )
    if not source["tipo_operacion_codigo"]:
        raise SystemExit("La oportunidad de TEST no tiene tipo de operacion resoluble.")
    return source


def _load_prod_project(
    session: Session,
    profile: OpportunityProfile,
    *,
    for_update: bool,
) -> Proyecto:
    statement = select(Proyecto).where(Proyecto.id == profile.prod_project_id)
    if for_update:
        statement = statement.with_for_update()
    project = session.exec(statement).one_or_none()
    if project is None:
        raise SystemExit(f"No existe PROD proyecto {profile.prod_project_id}.")
    if project.deleted_at is not None:
        raise SystemExit(f"PROD proyecto {profile.prod_project_id} esta eliminado.")
    if project.nombre.strip() != profile.expected_project_name:
        raise SystemExit(
            f"PROD proyecto {profile.prod_project_id} se llama {project.nombre!r}; "
            f"se esperaba {profile.expected_project_name!r}."
        )
    return project


def _load_prod_contact(
    session: Session,
    profile: OpportunityProfile,
    *,
    for_update: bool,
) -> CRMContacto:
    statement = select(CRMContacto).where(CRMContacto.id == profile.prod_contact_id)
    if for_update:
        statement = statement.with_for_update()
    contact = session.exec(statement).one_or_none()
    if contact is None:
        raise SystemExit(f"No existe PROD contacto {profile.prod_contact_id}.")
    if contact.deleted_at is not None:
        raise SystemExit(f"PROD contacto {profile.prod_contact_id} esta eliminado.")
    if contact.nombre_completo.strip() != profile.expected_prod_contact_name:
        raise SystemExit(
            f"PROD contacto {profile.prod_contact_id} se llama {contact.nombre_completo!r}; "
            f"se esperaba {profile.expected_prod_contact_name!r}."
        )
    return contact


def _validate_prod_assignment(
    session: Session,
    profile: OpportunityProfile,
) -> ProyectoEncargado:
    assignment = session.exec(
        select(ProyectoEncargado)
        .where(ProyectoEncargado.proyecto_id == profile.prod_project_id)
        .where(ProyectoEncargado.contacto_id == profile.prod_contact_id)
        .where(ProyectoEncargado.activo.is_(True))
        .where(ProyectoEncargado.deleted_at.is_(None))
    ).one_or_none()
    if assignment is None:
        raise SystemExit(
            f"El contacto PROD {profile.prod_contact_id} no es encargado activo "
            f"del proyecto {profile.prod_project_id}."
        )
    return assignment


def _load_prod_operation_type(
    session: Session,
    code: str,
    *,
    for_update: bool,
) -> CRMTipoOperacion:
    statement = (
        select(CRMTipoOperacion)
        .where(CRMTipoOperacion.codigo == code)
        .where(CRMTipoOperacion.deleted_at.is_(None))
    )
    if for_update:
        statement = statement.with_for_update()
    operation_type = session.exec(statement).one_or_none()
    if operation_type is None:
        raise SystemExit(f"No existe en PROD el tipo de operacion con codigo {code!r}.")
    if not operation_type.activo:
        raise SystemExit(f"El tipo de operacion PROD {code!r} esta inactivo.")
    return operation_type


def _find_existing_opportunity(
    session: Session,
    *,
    title: str,
    contact_id: int,
    operation_type_id: int,
) -> CRMOportunidad | None:
    return session.exec(
        select(CRMOportunidad)
        .where(CRMOportunidad.titulo == title)
        .where(CRMOportunidad.contacto_id == contact_id)
        .where(CRMOportunidad.tipo_operacion_id == operation_type_id)
        .where(CRMOportunidad.deleted_at.is_(None))
        .order_by(CRMOportunidad.id)
    ).first()


def _print_plan(
    source: dict[str, Any],
    project: Proyecto,
    contact: CRMContacto,
    operation_type: CRMTipoOperacion,
    existing: CRMOportunidad | None,
) -> None:
    print(f"PROD: {engine.url.host or ''}/{engine.url.database or ''}")
    print(f"TEST oportunidad modelo: {source['id']} - {source['titulo']}")
    print(
        f"Contacto: TEST {source['contacto_id']} -> "
        f"PROD {contact.id} ({contact.nombre_completo})"
    )
    print(
        f"Tipo de operacion: codigo {source['tipo_operacion_codigo']} -> "
        f"PROD {operation_type.id}"
    )
    print(f"Responsable PROD: {project.responsable_id} (tomado del proyecto)")
    print(f"Proyecto PROD: {project.id} - {project.nombre}")
    print(f"Oportunidad actual del proyecto: {project.oportunidad_id or 'Sin oportunidad'}")
    if source["ultimo_mensaje_id"] is not None:
        print(
            f"Ultimo mensaje TEST {source['ultimo_mensaje_id']}: "
            "se omitira porque no corresponde copiar referencias entre bases."
        )
    if existing is None:
        print("Oportunidad PROD: se creara con un ID nuevo generado por la base.")
    else:
        print(f"Oportunidad PROD equivalente existente: {existing.id}")


def _new_prod_opportunity(
    source: dict[str, Any],
    project: Proyecto,
    contact: CRMContacto,
    operation_type: CRMTipoOperacion,
) -> CRMOportunidad:
    return CRMOportunidad(
        titulo=project.nombre,
        contacto_id=contact.id,
        tipo_operacion_id=operation_type.id,
        estado=source["estado"],
        activo=source["activo"],
        fecha_estado=source["fecha_estado"],
        monto=source["monto"],
        forma_pago_descripcion=source["forma_pago_descripcion"],
        probabilidad=source["probabilidad"],
        fecha_cierre_estimada=source["fecha_cierre_estimada"],
        responsable_id=project.responsable_id,
        descripcion_estado=source["descripcion_estado"],
        descripcion=(
            "Oportunidad creada automaticamente para proyecto existente: "
            f"{project.nombre}"
        ),
    )


def run(*, profile: OpportunityProfile, apply_changes: bool) -> int | None:
    source = _load_test_opportunity(profile)
    with Session(engine) as session:
        if not apply_changes and session.get_bind().dialect.name == "postgresql":
            session.connection().exec_driver_sql("SET TRANSACTION READ ONLY")

        project = _load_prod_project(session, profile, for_update=apply_changes)
        contact = _load_prod_contact(session, profile, for_update=apply_changes)
        _validate_prod_assignment(session, profile)
        operation_type = _load_prod_operation_type(
            session,
            source["tipo_operacion_codigo"],
            for_update=apply_changes,
        )

        if project.oportunidad_id is not None:
            linked = session.get(CRMOportunidad, project.oportunidad_id)
            if linked is None or linked.deleted_at is not None:
                raise SystemExit(
                    f"El proyecto referencia una oportunidad invalida: {project.oportunidad_id}."
                )
            _print_plan(source, project, contact, operation_type, linked)
            print("\nSin cambios: el proyecto ya tiene una oportunidad valida vinculada.")
            session.rollback()
            return int(linked.id)

        existing = _find_existing_opportunity(
            session,
            title=project.nombre,
            contact_id=int(contact.id),
            operation_type_id=int(operation_type.id),
        )
        _print_plan(source, project, contact, operation_type, existing)

        if not apply_changes:
            action = (
                "vincularia la oportunidad existente"
                if existing
                else "crearia y vincularia una oportunidad"
            )
            print(f"\nDry run: {action} para el proyecto {profile.prod_project_id}.")
            print("No se aplicaron cambios.")
            session.rollback()
            return int(existing.id) if existing and existing.id is not None else None

        confirmation = input(
            f"\nEscribi {profile.confirmation_text} para confirmar: "
        ).strip()
        if confirmation != profile.confirmation_text:
            session.rollback()
            raise SystemExit("Operacion cancelada; no se modificaron datos.")

        opportunity = existing
        if opportunity is None:
            opportunity = _new_prod_opportunity(source, project, contact, operation_type)
            session.add(opportunity)
            session.flush()

        project.oportunidad_id = opportunity.id
        project.updated_at = datetime.now(UTC)
        session.add(project)
        session.flush()

        if opportunity.id is None or project.oportunidad_id != opportunity.id:
            session.rollback()
            raise SystemExit("La verificacion previa al commit fallo; no se aplicaron cambios.")

        opportunity_id = int(opportunity.id)
        session.commit()

    print(
        f"\nCambio aplicado: oportunidad PROD {opportunity_id} vinculada "
        f"al proyecto {profile.prod_project_id}."
    )
    return opportunity_id


def main() -> None:
    args = parse_args()
    run(profile=PROFILES[args.profile], apply_changes=args.apply)


if __name__ == "__main__":
    main()
