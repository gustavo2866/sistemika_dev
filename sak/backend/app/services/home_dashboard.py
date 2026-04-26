from __future__ import annotations

import json
import os
from urllib.parse import quote
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import and_, false, func, or_
from sqlmodel import Session, select

from app.db import ENV
from app.models.base import current_utc_time, serialize_datetime
from app.models.compras import PoOrder, PoOrderStatus
from app.models.crm import CRMEvento, CRMMensaje, CRMOportunidad
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.models.contrato import Contrato
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.user import User
from app.services.propiedades_dashboard import _get_inmobiliaria_alert_days

OPEN_CRM_STATES = (
    EstadoOportunidad.ABIERTA.value,
    EstadoOportunidad.VISITA.value,
    EstadoOportunidad.COTIZA.value,
    EstadoOportunidad.RESERVA.value,
)
CRM_STALE_OPPORTUNITY_DAYS = 30
MY_PURCHASE_STATUS_NAMES = ("solicitada", "emitida", "aprobada")

HOME_PARTIAL_KEYS = {"miDia", "radar"}
HOME_DOMAIN_KEYS = {"personal", "poorders", "oportunidades", "contratos", "propiedades"}
RADAR_PRIORITY_GROUPS = (
    ("aprobaciones_pendientes",),
    ("solicitudes_pendientes",),
    ("contratos_proximos_vencer",),
    ("contratos_proximos_actualizar",),
    ("vacancias_prolongadas",),
    ("oportunidades_sin_actividad",),
    ("oportunidades_prospect",),
)


def _scalar_count(session: Session, statement) -> int:
    return int(session.exec(statement).one() or 0)


def _build_resource_href(path: str, filters: dict[str, Any] | None = None) -> str:
    if not filters:
        return path
    return f"{path}?filter={quote(json.dumps(filters, separators=(',', ':')))}"


def _item(
    key: str,
    label: str,
    count: int,
    severity: str,
    scope: str,
    href: str,
    cta_label: str,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "key": key,
        "label": label,
        "count": int(count),
        "severity": severity,
        "scope": scope,
        "href": href,
        "ctaLabel": cta_label,
    }
    if meta:
        payload["meta"] = meta
    return payload


def _section(
    key: str,
    label: str,
    description: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "description": description,
        "items": items,
    }


def _build_environment_payload() -> dict[str, str]:
    raw_env = (os.getenv("APP_ENV_LABEL") or ENV or os.getenv("ENV") or "dev").strip().lower()
    mapping = {
        "prod": {"key": "prod", "label": "PROD", "color": "success"},
        "production": {"key": "prod", "label": "PROD", "color": "success"},
        "staging": {"key": "staging", "label": "STAGING", "color": "warning"},
        "test": {"key": "test", "label": "TEST", "color": "warning"},
        "testing": {"key": "test", "label": "TEST", "color": "warning"},
        "dev": {"key": "dev", "label": "DEV", "color": "neutral"},
        "development": {"key": "dev", "label": "DEV", "color": "neutral"},
    }
    return mapping.get(raw_env, {"key": raw_env, "label": raw_env.upper(), "color": "neutral"})


def _build_mi_dia_payload(
    personal: dict[str, Any],
    compras: dict[str, Any],
) -> dict[str, Any]:
    personal_items = {item["key"]: item for item in personal["items"]}
    compras_items = {item["key"]: item for item in compras["items"]}

    agenda_pendiente = personal_items["agenda_pendiente"]
    agenda_vencida = personal_items["agenda_vencida"]
    agenda_count = agenda_pendiente["count"] + agenda_vencida["count"]
    agenda_severity = "urgent" if agenda_vencida["count"] > 0 else "high"
    agenda_item = _item(
        "agenda",
        "Agenda",
        agenda_count,
        agenda_severity,
        "personal",
        agenda_vencida["href"] or agenda_pendiente["href"],
        "Ver agenda",
        meta={
            "pendientes": agenda_pendiente["count"],
            "vencidos": agenda_vencida["count"],
        },
    )
    items = [
        personal_items["chats_nuevos"],
        agenda_item,
        compras_items["mis_compras"],
    ]
    return {
        "total": sum(item["count"] for item in items),
        "items": items,
    }


def _build_radar_payload(sections: list[dict[str, Any]]) -> dict[str, Any]:
    excluded_radar_keys = {
        "chats_nuevos",
        "agenda_pendiente",
        "agenda_vencida",
        "mis_compras",
    }
    available_items = [
        {
            **item,
            "sectionLabel": section["label"],
        }
        for section in sections
        for item in section["items"]
        if item["key"] not in excluded_radar_keys
    ]
    items_by_key = {item["key"]: item for item in available_items}

    prioritized_items: list[dict[str, Any]] = []
    for group in RADAR_PRIORITY_GROUPS:
        selected_item = next(
            (items_by_key[item_key] for item_key in group if item_key in items_by_key),
            None,
        )
        if selected_item is None:
            continue
        prioritized_items.append(selected_item)

    items = prioritized_items
    return {
        "items": items,
    }


def _build_personal_section(
    session: Session,
    current_user: User,
    today: date,
) -> dict[str, Any]:
    chats_nuevos = _scalar_count(
        session,
        select(func.count(func.distinct(CRMMensaje.oportunidad_id)))
        .select_from(CRMMensaje)
        .join(CRMOportunidad, CRMMensaje.oportunidad_id == CRMOportunidad.id)
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMOportunidad.deleted_at.is_(None))
        .where(CRMOportunidad.responsable_id == current_user.id)
        .where(CRMOportunidad.activo.is_(True))
        .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
        .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value),
    )

    agenda_pendiente = _scalar_count(
        session,
        select(func.count(CRMEvento.id))
        .where(CRMEvento.deleted_at.is_(None))
        .where(CRMEvento.asignado_a_id == current_user.id)
        .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
        .where(
            or_(
                CRMEvento.fecha_evento.is_(None),
                func.date(CRMEvento.fecha_evento) >= today,
            )
        ),
    )

    agenda_vencida = _scalar_count(
        session,
        select(func.count(CRMEvento.id))
        .where(CRMEvento.deleted_at.is_(None))
        .where(CRMEvento.asignado_a_id == current_user.id)
        .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
        .where(CRMEvento.fecha_evento.is_not(None))
        .where(func.date(CRMEvento.fecha_evento) < today),
    )

    return _section(
        key="personal",
        label="Mi dia",
        description="Tu trabajo inmediato",
        items=[
            _item(
                "chats_nuevos",
                "Chats nuevos",
                chats_nuevos,
                "high",
                "personal",
                "/crm/chat",
                "Ver chats",
            ),
            _item(
                "agenda_pendiente",
                "Agenda pendiente",
                agenda_pendiente,
                "high",
                "personal",
                "/crm/crm-eventos",
                "Ver agenda",
            ),
            _item(
                "agenda_vencida",
                "Agenda vencida",
                agenda_vencida,
                "urgent",
                "personal",
                "/crm/crm-eventos",
                "Resolver",
            ),
        ],
    )


def _build_crm_section(
    session: Session,
    current_user: User,
    now_utc: datetime,
) -> dict[str, Any]:
    stale_cutoff = now_utc - timedelta(days=CRM_STALE_OPPORTUNITY_DAYS)
    oportunidades_sin_actividad_href = _build_resource_href(
        "/crm/oportunidades",
        {
            "sin_actividad_days": CRM_STALE_OPPORTUNITY_DAYS,
        },
    )
    oportunidades_prospect_href = _build_resource_href(
        "/crm/oportunidades",
        {
            "estado": EstadoOportunidad.PROSPECT.value,
        },
    )

    prospects = _scalar_count(
        session,
        select(func.count(CRMOportunidad.id))
        .where(CRMOportunidad.deleted_at.is_(None))
        .where(CRMOportunidad.responsable_id == current_user.id)
        .where(CRMOportunidad.activo.is_(True))
        .where(CRMOportunidad.estado == EstadoOportunidad.PROSPECT.value),
    )

    sin_actividad = _scalar_count(
        session,
        select(func.count(CRMOportunidad.id))
        .where(CRMOportunidad.deleted_at.is_(None))
        .where(CRMOportunidad.activo.is_(True))
        .where(CRMOportunidad.estado.in_(OPEN_CRM_STATES))
        .where(CRMOportunidad.fecha_estado.is_not(None))
        .where(CRMOportunidad.fecha_estado < stale_cutoff),
    )

    return _section(
        key="crm",
        label="CRM",
        description="Seguimiento comercial",
        items=[
            _item(
                "oportunidades_prospect",
                "Oportunidades prospect",
                prospects,
                "normal",
                "personal",
                oportunidades_prospect_href,
                "Ver oportunidades",
            ),
            _item(
                "oportunidades_sin_actividad",
                f"Oportunidades inactivas > {CRM_STALE_OPPORTUNITY_DAYS} dias",
                sin_actividad,
                "high",
                "global",
                oportunidades_sin_actividad_href,
                "Reactivar",
            ),
        ],
    )


def _build_compras_section(
    session: Session,
    current_user: User,
) -> dict[str, Any]:
    status_names = (*MY_PURCHASE_STATUS_NAMES, "emitida")
    status_rows = session.exec(
        select(PoOrderStatus.nombre, PoOrderStatus.id)
        .where(func.lower(PoOrderStatus.nombre).in_(status_names))
        .order_by(PoOrderStatus.orden.asc(), PoOrderStatus.id.asc())
    ).all()
    status_ids_by_name = {
        nombre.lower(): status_id
        for nombre, status_id in status_rows
        if nombre
    }
    solicitada_status_id = status_ids_by_name.get("solicitada")
    emitida_status_id = status_ids_by_name.get("emitida")
    my_purchase_status_ids = [
        status_ids_by_name[status_name]
        for status_name in MY_PURCHASE_STATUS_NAMES
        if status_name in status_ids_by_name
    ]

    emitida_condition = (
        PoOrder.order_status_id == emitida_status_id
        if emitida_status_id is not None
        else false()
    )
    solicitada_condition = (
        PoOrder.order_status_id == solicitada_status_id
        if solicitada_status_id is not None
        else false()
    )
    my_purchase_condition = (
        and_(
            PoOrder.solicitante_id == current_user.id,
            PoOrder.order_status_id.in_(my_purchase_status_ids),
        )
        if my_purchase_status_ids
        else false()
    )

    order_counts = session.exec(
        select(
            func.count(PoOrder.id).filter(emitida_condition),
            func.count(PoOrder.id).filter(solicitada_condition),
            func.count(PoOrder.id).filter(my_purchase_condition),
        ).where(PoOrder.deleted_at.is_(None))
    ).one()
    oc_emitidas = int(order_counts[0] or 0)
    solicitudes_pendientes = int(order_counts[1] or 0)
    mis_compras = int(order_counts[2] or 0)

    aprobaciones_count = oc_emitidas
    aprobaciones_meta = {
        "ordenes_compra_emitidas": oc_emitidas,
    }

    solicitudes_href = _build_resource_href(
        "/po-orders",
        (
            {
                "order_status_id": solicitada_status_id,
            }
            if solicitada_status_id is not None
            else None
        ),
    )
    mis_compras_href = _build_resource_href(
        "/po-orders",
        {
            "solicitante_id": current_user.id,
            "order_status_id__in": my_purchase_status_ids,
        },
    )

    return _section(
        key="compras",
        label="Compras",
        description="Aprobaciones y pagos",
        items=[
            _item(
                "aprobaciones_pendientes",
                "Aprobaciones pendientes",
                aprobaciones_count,
                "high",
                "global",
                "/po-orders-approval",
                "Abrir bandeja",
                meta=aprobaciones_meta,
            ),
            _item(
                "mis_compras",
                "Mis compras",
                mis_compras,
                "high",
                "personal",
                mis_compras_href,
                "Ver mis compras",
                meta={
                    "estados": ", ".join(MY_PURCHASE_STATUS_NAMES),
                },
            ),
            _item(
                "solicitudes_pendientes",
                "Solicitudes pendientes",
                solicitudes_pendientes,
                "high",
                "global",
                solicitudes_href,
                "Ver solicitudes",
            ),
        ],
    )


def _build_inmobiliaria_alert_context(
    session: Session,
    today: date,
) -> dict[str, Any]:
    dias_vencimiento, dias_actualizacion, dias_vacancia = _get_inmobiliaria_alert_days(session)
    return {
        "dias_vencimiento": dias_vencimiento,
        "dias_actualizacion": dias_actualizacion,
        "dias_vacancia": dias_vacancia,
        "limite_vencimiento": today + timedelta(days=dias_vencimiento),
        "limite_actualizacion": today + timedelta(days=dias_actualizacion),
        "corte_vacancia": today - timedelta(days=dias_vacancia),
    }


def _build_contratos_section(
    session: Session,
    alert_context: dict[str, Any],
) -> dict[str, Any]:
    dias_vencimiento = alert_context["dias_vencimiento"]
    dias_actualizacion = alert_context["dias_actualizacion"]
    limite_vencimiento = alert_context["limite_vencimiento"]
    limite_actualizacion = alert_context["limite_actualizacion"]
    contratos_vencer_href = _build_resource_href(
        "/contratos",
        {
            "estado": "vigente",
            "fecha_vencimiento": {
                "lte": limite_vencimiento.isoformat(),
            },
        },
    )
    contratos_actualizar_href = _build_resource_href(
        "/contratos",
        {
            "estado": "vigente",
            "fecha_renovacion": {
                "lte": limite_actualizacion.isoformat(),
            },
        },
    )

    # Mismo modelo y criterio que propiedades_dashboard (orden=4 / realizada)
    # JOIN a Propiedad+PropiedadesStatus para garantizar coherencia entre dashboards
    contratos_vencer = _scalar_count(
        session,
        select(func.count(Contrato.id))
        .select_from(Contrato)
        .join(Propiedad, Contrato.propiedad_id == Propiedad.id)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(
            Contrato.deleted_at.is_(None),
            Contrato.estado == "vigente",
            Propiedad.deleted_at.is_(None),
            PropiedadesStatus.orden == 4,
            Contrato.fecha_vencimiento.is_not(None),
            Contrato.fecha_vencimiento <= limite_vencimiento,
        ),
    )
    contratos_actualizar = _scalar_count(
        session,
        select(func.count(Contrato.id))
        .select_from(Contrato)
        .join(Propiedad, Contrato.propiedad_id == Propiedad.id)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(
            Contrato.deleted_at.is_(None),
            Contrato.estado == "vigente",
            Propiedad.deleted_at.is_(None),
            PropiedadesStatus.orden == 4,
            Contrato.fecha_renovacion.is_not(None),
            Contrato.fecha_renovacion <= limite_actualizacion,
            or_(
                Contrato.fecha_vencimiento.is_(None),
                Contrato.fecha_renovacion <= Contrato.fecha_vencimiento,
            ),
        ),
    )
    return _section(
        key="contratos",
        label="Inmobiliaria",
        description="Contratos",
        items=[
            _item(
                "contratos_proximos_vencer",
                f"Contratos vencimiento < {dias_vencimiento} dias",
                contratos_vencer,
                "urgent",
                "global",
                contratos_vencer_href,
                "Ver contratos",
            ),
            _item(
                "contratos_proximos_actualizar",
                f"Contratos actualizacion < {dias_actualizacion} dias",
                contratos_actualizar,
                "high",
                "global",
                contratos_actualizar_href,
                "Ver renovaciones",
            ),
        ],
    )


def _build_propiedades_section(
    session: Session,
    alert_context: dict[str, Any],
) -> dict[str, Any]:
    dias_vacancia = alert_context["dias_vacancia"]
    corte_vacancia = alert_context["corte_vacancia"]
    vacancias_prolongadas = _scalar_count(
        session,
        select(func.count(Propiedad.id))
        .select_from(Propiedad)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(
            Propiedad.deleted_at.is_(None),
            PropiedadesStatus.orden.in_([1, 2, 3]),
            Propiedad.vacancia_fecha.is_not(None),
            Propiedad.vacancia_fecha < corte_vacancia,
        ),
    )

    return _section(
        key="propiedades",
        label="Inmobiliaria",
        description="Propiedades",
        items=[
            _item(
                "vacancias_prolongadas",
                f"Propiedades vacantes > {dias_vacancia} dias",
                vacancias_prolongadas,
                "high",
                "global",
                "/propiedades-dashboard",
                "Ver vacancias",
            ),
        ],
    )


def _build_inmobiliaria_sections(
    session: Session,
    today: date,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, int]]:
    alert_context = _build_inmobiliaria_alert_context(session, today)
    contratos = _build_contratos_section(session, alert_context)
    propiedades = _build_propiedades_section(session, alert_context)

    return (
        contratos,
        propiedades,
        {
            "vencimiento": alert_context["dias_vencimiento"],
            "actualizacion": alert_context["dias_actualizacion"],
            "vacancia": alert_context["dias_vacancia"],
        },
    )


def _build_home_context_payload(
    current_user: User,
    now_utc: datetime,
) -> dict[str, Any]:
    return {
        "generatedAt": serialize_datetime(now_utc),
        "environment": _build_environment_payload(),
        "user": {
            "id": current_user.id,
            "nombre": current_user.nombre,
        },
    }


def _build_section_response(
    section: dict[str, Any],
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    return {
        "generatedAt": serialize_datetime(now_utc or current_utc_time()),
        "section": section,
    }


def build_home_dashboard_bundle(
    session: Session,
    current_user: User,
) -> dict[str, Any]:
    today = date.today()
    now_utc = current_utc_time()

    personal = _build_personal_section(session, current_user, today)
    crm = _build_crm_section(session, current_user, now_utc)
    compras = _build_compras_section(session, current_user)
    contratos, propiedades, _alert_days = _build_inmobiliaria_sections(session, today)
    sections = [personal, compras, contratos, propiedades, crm]

    return {
        **_build_home_context_payload(current_user, now_utc),
        "miDia": _build_mi_dia_payload(personal, compras),
        "radar": _build_radar_payload(sections),
    }


def build_home_dashboard_context(
    current_user: User,
) -> dict[str, Any]:
    return _build_home_context_payload(current_user, current_utc_time())


def build_home_dashboard_domain(
    session: Session,
    current_user: User,
    domain: str,
) -> dict[str, Any]:
    if domain not in HOME_DOMAIN_KEYS:
        raise ValueError(f"Dominio de home dashboard invalido: {domain}")

    today = date.today()
    now_utc = current_utc_time()

    if domain == "personal":
        section = _build_personal_section(session, current_user, today)
    elif domain == "poorders":
        section = _build_compras_section(session, current_user)
    elif domain == "oportunidades":
        section = _build_crm_section(session, current_user, now_utc)
    elif domain == "contratos":
        section = _build_contratos_section(
            session,
            _build_inmobiliaria_alert_context(session, today),
        )
    else:
        section = _build_propiedades_section(
            session,
            _build_inmobiliaria_alert_context(session, today),
        )

    return _build_section_response(section, now_utc)


def build_home_dashboard_partial(
    session: Session,
    current_user: User,
    keys: list[str],
) -> dict[str, Any]:
    requested_keys = [key for key in keys if key in HOME_PARTIAL_KEYS]
    if not requested_keys:
        return {
            "generatedAt": serialize_datetime(current_utc_time()),
        }

    today = date.today()
    now_utc = current_utc_time()

    personal: dict[str, Any] | None = None
    compras: dict[str, Any] | None = None
    crm: dict[str, Any] | None = None
    inmobiliaria_sections: tuple[dict[str, Any], dict[str, Any]] | None = None

    def get_personal() -> dict[str, Any]:
        nonlocal personal
        if personal is None:
            personal = _build_personal_section(session, current_user, today)
        return personal

    def get_compras() -> dict[str, Any]:
        nonlocal compras
        if compras is None:
            compras = _build_compras_section(session, current_user)
        return compras

    def get_crm() -> dict[str, Any]:
        nonlocal crm
        if crm is None:
            crm = _build_crm_section(session, current_user, now_utc)
        return crm

    def get_inmobiliaria_sections() -> tuple[dict[str, Any], dict[str, Any]]:
        nonlocal inmobiliaria_sections
        if inmobiliaria_sections is None:
            contratos, propiedades, _ = _build_inmobiliaria_sections(session, today)
            inmobiliaria_sections = (contratos, propiedades)
        return inmobiliaria_sections

    payload: dict[str, Any] = {
        "generatedAt": serialize_datetime(now_utc),
    }

    for key in requested_keys:
        if key == "miDia":
            payload["miDia"] = _build_mi_dia_payload(get_personal(), get_compras())
        elif key == "radar":
            contratos, propiedades = get_inmobiliaria_sections()
            payload["radar"] = _build_radar_payload(
                [get_compras(), contratos, propiedades, get_crm()],
            )

    return payload
