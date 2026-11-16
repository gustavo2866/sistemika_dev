#!/usr/bin/env python
"""Genera proyecciones con el mismo motor de Reconstruir Cash, sin importar ERP."""
import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlmodel import Session
from app.db import engine
from app.services.cash_projection_generation_service import recalculate_cash_projections
from app.services.cash_projection_service import _shift_month
from app.services.cash_projection_horizon import get_projection_horizon
from app.services.erp_cash_pendientes_projection_service import rebuild_pending_cash_projection


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start")
    parser.add_argument("--months", type=int)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with Session(engine) as session:
        try:
            horizon = get_projection_horizon(session) if args.start is None or args.months is None else None
            start = date.fromisoformat(args.start + "-01") if args.start else horizon.start
            if start < date(2026, 1, 1) or (args.months is not None and args.months < 1):
                parser.error("Indicar un inicio desde enero de 2026 y una cantidad positiva de meses")
            end = _shift_month(start, args.months - 1) if args.months else horizon.end
            if end < start:
                parser.error("El fin del horizonte es anterior al inicio solicitado")
            rebuild_pending_cash_projection(session, period_from=start, period_to=end, auto_commit=False)
            stats = recalculate_cash_projections(session, start, end)
            if args.apply:
                session.commit()
            else:
                session.rollback()
            print({"desde": str(start), "hasta": str(end), "aplicado": args.apply, **stats})
        except Exception:
            session.rollback()
            raise


if __name__ == "__main__":
    main()
