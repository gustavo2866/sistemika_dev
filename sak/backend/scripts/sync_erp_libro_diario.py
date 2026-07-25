"""CLI wrapper para sincronizar erp_libro_diario.

La logica de negocio vive en app.models.erp.libro_diario_sync.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.erp.libro_diario_sync import run_sync


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sincroniza erp_libro_diario por periodo")
    parser.add_argument(
        "--periodo",
        required=True,
        help="Periodo a sincronizar. Formatos aceptados: YYYY-MM o YYYYMM",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5000,
        help="Tamano de lote para leer e insertar registros",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo informa cantidad a cargar, no elimina ni inserta",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_sync(periodo=args.periodo, batch_size=args.batch_size, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
