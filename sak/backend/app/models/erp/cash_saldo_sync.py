from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from sqlmodel import Session, select
from app.models.erp.libro_mayor import ErpLibroMayor



CASH_EMPRESA_IDS = frozenset({1, 2, 5})


SALDO_FIELDS = (
    "source_id",
    "empresa_id",
    "periodo_anio",
    "periodo_mes",
    "nivel",
    "cuenta_codigo",
    "tipo_subcuenta",
    "nro_subcuenta",
    "centro_costo",
    "total_debe",
    "total_haber",
    "saldo_periodo",
    "saldo_acumulado",
    "recalculado_en",
    "saldo_anterior",
    "fecha_periodo",
)


def _row_value(row: Any, field: str) -> Any:
    if isinstance(row, Mapping):
        return row.get(field)
    return getattr(row, field, None)


def build_cash_saldo_payloads(
    source_rows: Iterable[Any],
    fondo_account_codes: set[int],
) -> list[dict[str, Any]]:
    """Normaliza saldos subcuenta pertenecientes a cuentas contables Fondo."""
    payloads: list[dict[str, Any]] = []
    for row in source_rows:
        nivel = str(_row_value(row, "nivel") or "").strip().lower()
        cuenta_codigo = int(_row_value(row, "cuenta_codigo"))
        empresa_id = _row_value(row, "empresa_id")
        if (
            empresa_id not in CASH_EMPRESA_IDS
            or nivel != "subcuenta"
            or cuenta_codigo not in fondo_account_codes
        ):
            continue

        payload = {field: _row_value(row, field) for field in SALDO_FIELDS}
        payload["nivel"] = "subcuenta"
        payload["cuenta_codigo"] = cuenta_codigo
        payloads.append(payload)
    return payloads


def fetch_cash_saldo_source_rows(
    session: Session, anio: int, mes: int, fondo_account_codes: set[int],
) -> list[ErpLibroMayor]:
    if not fondo_account_codes:
        return []
    return list(session.exec(select(ErpLibroMayor).where(
        ErpLibroMayor.periodo_anio == anio, ErpLibroMayor.periodo_mes == mes,
        ErpLibroMayor.nivel == "subcuenta", ErpLibroMayor.cuenta_codigo.in_(fondo_account_codes),
        ErpLibroMayor.empresa_id.in_(CASH_EMPRESA_IDS), ErpLibroMayor.deleted_at.is_(None),
    ).order_by(ErpLibroMayor.source_id)).all())
