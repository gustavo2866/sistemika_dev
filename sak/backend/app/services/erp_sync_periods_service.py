"""Períodos con movimientos ERP dentro del alcance de Obras y Cash."""
import psycopg
from sqlmodel import Session

from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo
from app.models.erp.libro_mayor_sync import get_allowed_centros_costo


def _period_query(table: str, alias: str, *, mayor: bool = False) -> str:
    return f"""
        SELECT DISTINCT {alias}.periodo_anio, {alias}.periodo_mes
        FROM public.{table} {alias}
        LEFT JOIN public.dim_cuenta dc ON dc.nro_cta = {alias}.cuenta_codigo
        WHERE ({alias}.periodo_anio, {alias}.periodo_mes) >= (%s, %s)
          {"AND lm.nivel = 'subcuenta'" if mayor else ""}
          AND ({alias}.empresa_id IN (1, 2, 5) OR (
            {alias}.empresa_id NOT IN (3, 4)
            AND btrim({alias}.centro_costo) = ANY(%s)
            AND btrim({alias}.centro_costo) NOT IN ('', '0')
            AND dc.extendido IS NOT NULL
            AND upper(btrim(COALESCE(dc.sub_rubro, ''))) = '01 - OBRAS'
            AND left(btrim(dc.extendido), 1) IN ('4', '5')
          ))
    """


SOURCE_PERIODS_QUERY = (
    _period_query("libro_diario", "ld") + " UNION "
    + _period_query("libro_mayor", "lm", mayor=True)
    + " ORDER BY periodo_anio, periodo_mes"
)


def get_available_sync_periods(session: Session, periodo_desde: str) -> dict:
    year, month = parse_periodo(periodo_desde)
    start = f"{year:04d}-{month:02d}"
    centers = get_allowed_centros_costo(session)
    try:
        with psycopg.connect(**get_source_connection_kwargs()) as conn, conn.cursor() as cursor:
            cursor.execute(SOURCE_PERIODS_QUERY, (year, month, centers, year, month, centers))
            periods = [f"{int(y):04d}-{int(m):02d}" for y, m in cursor.fetchall()]
    except psycopg.Error as exc:
        raise RuntimeError("No se pudieron consultar los períodos con movimientos en el ERP") from exc
    return {"periodo_desde": start, "periodo_hasta": periods[-1] if periods else start, "periodos": periods}
