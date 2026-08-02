import sys
from datetime import date

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session

from app.db import engine
from app.models.proy_presupuesto import ProyPresupuesto

with Session(engine) as session:
    row = session.query(ProyPresupuesto).filter(
        ProyPresupuesto.proyecto_id == 18,
        ProyPresupuesto.fecha == date(2026, 6, 1),
    ).first()

    print('row', row.id if row else None)
    print('importe', row.importe if row else None)
    print('mo_propia', row.mo_propia if row else None)
    print('mo_terceros', row.mo_terceros if row else None)
    print('materiales', row.materiales if row else None)
    print('herramientas', row.herramientas if row else None)
