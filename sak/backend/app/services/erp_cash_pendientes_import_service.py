from __future__ import annotations

import csv
import hashlib
import json
from datetime import UTC, datetime
from io import StringIO
from typing import Literal

from sqlalchemy import delete, func, insert
from sqlmodel import Session, select

from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.empresa import ErpEmpresa


EXPECTED_HEADERS = [
    "TIPCOMP",
    "NOMBRE",
    "SUCURSAL",
    "NROCOMP",
    "TIPSUB",
    "NROSUB",
    "SUBS_DESCRIP",
    "FECVENC",
    "FECPRE",
    "SALDO",
    "IMP EXT.",
    "NROCTA",
    "DESCRIP",
]

RAW_FIELDS = [
    "tipcomp_raw",
    "nombre_raw",
    "sucursal_raw",
    "nrocomp_raw",
    "tipsub_raw",
    "nrosub_raw",
    "subs_descrip_raw",
    "fecvenc_raw",
    "fecpre_raw",
    "saldo_raw",
    "imp_ext_raw",
    "nrocta_raw",
    "descrip_raw",
]


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("El archivo no utiliza una codificación CSV soportada")


def _normalize_row(row: list[str]) -> list[str]:
    values = list(row)
    if values and values[-1] == "":
        values.pop()

    # Los reportes del ERP no escapan los ';' incluidos en DESCRIP. Las primeras
    # 12 columnas son fijas y todo lo restante pertenece a la descripción.
    if len(values) > len(EXPECTED_HEADERS):
        values = values[:12] + [";".join(values[12:])]
    return [value.strip() for value in values]


def parse_cash_pendientes_csv(content: bytes) -> list[dict[str, object]]:
    if not content:
        raise ValueError("El archivo CSV está vacío")

    reader = csv.reader(StringIO(_decode_csv(content), newline=""), delimiter=";")
    try:
        headers = _normalize_row(next(reader))
    except StopIteration as exc:
        raise ValueError("El archivo CSV está vacío") from exc

    if headers != EXPECTED_HEADERS:
        raise ValueError(
            "La cabecera no coincide. Se esperan las columnas: "
            + ", ".join(EXPECTED_HEADERS)
        )

    parsed_rows: list[dict[str, object]] = []
    for row_number, raw_values in enumerate(reader, start=2):
        if not raw_values or not any(value.strip() for value in raw_values):
            continue

        values = _normalize_row(raw_values)
        errors: list[str] = []
        if len(values) < len(EXPECTED_HEADERS):
            errors.append(
                f"Se recibieron {len(values)} columnas y se esperaban {len(EXPECTED_HEADERS)}"
            )
            values.extend([""] * (len(EXPECTED_HEADERS) - len(values)))

        missing_headers = [
            EXPECTED_HEADERS[index]
            for index, value in enumerate(values[: len(EXPECTED_HEADERS)])
            if not value
        ]
        if missing_headers:
            errors.append("Campos vacíos: " + ", ".join(missing_headers))

        raw_data = dict(zip(EXPECTED_HEADERS, values[: len(EXPECTED_HEADERS)]))
        payload: dict[str, object] = {
            field: values[index] or None
            for index, field in enumerate(RAW_FIELDS)
        }
        payload.update(
            {
                "row_number": row_number,
                "is_valid": not errors,
                "validation_status": "valid" if not errors else "invalid",
                "validation_errors": json.dumps(errors, ensure_ascii=False) if errors else None,
                "raw_row": json.dumps(raw_data, ensure_ascii=False),
            }
        )
        parsed_rows.append(payload)

    if not parsed_rows:
        raise ValueError("El archivo CSV no contiene filas de datos")
    return parsed_rows


def import_cash_pendientes_csv(
    session: Session,
    *,
    content: bytes,
    file_name: str,
    erp_empresa_id: int,
    uploaded_by: int | None = None,
    mode: Literal["replace", "append"] = "replace",
) -> dict[str, object]:
    if mode not in {"replace", "append"}:
        raise ValueError("mode debe ser 'replace' o 'append'")

    empresa = session.get(ErpEmpresa, erp_empresa_id)
    if empresa is None or empresa.deleted_at is not None:
        raise ValueError("La empresa ERP indicada no existe")

    rows = parse_cash_pendientes_csv(content)
    file_hash = hashlib.sha256(content).hexdigest()
    existing_same_file = session.exec(
        select(func.count())
        .select_from(ErpCashPendientesInput)
        .where(
            ErpCashPendientesInput.erp_empresa_id == erp_empresa_id,
            ErpCashPendientesInput.file_hash == file_hash,
            ErpCashPendientesInput.deleted_at.is_(None),
        )
    ).one()
    if existing_same_file:
        return {
            "erp_empresa_id": erp_empresa_id,
            "empresa": empresa.empresa_nombre,
            "file_name": file_name,
            "file_hash": file_hash,
            "rows_read": len(rows),
            "rows_imported": 0,
            "rows_valid": sum(bool(row["is_valid"]) for row in rows),
            "rows_invalid": sum(not bool(row["is_valid"]) for row in rows),
            "rows_deleted": 0,
            "duplicate": True,
            "mode": mode,
        }

    uploaded_at = datetime.now(UTC)
    records = [
        {
            **row,
            "erp_empresa_id": erp_empresa_id,
            "uploaded_at": uploaded_at,
            "uploaded_by": uploaded_by,
            "source_name": "cash_pendientes",
            "file_name": file_name,
            "file_hash": file_hash,
            "import_status": "imported",
            "created_at": uploaded_at,
            "updated_at": uploaded_at,
            "deleted_at": None,
            "version": 1,
        }
        for row in rows
    ]

    rows_deleted = 0
    try:
        if mode == "replace":
            result = session.exec(
                delete(ErpCashPendientesInput).where(
                    ErpCashPendientesInput.erp_empresa_id == erp_empresa_id
                )
            )
            rows_deleted = int(result.rowcount or 0)
        session.execute(insert(ErpCashPendientesInput), records)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "erp_empresa_id": erp_empresa_id,
        "empresa": empresa.empresa_nombre,
        "file_name": file_name,
        "file_hash": file_hash,
        "rows_read": len(rows),
        "rows_imported": len(records),
        "rows_valid": sum(bool(record["is_valid"]) for record in records),
        "rows_invalid": sum(not bool(record["is_valid"]) for record in records),
        "rows_deleted": rows_deleted,
        "duplicate": False,
        "mode": mode,
    }
