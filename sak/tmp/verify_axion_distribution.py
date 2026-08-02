import sys
from decimal import Decimal

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select
from sqlalchemy import extract

from app.db import engine
from app.models.constructora.proyectos_conceptos import ProyectosConceptos
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto

PROJECT_ID = 18
YEAR = 2026
MONTH = 6

with Session(engine) as session:
    rows = session.exec(
        select(
            ErpPresupuesto.id,
            ErpPresupuesto.erp_cuenta_id,
            ErpPresupuesto.egreso,
            ErpPresupuesto.real_egreso,
            ErpCuenta.proyectos_concepto_id,
        )
        .join(ErpCuenta, ErpPresupuesto.erp_cuenta_id == ErpCuenta.id)
        .where(ErpPresupuesto.deleted_at.is_(None))
        .where(ErpPresupuesto.proyecto_id == PROJECT_ID)
        .where(extract('year', ErpPresupuesto.fecha) == YEAR)
        .where(extract('month', ErpPresupuesto.fecha) == MONTH)
        .order_by(ErpPresupuesto.id)
    ).all()

    print('rows', len(rows))
    totals = {}
    for row in rows:
        concepto_id = row.proyectos_concepto_id
        if concepto_id is None:
            name = 'sin_concepto'
        else:
            concepto = session.get(ProyectosConceptos, int(concepto_id))
            name = concepto.nombre.lower() if concepto else 'sin_concepto'
        amount = Decimal(str(row.egreso))
        totals[name] = totals.get(name, Decimal('0')) + amount
        print(name, amount)

    print('totals', {k: str(v) for k, v in totals.items()})
