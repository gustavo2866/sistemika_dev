"""Initialize missing rows in parte_diario_estados.

Usage:
    cd backend
    python scripts/seed_parte_diario_estados.py
"""

import sys
from pathlib import Path

from sqlmodel import Session

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine
from app.services.parte_diario_estado_service import seed_parte_diario_estados


def main() -> None:
    with Session(engine) as session:
        inserted = seed_parte_diario_estados(session)
    print(f"Estados de parte diario insertados: {inserted}")


if __name__ == "__main__":
    main()
