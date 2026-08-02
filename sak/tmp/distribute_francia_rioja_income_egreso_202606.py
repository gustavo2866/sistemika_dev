import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, r'd:\gpalmieri\proyectos\sistemika_dev\sak\backend')

from sqlmodel import Session, select

from app.db import engine
from app.models.constructora.proyectos_conceptos import ProyectosConceptos
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto
from app.routers.erp_presupuesto_router import distribute_presupuesto_ingresos_to_erp_rows

PROJECTS = [
    (19, 'Francia', 'francia'),
    (10, 'La Rioja', 'rioja'),
]
PERIOD = date(2026, 6, 1)


def _as_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


with Session(engine) as session:
    for project_id, project_name, _slug in PROJECTS:
        project_budget = session.exec(
            select(ProyPresupuesto).where(
                ProyPresupuesto.proyecto_id == project_id,
                ProyPresupuesto.fecha == PERIOD,
            )
        ).first()

        if project_budget is None:
            print(f'{project_name}: sin presupuesto del proyecto para {PERIOD}')
            continue

        rows = session.exec(
            select(ErpPresupuesto)
            .where(ErpPresupuesto.deleted_at.is_(None))
            .where(ErpPresupuesto.proyecto_id == project_id)
            .where(ErpPresupuesto.fecha == PERIOD)
        ).all()

        # Distribución de egreso por concepto usando los pesos de real_egreso de cada concepto.
        concepto_to_monto = {
            'mo_propia': _as_decimal(project_budget.mo_propia),
            'mo_terceros': _as_decimal(project_budget.mo_terceros),
            'materiales': _as_decimal(project_budget.materiales),
            'herramientas': _as_decimal(project_budget.herramientas),
        }
        concept_rows: dict[str, list[ErpPresupuesto]] = {key: [] for key in concepto_to_monto}
        for row in rows:
            concepto_name = 'varios'
            cuenta = session.get(ErpCuenta, row.erp_cuenta_id)
            if cuenta is not None and cuenta.proyectos_concepto_id is not None:
                concepto_obj = session.get(ProyectosConceptos, int(cuenta.proyectos_concepto_id))
                if concepto_obj is not None:
                    concepto_name = concepto_obj.nombre.lower()
            if concepto_name in concept_rows:
                concept_rows[concepto_name].append(row)

        for concepto_name, monto in concepto_to_monto.items():
            target_rows = concept_rows.get(concepto_name, [])
            if monto <= 0 or not target_rows:
                continue
            total_weight = sum(_as_decimal(row.real_egreso) for row in target_rows)
            if total_weight <= 0:
                continue
            remaining = monto
            for index, row in enumerate(target_rows):
                weight = _as_decimal(row.real_egreso)
                share = (monto * weight / total_weight).quantize(Decimal('0.01'))
                if index == len(target_rows) - 1:
                    share = remaining
                remaining -= share
                row.egreso = share

        # Distribución de ingresos usando el egreso ya asignado como peso.
        income_rows_payload = [
            {
                'id': row.id,
                'erp_cuenta_id': row.erp_cuenta_id,
                'egreso': _as_decimal(row.egreso),
                'ingres': _as_decimal(row.ingres),
            }
            for row in rows
        ]
        income_distribution = distribute_presupuesto_ingresos_to_erp_rows(
            rows=income_rows_payload,
            monto_total=_as_decimal(project_budget.importe),
        )
        for item in income_distribution:
            row = session.get(ErpPresupuesto, item['id'])
            if row is not None:
                row.ingres = item['monto_distribuido']

        session.commit()

        print(f'{project_name}: presupuesto={project_budget.importe}; filas={len(rows)}')
        print('  egresos_distribuidos=', sum(_as_decimal(r.egreso) for r in rows))
        print('  ingresos_distribuidos=', sum(_as_decimal(r.ingres) for r in rows))
