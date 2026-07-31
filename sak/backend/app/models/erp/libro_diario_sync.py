"""Servicios de sincronizacion para la entidad ErpLibroDiario.

Este modulo concentra la logica de negocio de sincronizacion y actualizacion
asociada a erp_libro_diario y erp_presupuestos.
"""

from __future__ import annotations

import os
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Iterable

import psycopg
from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(BACKEND_ROOT / ".env")


SELECT_QUERY = """
SELECT
        ld.id,
        ld.empresa_id,
        ld.fecha,
        ld.periodo_anio,
        ld.periodo_mes,
        ld.tipo_asiento,
        ld.nro_asiento,
        ld.nro_renglon,
        ld.cuenta_codigo,
        ld.debe,
        ld.haber,
        ld.descripcion,
        ld.tipo_subcuenta,
        ld.nro_subcuenta,
        ld.centro_costo,
        ld.cargado_en,
        ld.archivo_origen
FROM public.libro_diario ld
JOIN public.dim_cuenta dc
    ON dc.nro_cta = ld.cuenta_codigo
WHERE ld.periodo_anio = %s
    AND ld.periodo_mes = %s
    AND ld.empresa_id NOT IN (3, 4)
    AND btrim(ld.centro_costo) = ANY(%s)
    AND ld.centro_costo IS NOT NULL
    AND btrim(ld.centro_costo) <> ''
    AND btrim(ld.centro_costo) <> '0'
    AND dc.extendido IS NOT NULL
    AND upper(btrim(COALESCE(dc.sub_rubro, ''))) = '01 - OBRAS'
    AND left(btrim(dc.extendido), 1) IN ('4', '5')
ORDER BY ld.id
"""


INSERT_QUERY = """
INSERT INTO public.erp_libro_diario (
    created_at,
    updated_at,
    deleted_at,
    version,
    source_id,
    empresa_id,
    fecha,
    periodo_anio,
    periodo_mes,
    tipo_asiento,
    nro_asiento,
    nro_renglon,
    cuenta_codigo,
    debe,
    haber,
    descripcion,
    tipo_subcuenta,
    nro_subcuenta,
    centro_costo,
    cargado_en,
    archivo_origen
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
"""


MISSING_ACCOUNTS_QUERY = """
SELECT DISTINCT
        ld.cuenta_codigo,
        dc.extendido,
        dc.nombre,
        dc.activa
FROM public.libro_diario ld
JOIN public.dim_cuenta dc
        ON dc.nro_cta = ld.cuenta_codigo
WHERE ld.periodo_anio = %s
    AND ld.periodo_mes = %s
    AND ld.empresa_id NOT IN (3, 4)
    AND ld.centro_costo IS NOT NULL
    AND btrim(ld.centro_costo) <> ''
    AND btrim(ld.centro_costo) <> '0'
    AND btrim(ld.centro_costo) = ANY(%s)
    AND upper(btrim(COALESCE(dc.sub_rubro, ''))) = '01 - OBRAS'
    AND dc.extendido IS NOT NULL
    AND left(btrim(dc.extendido), 1) IN ('4', '5')
ORDER BY ld.cuenta_codigo
"""


def parse_periodo(periodo: str) -> tuple[int, int]:
    value = periodo.strip()
    if "-" in value:
        parts = value.split("-")
        if len(parts) != 2:
            raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")
        anio, mes = parts
    else:
        if len(value) != 6 or not value.isdigit():
            raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")
        anio, mes = value[:4], value[4:]

    if not (anio.isdigit() and mes.isdigit()):
        raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")

    anio_num = int(anio)
    mes_num = int(mes)
    if anio_num < 2000 or anio_num > 2100:
        raise ValueError("Anio fuera de rango esperado (2000-2100).")
    if mes_num < 1 or mes_num > 12:
        raise ValueError("Mes fuera de rango (1-12).")
    return anio_num, mes_num


def normalize_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://")


def get_dest_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL no esta definida.")
    return normalize_url(url)


def get_source_connection_kwargs() -> dict[str, str]:
    host = os.getenv("ERP_SOURCE_DB_HOST")
    dbname = os.getenv("ERP_SOURCE_DB_NAME")
    user = os.getenv("ERP_SOURCE_DB_USER")
    password = os.getenv("NEON_DB_PASSWORD") or os.getenv("ERP_SOURCE_DB_PASSWORD")

    if host and dbname and user and password:
        return {
            "host": host,
            "dbname": dbname,
            "user": user,
            "password": password,
            "sslmode": os.getenv("ERP_SOURCE_SSLMODE", "require"),
        }

    url = os.getenv("ERP_SOURCE_DATABASE_URL") or os.getenv("EXTERNAL_NEON_DATABASE_URL")
    if not url:
        raise RuntimeError(
            "Defini ERP_SOURCE_DB_HOST, ERP_SOURCE_DB_NAME, ERP_SOURCE_DB_USER y NEON_DB_PASSWORD, o ERP_SOURCE_DATABASE_URL/EXTERNAL_NEON_DATABASE_URL para la base origen."
        )
    return {"dsn": normalize_url(url)}


def get_allowed_centros_costo(dest_conn: psycopg.Connection) -> list[str]:
    query = """
    SELECT DISTINCT centro_costo::text
    FROM public.proyectos
    WHERE centro_costo IS NOT NULL
        AND centro_costo <> 0
    ORDER BY centro_costo::text
    """
    with dest_conn.cursor() as cur:
        cur.execute(query)
        return [row[0] for row in cur.fetchall()]


def build_insert_rows(source_rows: Iterable[tuple]) -> list[tuple]:
    now = datetime.now(UTC)
    rows: list[tuple] = []
    for src in source_rows:
        (
            source_id,
            empresa_id,
            fecha,
            periodo_anio,
            periodo_mes,
            tipo_asiento,
            nro_asiento,
            nro_renglon,
            cuenta_codigo,
            debe,
            haber,
            descripcion,
            tipo_subcuenta,
            nro_subcuenta,
            centro_costo,
            cargado_en,
            archivo_origen,
        ) = src

        rows.append(
            (
                now,
                now,
                None,
                1,
                source_id,
                empresa_id,
                fecha,
                periodo_anio,
                periodo_mes,
                tipo_asiento,
                nro_asiento,
                nro_renglon,
                cuenta_codigo,
                debe,
                haber,
                descripcion,
                tipo_subcuenta,
                nro_subcuenta,
                centro_costo,
                cargado_en,
                archivo_origen,
            )
        )
    return rows


def ensure_missing_accounts(
    source_conn: psycopg.Connection,
    dest_conn: psycopg.Connection,
    anio: int,
    mes: int,
    allowed_centros: list[str],
    dry_run: bool,
) -> int:
    def get_rubro_id(dest_cur: psycopg.Cursor, names: tuple[str, ...]) -> int:
        dest_cur.execute(
            "SELECT id FROM public.erp_rubros WHERE lower(nombre) = ANY(%s) ORDER BY id LIMIT 1",
            ([name.lower() for name in names],),
        )
        row = dest_cur.fetchone()
        if row is None:
            joined = ", ".join(names)
            raise RuntimeError(f"No existe rubro requerido en erp_rubros: {joined}")
        return row[0]

    with dest_conn.cursor() as dest_cur:
        rubro_ingresos_id = get_rubro_id(dest_cur, ("Ingresos",))
        rubro_no_identificada_id = get_rubro_id(
            dest_cur,
            ("No identificada", "No identificadas"),
        )

        dest_cur.execute("SELECT nro_cuenta, cod_cuenta FROM public.erp_cuentas")
        existing_by_nro = {row[0]: row[1] for row in dest_cur.fetchall()}
        used_codes = {code.lower() for code in existing_by_nro.values()}

    with source_conn.cursor() as source_cur:
        source_cur.execute(MISSING_ACCOUNTS_QUERY, (anio, mes, allowed_centros))
        source_accounts = source_cur.fetchall()

    missing_in_dim: list[int] = []
    accounts_to_create: list[tuple[int, str, str, bool, int]] = []
    for cuenta_codigo, extendido, nombre, activa in source_accounts:
        if cuenta_codigo in existing_by_nro:
            continue
        if extendido is None or nombre is None:
            missing_in_dim.append(cuenta_codigo)
            continue

        cod_base = str(extendido).strip() or str(cuenta_codigo)
        prefix = cod_base[:1]
        if prefix == "4":
            rubro_id = rubro_ingresos_id
        elif prefix == "5":
            rubro_id = rubro_no_identificada_id
        else:
            continue

        cod_candidate = cod_base
        suffix = 1
        while cod_candidate.lower() in used_codes:
            cod_candidate = f"{cod_base}-{cuenta_codigo}-{suffix}"
            suffix += 1
        used_codes.add(cod_candidate.lower())

        descripcion = str(nombre).strip() or f"Cuenta {cuenta_codigo}"
        accounts_to_create.append(
            (
                cuenta_codigo,
                cod_candidate,
                descripcion,
                True if activa is None else bool(activa),
                rubro_id,
            )
        )

    if missing_in_dim:
        missing_text = ", ".join(str(x) for x in missing_in_dim[:20])
        extra = "" if len(missing_in_dim) <= 20 else f" ... (+{len(missing_in_dim) - 20} mas)"
        raise RuntimeError(
            "No se pudieron crear cuentas faltantes porque no existen en dim_cuenta: "
            f"{missing_text}{extra}"
        )

    if dry_run:
        print(f"[dry-run] Cuentas faltantes a crear en erp_cuentas: {len(accounts_to_create)}")
        if accounts_to_create:
            preview = ", ".join(str(row[0]) for row in accounts_to_create[:20])
            extra = "" if len(accounts_to_create) <= 20 else f" ... (+{len(accounts_to_create)-20} mas)"
            print(f"[dry-run] nro_cuenta a crear: {preview}{extra}")
        return len(accounts_to_create)

    if not accounts_to_create:
        print("No hay cuentas faltantes para crear en erp_cuentas.")
        return 0

    insert_query = """
    INSERT INTO public.erp_cuentas (
        created_at,
        updated_at,
        deleted_at,
        version,
        rubro_id,
        nro_cuenta,
        cod_cuenta,
        descripcion,
        activo,
        proyectos_concepto_id
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    now = datetime.now(UTC).replace(tzinfo=None)
    rows = [
        (now, now, None, 1, rubro_id, nro, cod, desc, activo, None)
        for nro, cod, desc, activo, rubro_id in accounts_to_create
    ]

    with dest_conn.cursor() as dest_cur:
        dest_cur.executemany(insert_query, rows)

    print(f"Cuentas creadas en erp_cuentas por regla de prefijo 4/5: {len(rows)}")
    return len(rows)


REALS_MOVIMIENTOS_CTE = """
WITH movimientos AS (
    SELECT
        p.id AS proyecto_id,
        c.id AS erp_cuenta_id,
        COALESCE(
            SUM(
                CASE
                    WHEN lower(COALESCE(r.nombre, '')) = 'ingresos'
                        THEN -(COALESCE(ld.haber, 0) + COALESCE(ld.debe, 0))
                    ELSE 0
                END
            ),
            0
        ) AS real_ingreso,
        COALESCE(
            SUM(
                CASE
                    WHEN lower(COALESCE(r.nombre, '')) = 'ingresos' THEN 0
                    ELSE COALESCE(ld.haber, 0) + COALESCE(ld.debe, 0)
                END
            ),
            0
        ) AS real_egreso
    FROM public.erp_libro_diario ld
    JOIN public.proyectos p
        ON p.deleted_at IS NULL
        AND p.centro_costo IS NOT NULL
        AND p.centro_costo::text = btrim(ld.centro_costo)
    JOIN public.erp_cuentas c
        ON c.deleted_at IS NULL
        AND c.nro_cuenta = ld.cuenta_codigo
    LEFT JOIN public.erp_rubros r
        ON r.id = c.rubro_id
    WHERE ld.deleted_at IS NULL
        AND ld.periodo_anio = %s
        AND ld.periodo_mes = %s
    GROUP BY p.id, c.id
)
"""


def sync_real_presupuestos(
    dest_conn: psycopg.Connection,
    anio: int,
    mes: int,
    dry_run: bool,
) -> dict[str, int]:
    period_date = date(anio, mes, 1)

    if dry_run:
        with dest_conn.cursor() as cur:
            cur.execute(
                REALS_MOVIMIENTOS_CTE
                + """
                SELECT COUNT(*)
                FROM movimientos
                """,
                (anio, mes),
            )
            combos = int(cur.fetchone()[0])
            print(f"[dry-run] Combinaciones proyecto/cuenta con reales: {combos}")
            cur.execute(
                """
                SELECT COUNT(*)
                FROM public.erp_presupuestos p
                WHERE p.deleted_at IS NULL
                    AND EXTRACT(YEAR FROM p.fecha) = %s
                    AND EXTRACT(MONTH FROM p.fecha) = %s
                    AND COALESCE(p.egreso, 0) = 0
                    AND COALESCE(p.ingres, 0) = 0
                    AND COALESCE(p.real_egreso, 0) = 0
                    AND COALESCE(p.real_ingreso, 0) = 0
                    AND COALESCE(p.obreros_cantidad, 0) = 0
                    AND COALESCE(p.obreros_costo, 0) = 0
                """,
                (anio, mes),
            )
            deleted_empty_count = int(cur.fetchone()[0])
        return {
            "presupuestos_reset": 0,
            "presupuestos_created": 0,
            "presupuestos_updated": 0,
            "presupuestos_deleted_empty": deleted_empty_count,
            "presupuestos_reales_combos": combos,
        }

    with dest_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.erp_presupuestos p
            SET
                real_ingreso = CASE
                    WHEN lower(COALESCE(r.nombre, '')) = 'ingresos' THEN 0
                    ELSE p.real_ingreso
                END,
                real_egreso = 0,
                updated_at = now()
            FROM public.erp_cuentas c
            LEFT JOIN public.erp_rubros r
                ON r.id = c.rubro_id
            WHERE p.deleted_at IS NULL
                AND p.erp_cuenta_id = c.id
                AND EXTRACT(YEAR FROM p.fecha) = %s
                AND EXTRACT(MONTH FROM p.fecha) = %s
            """,
            (anio, mes),
        )
        reset_count = cur.rowcount or 0

        cur.execute(
            REALS_MOVIMIENTOS_CTE
            + """
            INSERT INTO public.erp_presupuestos (
                created_at,
                updated_at,
                deleted_at,
                version,
                fecha,
                proyecto_id,
                erp_cuenta_id,
                egreso,
                ingres,
                real_egreso,
                real_ingreso,
                obreros_cantidad,
                obreros_costo
            )
            SELECT
                now(),
                now(),
                NULL,
                1,
                %s,
                m.proyecto_id,
                m.erp_cuenta_id,
                0,
                0,
                m.real_egreso,
                m.real_ingreso,
                0,
                0
            FROM movimientos m
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.erp_presupuestos p
                WHERE p.deleted_at IS NULL
                    AND p.proyecto_id = m.proyecto_id
                    AND p.erp_cuenta_id = m.erp_cuenta_id
                    AND EXTRACT(YEAR FROM p.fecha) = %s
                    AND EXTRACT(MONTH FROM p.fecha) = %s
            )
            """,
            (anio, mes, period_date, anio, mes),
        )
        created_count = cur.rowcount or 0

        cur.execute(
            REALS_MOVIMIENTOS_CTE
            + """
            UPDATE public.erp_presupuestos p
            SET
                real_ingreso = CASE
                    WHEN lower(COALESCE(r.nombre, '')) = 'ingresos' THEN m.real_ingreso
                    ELSE p.real_ingreso
                END,
                real_egreso = m.real_egreso,
                updated_at = now()
            FROM movimientos m,
                public.erp_cuentas c
            LEFT JOIN public.erp_rubros r
                ON r.id = c.rubro_id
            WHERE p.deleted_at IS NULL
                AND p.proyecto_id = m.proyecto_id
                AND p.erp_cuenta_id = m.erp_cuenta_id
                AND p.erp_cuenta_id = c.id
                AND EXTRACT(YEAR FROM p.fecha) = %s
                AND EXTRACT(MONTH FROM p.fecha) = %s
            """,
            (anio, mes, anio, mes),
        )
        updated_count = cur.rowcount or 0

        cur.execute(
            REALS_MOVIMIENTOS_CTE
            + """
            SELECT COUNT(*)
            FROM movimientos
            """,
            (anio, mes),
        )
        combos = int(cur.fetchone()[0])

        cur.execute(
            """
            DELETE FROM public.erp_presupuestos p
            WHERE p.deleted_at IS NULL
                AND EXTRACT(YEAR FROM p.fecha) = %s
                AND EXTRACT(MONTH FROM p.fecha) = %s
                AND COALESCE(p.egreso, 0) = 0
                AND COALESCE(p.ingres, 0) = 0
                AND COALESCE(p.real_egreso, 0) = 0
                AND COALESCE(p.real_ingreso, 0) = 0
                AND COALESCE(p.obreros_cantidad, 0) = 0
                AND COALESCE(p.obreros_costo, 0) = 0
            """,
            (anio, mes),
        )
        deleted_empty_count = cur.rowcount or 0

    print(
        "Reales en erp_presupuestos actualizados: "
        f"reset={reset_count}, creados={created_count}, actualizados={updated_count}, "
        f"vacios_eliminados={deleted_empty_count}"
    )
    return {
        "presupuestos_reset": int(reset_count),
        "presupuestos_created": int(created_count),
        "presupuestos_updated": int(updated_count),
        "presupuestos_deleted_empty": int(deleted_empty_count),
        "presupuestos_reales_combos": combos,
    }


def run_sync(periodo: str, batch_size: int, dry_run: bool) -> dict[str, int | bool | str]:
    if batch_size <= 0:
        raise ValueError("batch-size debe ser mayor a 0")

    anio, mes = parse_periodo(periodo)
    dest_url = get_dest_url()

    print(f"Periodo objetivo: {anio:04d}-{mes:02d}")
    print("Leyendo origen y sincronizando erp_libro_diario...")
    periodo_normalizado = f"{anio:04d}-{mes:02d}"

    source_conn_kwargs = get_source_connection_kwargs()

    with psycopg.connect(**source_conn_kwargs) as source_conn, psycopg.connect(dest_url) as dest_conn:
        allowed_centros = get_allowed_centros_costo(dest_conn)
        if not allowed_centros:
            print("No hay centros de costo validos en proyectos. Se limpia el periodo objetivo y termina.")
            if not dry_run:
                with dest_conn.cursor() as dest_cur:
                    dest_cur.execute(
                        """
                        DELETE FROM public.erp_libro_diario
                        WHERE periodo_anio = %s AND periodo_mes = %s
                        """,
                        (anio, mes),
                    )
                dest_conn.commit()
            result_empty = {
                "periodo": periodo_normalizado,
                "dry_run": dry_run,
                "allowed_centros": 0,
                "accounts_created": 0,
                "rows_candidate": 0,
                "rows_inserted": 0,
            }
            result_empty.update(
                {
                    "presupuestos_reset": 0,
                    "presupuestos_created": 0,
                    "presupuestos_updated": 0,
                    "presupuestos_deleted_empty": 0,
                    "presupuestos_reales_combos": 0,
                }
            )
            return result_empty

        accounts_created = ensure_missing_accounts(
            source_conn=source_conn,
            dest_conn=dest_conn,
            anio=anio,
            mes=mes,
            allowed_centros=allowed_centros,
            dry_run=dry_run,
        )

        with source_conn.cursor() as source_cur:
            source_cur.execute(SELECT_QUERY, (anio, mes, allowed_centros))

            if dry_run:
                total = 0
                while True:
                    chunk = source_cur.fetchmany(batch_size)
                    if not chunk:
                        break
                    total += len(chunk)
                print(f"[dry-run] Registros que cumplen filtro: {total}")
                real_stats = sync_real_presupuestos(dest_conn, anio, mes, dry_run=True)
                result_dry = {
                    "periodo": periodo_normalizado,
                    "dry_run": True,
                    "allowed_centros": len(allowed_centros),
                    "accounts_created": accounts_created,
                    "rows_candidate": total,
                    "rows_inserted": 0,
                }
                result_dry.update(real_stats)
                return result_dry

            with dest_conn.cursor() as dest_cur:
                dest_cur.execute(
                    """
                    DELETE FROM public.erp_libro_diario
                    WHERE periodo_anio = %s AND periodo_mes = %s
                    """,
                    (anio, mes),
                )

                total_insertados = 0
                while True:
                    chunk = source_cur.fetchmany(batch_size)
                    if not chunk:
                        break
                    rows = build_insert_rows(chunk)
                    dest_cur.executemany(INSERT_QUERY, rows)
                    total_insertados += len(rows)

            real_stats = sync_real_presupuestos(dest_conn, anio, mes, dry_run=False)

        dest_conn.commit()
        print(f"Sincronizacion finalizada. Registros insertados: {total_insertados}")
        result_ok = {
            "periodo": periodo_normalizado,
            "dry_run": False,
            "allowed_centros": len(allowed_centros),
            "accounts_created": accounts_created,
            "rows_candidate": total_insertados,
            "rows_inserted": total_insertados,
        }
        result_ok.update(real_stats)
        return result_ok
