"""Reaplica idempotentemente los seeds Relacional y Pendientes."""
import sys
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.db import engine
from sqlmodel import Session
from app.services.cash_projection_configuration import lock_projection_configuration, validate_cash_dependencies


def main():
    # La definición versionada es la única fuente del seed.
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261114_seed_cash_projection_methods.py"
    spec = spec_from_file_location("cash_projection_methods_seed", path)
    seed = module_from_spec(spec)
    spec.loader.exec_module(seed)
    with Session(engine) as session:
        lock_projection_configuration(session)
        with Operations.context(MigrationContext.configure(session.connection())):
            seed.upgrade()
        validate_cash_dependencies(session)
        session.commit()
    print("Seeds Relacional y Pendientes aplicados")


if __name__ == "__main__":
    main()
