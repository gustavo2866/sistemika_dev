import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select

from app.db import engine
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto

with Session(engine) as session:
    project_budget = session.exec(
        select(ProyPresupuesto).where(
            ProyPresupuesto.proyecto_id == 18,
            ProyPresupuesto.fecha == date(2026, 6, 1),
        )
    ).first()
    rows = session.exec(
        select(ErpPresupuesto)
        .where(ErpPresupuesto.deleted_at.is_(None))
        .where(ErpPresupuesto.proyecto_id == 18)
        .where(ErpPresupuesto.fecha == date(2026, 6, 1))
    ).all()

    total_ingresos = sum(Decimal(str(r.ingres or 0)) for r in rows)
    print('presupuesto_importe', project_budget.importe if project_budget else None)
    print('sum_ingresos', total_ingresos)
    print('rows', len(rows))
    for r in rows:
        if Decimal(str(r.ingres or 0)) > 0:
            print(r.id, r.erp_cuenta_id, r.egreso, r.ingres)
