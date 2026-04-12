from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable

from sqlmodel import Session, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import engine  # noqa: E402
from app.models import (  # noqa: E402
    CRMContacto,
    CRMOportunidad,
    CRMOportunidadLogEstado,
    CRMTipoOperacion,
    Propiedad,
)
from app.models.enums import EstadoOportunidad  # noqa: E402

OPEN_STATE = EstadoOportunidad.ABIERTA.value
VALID_CLOSED_STATES = {
    EstadoOportunidad.GANADA.value,
    EstadoOportunidad.PERDIDA.value,
}
VALID_STATES = {OPEN_STATE, *VALID_CLOSED_STATES}
INVALID_TO_OPEN_STATES = {
    EstadoOportunidad.PROSPECT.value,
    EstadoOportunidad.VISITA.value,
    EstadoOportunidad.COTIZA.value,
    EstadoOportunidad.RESERVA.value,
}
NORMALIZED_LOG_DESCRIPTION = (
    f"Log historico normalizado automaticamente para estado {OPEN_STATE}"
)
INITIAL_LOG_DESCRIPTION_TEMPLATE = (
    "Log inicial generado automaticamente para estado {estado}"
)
NEAREST_PROPERTY_WINDOW = timedelta(days=2)


@dataclass
class FixSummary:
    states_fixed: int = 0
    properties_fixed: int = 0
    tipo_propiedad_fixed: int = 0
    logs_created: int = 0
    logs_updated: int = 0


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def get_maintenance_type_ids(session: Session) -> list[int]:
    stmt = select(CRMTipoOperacion).where(
        (CRMTipoOperacion.codigo.ilike("%mantenimiento%"))
        | (CRMTipoOperacion.nombre.ilike("%mantenimiento%"))
    )
    return [item.id for item in session.exec(stmt).all() if item.id is not None]


def build_phone_contact_index(session: Session) -> dict[str, set[int]]:
    index: dict[str, set[int]] = defaultdict(set)
    contactos = session.exec(select(CRMContacto)).all()
    for contacto in contactos:
        for phone in contacto.telefonos or []:
            normalized = normalize_phone(phone)
            if normalized:
                index[normalized].add(contacto.id)
    return index


def get_distinct_property_ids(
    session: Session,
    contacto_ids: Iterable[int],
    *,
    tipo_operacion_ids: set[int] | None = None,
) -> list[int]:
    contacto_ids = [contacto_id for contacto_id in contacto_ids if contacto_id is not None]
    if not contacto_ids:
        return []

    stmt = select(CRMOportunidad.propiedad_id).where(
        CRMOportunidad.contacto_id.in_(contacto_ids),
        CRMOportunidad.propiedad_id.is_not(None),
        CRMOportunidad.deleted_at.is_(None),
    )
    if tipo_operacion_ids:
        stmt = stmt.where(CRMOportunidad.tipo_operacion_id.in_(tipo_operacion_ids))

    values = session.exec(stmt).all()
    return sorted({value for value in values if value is not None})


def infer_property_id(
    session: Session,
    oportunidad: CRMOportunidad,
    maintenance_type_ids: set[int],
    phone_contact_index: dict[str, set[int]],
) -> tuple[int | None, str | None]:
    if not oportunidad.contacto_id:
        return None, None

    same_contact_same_type = get_distinct_property_ids(
        session,
        [oportunidad.contacto_id],
        tipo_operacion_ids=maintenance_type_ids,
    )
    if len(same_contact_same_type) == 1:
        return same_contact_same_type[0], "same-contact-maintenance"

    same_contact_all = get_distinct_property_ids(session, [oportunidad.contacto_id])
    if len(same_contact_all) == 1:
        return same_contact_all[0], "same-contact-any"

    contacto = session.get(CRMContacto, oportunidad.contacto_id)
    phone_peers: set[int] = set()
    if contacto:
        for phone in contacto.telefonos or []:
            normalized = normalize_phone(phone)
            if normalized:
                phone_peers.update(phone_contact_index.get(normalized, set()))

    if phone_peers:
        peer_same_type = get_distinct_property_ids(
            session,
            phone_peers,
            tipo_operacion_ids=maintenance_type_ids,
        )
        if len(peer_same_type) == 1:
            return peer_same_type[0], "same-phone-maintenance"

        peer_all = get_distinct_property_ids(session, phone_peers)
        if len(peer_all) == 1:
            return peer_all[0], "same-phone-any"

    stmt = (
        select(CRMOportunidad)
        .where(
            CRMOportunidad.contacto_id == oportunidad.contacto_id,
            CRMOportunidad.propiedad_id.is_not(None),
            CRMOportunidad.deleted_at.is_(None),
        )
        .order_by(CRMOportunidad.created_at.asc(), CRMOportunidad.id.asc())
    )
    candidates = session.exec(stmt).all()
    if candidates and oportunidad.created_at:
        nearest: tuple[timedelta, int] | None = None
        for candidate in candidates:
            if candidate.created_at is None or candidate.propiedad_id is None:
                continue
            distance = abs(candidate.created_at - oportunidad.created_at)
            if distance > NEAREST_PROPERTY_WINDOW:
                continue
            payload = (distance, candidate.propiedad_id)
            if nearest is None or payload < nearest:
                nearest = payload
        if nearest:
            return nearest[1], "same-contact-nearest"

    return None, None


def ensure_tipo_propiedad_matches(
    session: Session,
    oportunidad: CRMOportunidad,
) -> bool:
    if not oportunidad.propiedad_id:
        return False
    propiedad = session.get(Propiedad, oportunidad.propiedad_id)
    if not propiedad:
        return False
    if oportunidad.tipo_propiedad_id == propiedad.tipo_propiedad_id:
        return False
    oportunidad.tipo_propiedad_id = propiedad.tipo_propiedad_id
    return True


def ensure_log_consistency(
    oportunidad: CRMOportunidad,
    summary: FixSummary,
) -> None:
    logs = sorted(
        oportunidad.logs_estado or [],
        key=lambda item: (item.fecha_registro or datetime.min.replace(tzinfo=UTC), item.id or 0),
    )

    if not logs:
        log = CRMOportunidadLogEstado(
            oportunidad_id=oportunidad.id,
            estado_anterior=EstadoOportunidad.PROSPECT.value,
            estado_nuevo=oportunidad.estado,
            descripcion=INITIAL_LOG_DESCRIPTION_TEMPLATE.format(estado=oportunidad.estado),
            usuario_id=oportunidad.responsable_id or 1,
            fecha_registro=oportunidad.fecha_estado or oportunidad.created_at or datetime.now(UTC),
            motivo_perdida_id=oportunidad.motivo_perdida_id,
            monto=oportunidad.monto,
            moneda_id=oportunidad.moneda_id,
            condicion_pago_id=oportunidad.condicion_pago_id,
        )
        oportunidad.logs_estado.append(log)
        summary.logs_created += 1
        return

    last_log = logs[-1]
    if (
        len(logs) == 1
        and last_log.estado_anterior == EstadoOportunidad.PROSPECT.value
        and last_log.estado_nuevo in INVALID_TO_OPEN_STATES
        and oportunidad.estado == OPEN_STATE
    ):
        last_log.estado_nuevo = OPEN_STATE
        last_log.descripcion = NORMALIZED_LOG_DESCRIPTION
        if oportunidad.fecha_estado:
            last_log.fecha_registro = oportunidad.fecha_estado
        if not last_log.usuario_id:
            last_log.usuario_id = oportunidad.responsable_id or 1
        summary.logs_updated += 1
        return

    if last_log.estado_nuevo != oportunidad.estado:
        log = CRMOportunidadLogEstado(
            oportunidad_id=oportunidad.id,
            estado_anterior=last_log.estado_nuevo,
            estado_nuevo=oportunidad.estado,
            descripcion=(
                f"Log de reconciliacion automatica para alinear estado {last_log.estado_nuevo}"
                f" -> {oportunidad.estado}"
            ),
            usuario_id=oportunidad.responsable_id or last_log.usuario_id or 1,
            fecha_registro=oportunidad.fecha_estado or datetime.now(UTC),
            motivo_perdida_id=oportunidad.motivo_perdida_id,
            monto=oportunidad.monto,
            moneda_id=oportunidad.moneda_id,
            condicion_pago_id=oportunidad.condicion_pago_id,
        )
        oportunidad.logs_estado.append(log)
        summary.logs_created += 1


def reconcile(apply_changes: bool) -> int:
    summary = FixSummary()

    with Session(engine) as session:
        maintenance_type_ids = set(get_maintenance_type_ids(session))
        if not maintenance_type_ids:
            print("No se encontraron tipos de operacion de mantenimiento.")
            return 1

        phone_contact_index = build_phone_contact_index(session)

        oportunidades = session.exec(
            select(CRMOportunidad)
            .where(CRMOportunidad.tipo_operacion_id.in_(maintenance_type_ids))
            .order_by(CRMOportunidad.id.asc())
        ).all()

        unresolved_property_ids: list[int] = []
        property_reasons: dict[int, str] = {}

        for oportunidad in oportunidades:
            property_was_inferred = False
            if oportunidad.propiedad_id is None:
                inferred_property_id, reason = infer_property_id(
                    session,
                    oportunidad,
                    maintenance_type_ids,
                    phone_contact_index,
                )
                if inferred_property_id is None:
                    unresolved_property_ids.append(oportunidad.id)
                else:
                    oportunidad.propiedad_id = inferred_property_id
                    property_was_inferred = True
                    property_reasons[oportunidad.id] = reason or "unknown"
                    summary.properties_fixed += 1

            if oportunidad.estado in INVALID_TO_OPEN_STATES:
                oportunidad.estado = OPEN_STATE
                oportunidad.activo = True
                summary.states_fixed += 1
            elif oportunidad.estado in VALID_CLOSED_STATES or oportunidad.estado == OPEN_STATE:
                if not oportunidad.activo:
                    oportunidad.activo = True
            else:
                raise RuntimeError(
                    f"Oportunidad {oportunidad.id} tiene estado inesperado '{oportunidad.estado}'"
                )

            if property_was_inferred and ensure_tipo_propiedad_matches(session, oportunidad):
                summary.tipo_propiedad_fixed += 1

            ensure_log_consistency(oportunidad, summary)
            session.add(oportunidad)

        if unresolved_property_ids:
            session.rollback()
            print("No se pudieron inferir propiedad_id para:", unresolved_property_ids)
            return 1

        if not apply_changes:
            session.rollback()
            print("Dry run completado.")
            print("states_fixed=", summary.states_fixed)
            print("properties_fixed=", summary.properties_fixed)
            print("tipo_propiedad_fixed=", summary.tipo_propiedad_fixed)
            print("logs_created=", summary.logs_created)
            print("logs_updated=", summary.logs_updated)
            print("property_reasons=", property_reasons)
            return 0

        session.commit()

        rows = session.exec(
            select(CRMOportunidad)
            .where(CRMOportunidad.tipo_operacion_id.in_(maintenance_type_ids))
            .order_by(CRMOportunidad.id.asc())
        ).all()

        invalid_state_ids = [
            item.id
            for item in rows
            if item.estado not in VALID_STATES
        ]
        missing_property_ids = [
            item.id
            for item in rows
            if item.propiedad_id is None
        ]
        missing_log_ids = [
            item.id
            for item in rows
            if not item.logs_estado
        ]

        print("Reconciliacion aplicada.")
        print("states_fixed=", summary.states_fixed)
        print("properties_fixed=", summary.properties_fixed)
        print("tipo_propiedad_fixed=", summary.tipo_propiedad_fixed)
        print("logs_created=", summary.logs_created)
        print("logs_updated=", summary.logs_updated)
        print("property_reasons=", property_reasons)
        print("invalid_state_ids=", invalid_state_ids)
        print("missing_property_ids=", missing_property_ids)
        print("missing_log_ids=", missing_log_ids)
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reconciliar oportunidades de mantenimiento y sus logs."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica cambios. Si no se pasa, corre en dry run.",
    )
    args = parser.parse_args()
    return reconcile(apply_changes=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
