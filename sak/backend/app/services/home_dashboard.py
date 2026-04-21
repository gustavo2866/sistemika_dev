from __future__ import annotations

import os
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Date, cast, func, or_
from sqlmodel import Session, select

from app.db import ENV
from app.models.base import current_utc_time, serialize_datetime
from app.models.compras import PoInvoice, PoInvoiceStatus, PoOrder, PoOrderStatus
from app.models.crm import CRMEvento, CRMMensaje, CRMOportunidad
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.user import User
from app.services.propiedades_dashboard import _get_inmobiliaria_alert_days

OPEN_CRM_STATES = (
    EstadoOportunidad.ABIERTA.value,
    EstadoOportunidad.VISITA.value,
    EstadoOportunidad.COTIZA.value,
    EstadoOportunidad.RESERVA.value,
)

HOME_PARTIAL_KEYS = {"miDia", "radar", "summary"}


def _scalar_count(session: Session, statement) -> int:
    return int(session.exec(statement).one() or 0)


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


def _build_quick_actions() -> list[dict[str, str]]:
    return [
        {
            "key": "nuevo_evento",
            "label": "Nuevo evento",
            "href": "/crm/crm-eventos/create",
        },
        {
            "key": "nueva_oportunidad",
            "label": "Nueva oportunidad",
            "href": "/crm/oportunidades/create",
        },
        {
            "key": "nueva_orden",
            "label": "Nueva orden",
            "href": "/po-orders/create",
        },
    ]


def _build_summary_payload(items: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": sum(item["count"] for item in items),
        "urgent": sum(item["count"] for item in items if item["severity"] == "urgent"),
        "high": sum(item["count"] for item in items if item["severity"] == "high"),
        "normal": sum(item["count"] for item in items if item["severity"] == "normal"),
    }


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
        compras_items["aprobaciones_pendientes"],
    ]
    return {
        "total": sum(item["count"] for item in items),
        "items": items,
    }


def _build_radar_payload(sections: list[dict[str, Any]]) -> dict[str, Any]:
    severity_order = {"urgent": 0, "high": 1, "normal": 2}
    excluded_radar_keys = {
        "chats_nuevos",
        "agenda_pendiente",
        "agenda_vencida",
        "aprobaciones_pendientes",
    }
    items = sorted(
        (
            {
                **item,
                "sectionLabel": section["label"],
            }
            for section in sections
            for item in section["items"]
            if item["key"] not in excluded_radar_keys
        ),
        key=lambda item: (severity_order.get(item["severity"], 99), -item["count"], item["label"]),
    )[:4]
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
    stale_cutoff = now_utc - timedelta(days=30)

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
        .where(CRMOportunidad.responsable_id == current_user.id)
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
                "prospects_sin_resolver",
                "Prospects sin resolver",
                prospects,
                "normal",
                "personal",
                "/dashboard-crm",
                "Ver prospects",
            ),
            _item(
                "oportunidades_sin_actividad",
                "Oportunidades sin actividad",
                sin_actividad,
                "high",
                "personal",
                "/dashboard-crm",
                "Reactivar",
            ),
        ],
    )


def _build_compras_section(
    session: Session,
    current_user: User,
    today: date,
) -> dict[str, Any]:
    oc_emitidas = _scalar_count(
        session,
        select(func.count(PoOrder.id))
        .select_from(PoOrder)
        .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
        .where(PoOrder.deleted_at.is_(None))
        .where(func.lower(PoOrderStatus.nombre) == "emitida"),
    )

    fc_confirmadas = _scalar_count(
        session,
        select(func.count(PoInvoice.id))
        .select_from(PoInvoice)
        .join(PoInvoiceStatus, PoInvoice.invoice_status_id == PoInvoiceStatus.id)
        .where(PoInvoice.deleted_at.is_(None))
        .where(func.lower(PoInvoiceStatus.nombre) == "confirmada"),
    )

    facturas_vencidas = _scalar_count(
        session,
        select(func.count(PoInvoice.id))
        .select_from(PoInvoice)
        .join(PoInvoiceStatus, PoInvoice.invoice_status_id == PoInvoiceStatus.id, isouter=True)
        .where(PoInvoice.deleted_at.is_(None))
        .where(PoInvoice.usuario_responsable_id == current_user.id)
        .where(PoInvoice.fecha_vencimiento.is_not(None))
        .where(cast(PoInvoice.fecha_vencimiento, Date) < today)
        .where(
            or_(
                PoInvoiceStatus.id.is_(None),
                func.lower(PoInvoiceStatus.nombre).not_in(["cerrada", "anulada"]),
            )
        ),
    )

    return _section(
        key="compras",
        label="Compras",
        description="Aprobaciones y pagos",
        items=[
            _item(
                "aprobaciones_pendientes",
                "Aprobaciones pendientes",
                oc_emitidas + fc_confirmadas,
                "high",
                "global",
                "/po-orders-approval",
                "Abrir bandeja",
                meta={
                    "ordenes_compra_emitidas": oc_emitidas,
                    "facturas_confirmadas": fc_confirmadas,
                },
            ),
            _item(
                "facturas_vencidas",
                "Facturas vencidas",
                facturas_vencidas,
                "urgent",
                "personal",
                "/po-invoices-agenda",
                "Ver facturas",
            ),
        ],
    )


def _build_inmobiliaria_section(
    session: Session,
    today: date,
) -> tuple[dict[str, Any], dict[str, int]]:
    dias_vencimiento, dias_actualizacion, dias_vacancia = _get_inmobiliaria_alert_days(session)
    limite_vencimiento = today + timedelta(days=dias_vencimiento)
    limite_actualizacion = today + timedelta(days=dias_actualizacion)
    corte_vacancia = today - timedelta(days=dias_vacancia)

    contratos_vencer = _scalar_count(
        session,
        select(func.count(Propiedad.id))
        .select_from(Propiedad)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(Propiedad.deleted_at.is_(None))
        .where(PropiedadesStatus.orden == 4)
        .where(Propiedad.vencimiento_contrato.is_not(None))
        .where(Propiedad.vencimiento_contrato >= today)
        .where(Propiedad.vencimiento_contrato < limite_vencimiento),
    )

    contratos_actualizar = _scalar_count(
        session,
        select(func.count(Propiedad.id))
        .select_from(Propiedad)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(Propiedad.deleted_at.is_(None))
        .where(PropiedadesStatus.orden == 4)
        .where(Propiedad.fecha_renovacion.is_not(None))
        .where(Propiedad.fecha_renovacion >= today)
        .where(Propiedad.fecha_renovacion < limite_actualizacion)
        .where(
            or_(
                Propiedad.vencimiento_contrato.is_(None),
                Propiedad.fecha_renovacion <= Propiedad.vencimiento_contrato,
            )
        ),
    )

    vacancias_prolongadas = _scalar_count(
        session,
        select(func.count(Propiedad.id))
        .select_from(Propiedad)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
        .where(Propiedad.deleted_at.is_(None))
        .where(PropiedadesStatus.orden.in_([1, 2, 3]))
        .where(Propiedad.vacancia_fecha.is_not(None))
        .where(Propiedad.vacancia_fecha < corte_vacancia),
    )

    return (
        _section(
            key="inmobiliaria",
            label="Inmobiliaria",
            description="Contratos y vacancias",
            items=[
                _item(
                    "contratos_proximos_vencer",
                    "Contratos proximos a vencer",
                    contratos_vencer,
                    "urgent",
                    "global",
                    "/propiedades-dashboard",
                    "Ver contratos",
                ),
                _item(
                    "contratos_proximos_actualizar",
                    "Contratos proximos a actualizar",
                    contratos_actualizar,
                    "high",
                    "global",
                    "/propiedades-dashboard",
                    "Ver renovaciones",
                ),
                _item(
                    "vacancias_prolongadas",
                    "Vacancias prolongadas",
                    vacancias_prolongadas,
                    "high",
                    "global",
                    "/propiedades-dashboard",
                    "Ver vacancias",
                ),
            ],
        ),
        {
            "vencimiento": dias_vencimiento,
            "actualizacion": dias_actualizacion,
            "vacancia": dias_vacancia,
        },
    )


def build_home_dashboard_bundle(
    session: Session,
    current_user: User,
) -> dict[str, Any]:
    today = date.today()
    now_utc = current_utc_time()

    personal = _build_personal_section(session, current_user, today)
    crm = _build_crm_section(session, current_user, now_utc)
    compras = _build_compras_section(session, current_user, today)
    inmobiliaria, _alert_days = _build_inmobiliaria_section(session, today)
    sections = [personal, compras, inmobiliaria, crm]

    items = [item for section in sections for item in section["items"]]
    summary = _build_summary_payload(items)

    return {
        "generatedAt": serialize_datetime(now_utc),
        "environment": _build_environment_payload(),
        "user": {
            "id": current_user.id,
            "nombre": current_user.nombre,
        },
        "summary": summary,
        "miDia": _build_mi_dia_payload(personal, compras),
        "radar": _build_radar_payload(sections),
        "quickActions": _build_quick_actions(),
    }


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
    inmobiliaria: dict[str, Any] | None = None

    def get_personal() -> dict[str, Any]:
        nonlocal personal
        if personal is None:
            personal = _build_personal_section(session, current_user, today)
        return personal

    def get_compras() -> dict[str, Any]:
        nonlocal compras
        if compras is None:
            compras = _build_compras_section(session, current_user, today)
        return compras

    def get_crm() -> dict[str, Any]:
        nonlocal crm
        if crm is None:
            crm = _build_crm_section(session, current_user, now_utc)
        return crm

    def get_inmobiliaria() -> dict[str, Any]:
        nonlocal inmobiliaria
        if inmobiliaria is None:
            inmobiliaria, _ = _build_inmobiliaria_section(session, today)
        return inmobiliaria

    payload: dict[str, Any] = {
        "generatedAt": serialize_datetime(now_utc),
    }

    for key in requested_keys:
        if key == "miDia":
            payload["miDia"] = _build_mi_dia_payload(get_personal(), get_compras())
        elif key == "radar":
            payload["radar"] = _build_radar_payload(
                [get_compras(), get_inmobiliaria(), get_crm()],
            )
        elif key == "summary":
            sections = [get_personal(), get_compras(), get_inmobiliaria(), get_crm()]
            items = [item for section in sections for item in section["items"]]
            payload["summary"] = _build_summary_payload(items)

    return payload
