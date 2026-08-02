import sys
from datetime import date

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select

from app.db import engine
from app.models.constructora.proyectos_conceptos import ProyectosConceptos
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto

for project_id, name in [(19, 'Francia'), (10, 'La Rioja')]:
    print('PROJECT', name, project_id)
    with Session(engine) as session:
        budget = session.exec(
            select(ProyPresupuesto).where(
                ProyPresupuesto.proyecto_id == project_id,
                ProyPresupuesto.fecha == date(2026, 6, 1),
            )
        ).first()
        print('budget', budget.importe if budget else None)
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
            .where(ErpPresupuesto.proyecto_id == project_id)
            .where(ErpPresupuesto.fecha == date(2026, 6, 1))
            .order_by(ErpPresupuesto.id)
        ).all()
        print('rows', len(rows))
        for row in rows:
            concepto = None
            if row.proyectos_concepto_id is not None:
                concepto = session.get(ProyectosConceptos, int(row.proyectos_concepto_id))
            print(' ', row.id, 'cuenta', row.erp_cuenta_id, 'egreso', row.egreso, 'real_egreso', row.real_egreso, 'concepto', getattr(concepto, 'nombre', None))
    print()
