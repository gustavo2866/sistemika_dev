import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select

from app.db import engine
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto

for project_id, name in [(19, 'Francia'), (10, 'La Rioja')]:
    with Session(engine) as session:
        budget = session.exec(
            select(ProyPresupuesto).where(
                ProyPresupuesto.proyecto_id == project_id,
                ProyPresupuesto.fecha == date(2026, 6, 1),
            )
        ).first()
        rows = session.exec(
            select(ErpPresupuesto)
            .where(ErpPresupuesto.deleted_at.is_(None))
            .where(ErpPresupuesto.proyecto_id == project_id)
            .where(ErpPresupuesto.fecha == date(2026, 6, 1))
        ).all()
        total_egreso = sum(Decimal(str(r.egreso or 0)) for r in rows)
        total_ingreso = sum(Decimal(str(r.ingres or 0)) for r in rows)
        print(name, 'presupuesto', budget.importe if budget else None)
        print(name, 'egresos', total_egreso)
        print(name, 'ingresos', total_ingreso)
