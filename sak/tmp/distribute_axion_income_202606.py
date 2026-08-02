import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select

from app.db import engine
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto
from app.routers.erp_presupuesto_router import distribute_presupuesto_ingresos_to_erp_rows

PROJECT_ID = 18
PERIOD = date(2026, 6, 1)

with Session(engine) as session:
    project_budget = session.exec(
        select(ProyPresupuesto).where(
            ProyPresupuesto.proyecto_id == PROJECT_ID,
            ProyPresupuesto.fecha == PERIOD,
        )
    ).first()

    if project_budget is None:
        raise RuntimeError('No existe presupuesto de proyecto para el periodo solicitado')

    total_ingreso = Decimal(str(project_budget.importe or 0))
    print('monto_total_ingreso', total_ingreso)

    rows = session.exec(
        select(ErpPresupuesto)
        .where(ErpPresupuesto.deleted_at.is_(None))
        .where(ErpPresupuesto.proyecto_id == PROJECT_ID)
        .where(ErpPresupuesto.fecha == PERIOD)
    ).all()

    rows_payload = [
        {
            'id': row.id,
            'erp_cuenta_id': row.erp_cuenta_id,
            'egreso': Decimal(str(row.egreso or 0)),
            'ingres': Decimal(str(row.ingres or 0)),
        }
        for row in rows
    ]

    distributed = distribute_presupuesto_ingresos_to_erp_rows(
        rows=rows_payload,
        monto_total=total_ingreso,
    )

    print('filas_evaluadas', len(rows_payload))
    print('filas_con_egreso', len([row for row in distributed if Decimal(str(row.get('egreso') or 0)) > 0]))

    for item in distributed:
        presupuesto = session.get(ErpPresupuesto, item['id'])
        if presupuesto is None:
            continue
        presupuesto.ingres = item['monto_distribuido']
        print('actualizado', presupuesto.id, item['monto_distribuido'])

    session.commit()
    print('fin')
