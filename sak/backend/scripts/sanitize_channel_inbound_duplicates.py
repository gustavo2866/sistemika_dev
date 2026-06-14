"""Soft-delete duplicate active inbound rows before enabling DB invariants.

Dry-run is the default. Use --apply only after reviewing the proposed changes.

Usage:
    cd backend
    python scripts/sanitize_channel_inbound_duplicates.py
    python scripts/sanitize_channel_inbound_duplicates.py --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import bindparam, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402


CRM_DUPLICATES_SQL = text(
    """
    WITH ranked AS (
        SELECT
            id,
            origen_externo_id,
            oportunidad_id,
            ROW_NUMBER() OVER (
                PARTITION BY origen_externo_id
                ORDER BY
                    CASE WHEN metadata->'agent_v3' IS NOT NULL THEN 0 ELSE 1 END,
                    CASE WHEN oportunidad_id IS NOT NULL THEN 0 ELSE 1 END,
                    id
            ) AS position
        FROM crm_mensajes
        WHERE deleted_at IS NULL
          AND tipo = 'entrada'
          AND origen_externo_id IS NOT NULL
    )
    SELECT id, origen_externo_id, oportunidad_id, position
    FROM ranked
    WHERE origen_externo_id IN (
        SELECT origen_externo_id
        FROM ranked
        GROUP BY origen_externo_id
        HAVING COUNT(*) > 1
    )
    ORDER BY origen_externo_id, position, id
    """
)

CRM_REFERENCES_SQL = text(
    """
    WITH ranked AS (
        SELECT
            id,
            origen_externo_id,
            ROW_NUMBER() OVER (
                PARTITION BY origen_externo_id
                ORDER BY
                    CASE WHEN metadata->'agent_v3' IS NOT NULL THEN 0 ELSE 1 END,
                    CASE WHEN oportunidad_id IS NOT NULL THEN 0 ELSE 1 END,
                    id
            ) AS position
        FROM crm_mensajes
        WHERE deleted_at IS NULL
          AND tipo = 'entrada'
          AND origen_externo_id IS NOT NULL
    ),
    redundant AS (
        SELECT id, origen_externo_id
        FROM ranked
        WHERE position > 1
          AND origen_externo_id IN (
              SELECT origen_externo_id
              FROM ranked
              GROUP BY origen_externo_id
              HAVING COUNT(*) > 1
          )
    )
    SELECT
        'crm_oportunidades.ultimo_mensaje_id' AS reference,
        oportunidad.id AS row_id,
        redundant.id AS duplicate_message_id
    FROM redundant
    JOIN crm_oportunidades AS oportunidad
      ON oportunidad.ultimo_mensaje_id = redundant.id
    UNION ALL
    SELECT
        'agente_conversation_states.last_message_id',
        state.oportunidad_id,
        redundant.id
    FROM redundant
    JOIN agente_conversation_states AS state
      ON state.last_message_id = redundant.id
    UNION ALL
    SELECT
        'agente_process_requests.ultimo_mensaje_id',
        request.id,
        redundant.id
    FROM redundant
    JOIN agente_process_requests AS request
      ON request.ultimo_mensaje_id = redundant.id
    UNION ALL
    SELECT
        'constructora_pedidos.mensaje_origen_id',
        pedido.id,
        redundant.id
    FROM redundant
    JOIN constructora_pedidos AS pedido
      ON pedido.mensaje_origen_id = redundant.id
    UNION ALL
    SELECT
        'partes_diario.mensaje_origen_id',
        parte.id,
        redundant.id
    FROM redundant
    JOIN partes_diario AS parte
      ON parte.mensaje_origen_id = redundant.id
    ORDER BY reference, row_id
    """
)

CHANNEL_DUPLICATES_SQL = text(
    """
    WITH ranked AS (
        SELECT
            id,
            provider,
            channel_type,
            external_message_id,
            ROW_NUMBER() OVER (
                PARTITION BY provider, channel_type, external_message_id
                ORDER BY id
            ) AS position
        FROM channel_events
        WHERE deleted_at IS NULL
          AND direction = 'inbound'
          AND external_message_id IS NOT NULL
    )
    SELECT id, provider, channel_type, external_message_id, position
    FROM ranked
    WHERE (provider, channel_type, external_message_id) IN (
        SELECT provider, channel_type, external_message_id
        FROM ranked
        GROUP BY provider, channel_type, external_message_id
        HAVING COUNT(*) > 1
    )
    ORDER BY provider, channel_type, external_message_id, position, id
    """
)


def _print_rows(label: str, rows: list[dict], *, show_action: bool = True) -> None:
    print(f"[{label}] rows={len(rows)}")
    for row in rows:
        if show_action:
            action = "KEEP" if row["position"] == 1 else "SOFT_DELETE"
            print(f"{action}: {row}")
        else:
            print(row)


def _soft_delete(connection, table: str, ids: list[int]) -> None:
    if not ids:
        return
    statement = text(
        f"""
        UPDATE {table}
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN :ids
        """
    ).bindparams(bindparam("ids", expanding=True))
    connection.execute(statement, {"ids": ids})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply soft-deletes. Without this flag the script only prints its plan.",
    )
    args = parser.parse_args()

    with engine.begin() as connection:
        crm_rows = [dict(row) for row in connection.execute(CRM_DUPLICATES_SQL).mappings()]
        channel_rows = [dict(row) for row in connection.execute(CHANNEL_DUPLICATES_SQL).mappings()]
        crm_references = [dict(row) for row in connection.execute(CRM_REFERENCES_SQL).mappings()]

        _print_rows("crm_mensajes inbound duplicates", crm_rows)
        _print_rows("channel_events inbound duplicates", channel_rows)
        _print_rows("crm_mensajes redundant references", crm_references, show_action=False)

        if not args.apply:
            print("Dry-run: no changes applied.")
            return

        if crm_references:
            raise RuntimeError(
                "Cannot apply soft-deletes: redundant crm_mensajes rows still have references."
            )

        crm_ids = [row["id"] for row in crm_rows if row["position"] > 1]
        channel_ids = [row["id"] for row in channel_rows if row["position"] > 1]
        _soft_delete(connection, "crm_mensajes", crm_ids)
        _soft_delete(connection, "channel_events", channel_ids)
        print(f"Applied soft-deletes: crm_mensajes={len(crm_ids)}, channel_events={len(channel_ids)}")


if __name__ == "__main__":
    main()
