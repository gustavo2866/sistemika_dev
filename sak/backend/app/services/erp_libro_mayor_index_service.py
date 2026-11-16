from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import Numeric, cast, update
from sqlmodel import Session, select

from app.models.erp.indice import ErpIndice
from app.models.erp.libro_mayor import ErpLibroMayor


ICC_UPDATE_START_PERIOD = date(2024, 1, 1)


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def update_libro_mayor_totals_by_icc(
    session: Session,
    *,
    periodo_destino: date | None = None,
) -> dict[str, object]:
    requested_target_period = _month_start(periodo_destino or date.today())
    indices = session.exec(
        select(ErpIndice)
        .where(
            ErpIndice.codigo == "ICC",
            ErpIndice.deleted_at.is_(None),
        )
        .order_by(ErpIndice.fecha, ErpIndice.id)
    ).all()
    index_by_period = {
        _month_start(index.fecha): Decimal(str(index.valor))
        for index in indices
    }

    def resolve_index_period(period: date) -> date | None:
        candidates = [available for available in index_by_period if available <= period]
        return max(candidates) if candidates else None

    target_period = resolve_index_period(requested_target_period)
    if target_period is None:
        raise ValueError(
            "No existe un valor ICC para el período destino ni para períodos anteriores"
        )
    target_index = index_by_period[target_period]
    if target_index <= 0:
        raise ValueError(f"El valor ICC de {target_period:%Y-%m} debe ser mayor a cero")

    stored_periods = session.exec(
        select(ErpLibroMayor.periodo_anio, ErpLibroMayor.periodo_mes)
        .where(
            ErpLibroMayor.deleted_at.is_(None),
            (
                (ErpLibroMayor.periodo_anio > ICC_UPDATE_START_PERIOD.year)
                | (
                    (ErpLibroMayor.periodo_anio == ICC_UPDATE_START_PERIOD.year)
                    & (ErpLibroMayor.periodo_mes >= ICC_UPDATE_START_PERIOD.month)
                )
            ),
        )
        .distinct()
        .order_by(ErpLibroMayor.periodo_anio, ErpLibroMayor.periodo_mes)
    ).all()
    periods = [date(int(year), int(month), 1) for year, month in stored_periods]
    source_index_periods = {
        period: resolve_index_period(period)
        for period in periods
    }
    missing_periods = [
        period for period, index_period in source_index_periods.items()
        if index_period is None
    ]
    if missing_periods:
        formatted = ", ".join(period.strftime("%Y-%m") for period in missing_periods)
        raise ValueError(f"Falta el valor ICC para los períodos: {formatted}")

    rows_updated = 0
    factors: list[dict[str, str]] = []
    now = datetime.now(UTC)
    try:
        for period in periods:
            source_index_period = source_index_periods[period]
            assert source_index_period is not None
            source_index = index_by_period[source_index_period]
            if source_index <= 0:
                raise ValueError(f"El valor ICC de {period:%Y-%m} debe ser mayor a cero")
            factor = target_index / source_index
            result = session.exec(
                update(ErpLibroMayor)
                .where(
                    ErpLibroMayor.deleted_at.is_(None),
                    ErpLibroMayor.periodo_anio == period.year,
                    ErpLibroMayor.periodo_mes == period.month,
                )
                .values(
                    total_debe_actualizado=cast(
                        ErpLibroMayor.total_debe * factor,
                        Numeric(18, 6),
                    ),
                    total_haber_actualizado=cast(
                        ErpLibroMayor.total_haber * factor,
                        Numeric(18, 6),
                    ),
                    updated_at=now,
                    version=ErpLibroMayor.version + 1,
                )
            )
            rows_updated += int(result.rowcount or 0)
            factors.append(
                {
                    "periodo": period.strftime("%Y-%m"),
                    "periodo_icc_origen": source_index_period.strftime("%Y-%m"),
                    "icc_origen": str(source_index),
                    "factor": str(factor.quantize(Decimal("0.000001"))),
                }
            )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "indice": "ICC",
        "periodo_desde": ICC_UPDATE_START_PERIOD.strftime("%Y-%m"),
        "periodo_destino_solicitado": requested_target_period.strftime("%Y-%m"),
        "periodo_destino": target_period.strftime("%Y-%m"),
        "periodo_destino_fallback": target_period != requested_target_period,
        "icc_destino": str(target_index),
        "periodos_actualizados": len(periods),
        "rows_updated": rows_updated,
        "factores": factors,
    }

