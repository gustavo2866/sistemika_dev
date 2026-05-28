"""
Sincroniza la tabla tipos_contrato de TEST → PROD.

Para cada registro en TEST, si existe un registro con el mismo id en PROD,
reemplaza TODOS sus campos (nombre, descripcion, activo, template).
No crea ni elimina registros en PROD.

Uso:
    cd backend
    python scripts/sync_tipos_contrato_test_to_prod.py
"""

import json
import psycopg

TEST_URL = (
    "postgresql://neondb_owner:npg_2HqUWwPRtEy7"
    "@ep-dry-dew-ack3rlnb-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
)
PROD_URL = (
    "postgresql://neondb_owner:npg_2HqUWwPRtEy7"
    "@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
)

SELECT_ALL = "SELECT id, nombre, descripcion, activo, template FROM tipos_contrato ORDER BY id"
UPDATE = """
    UPDATE tipos_contrato
    SET nombre = %s, descripcion = %s, activo = %s, template = %s
    WHERE id = %s
"""


def main() -> None:
    with psycopg.connect(TEST_URL) as test_conn, psycopg.connect(PROD_URL) as prod_conn:
        with test_conn.cursor() as tc:
            tc.execute(SELECT_ALL)
            test_rows = tc.fetchall()

        with prod_conn.cursor() as pc:
            pc.execute("SELECT id FROM tipos_contrato")
            prod_ids = {row[0] for row in pc.fetchall()}

        updated = []
        skipped = []

        with prod_conn.cursor() as pc:
            for row in test_rows:
                rid, nombre, descripcion, activo, template = row
                if rid in prod_ids:
                    pc.execute(UPDATE, (nombre, descripcion, activo, json.dumps(template) if template is not None else None, rid))
                    updated.append(rid)
                else:
                    skipped.append(rid)

        prod_conn.commit()

    print(f"Actualizados ({len(updated)}): ids {updated}")
    if skipped:
        print(f"Sin coincidencia en PROD, omitidos ({len(skipped)}): ids {skipped}")


if __name__ == "__main__":
    main()
