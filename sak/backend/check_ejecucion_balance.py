from app.db import engine
from app.models.proyecto import Proyecto
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.compras import PoOrder
from sqlmodel import select, Session
from decimal import Decimal

with Session(engine) as session:
    proyectos = session.exec(select(Proyecto).where(Proyecto.estado == "02-ejecucion")).all()

    print(f"{'ID':>4}  {'Nombre':<45}  {'Ingresos':>16}  {'Costo ejec':>16}  {'Diferencia':>16}  Balance")
    print("-" * 115)

    for p in sorted(proyectos, key=lambda x: x.id):
        # Ingresos = suma de presupuestos vinculados a la oportunidad
        importe_ejecutado = Decimal("0")
        if p.oportunidad_id:
            presupuestos = session.exec(
                select(CRMPresupuesto).where(CRMPresupuesto.oportunidad_id == p.oportunidad_id)
            ).all()
            importe_ejecutado = sum(b.importe or Decimal("0") for b in presupuestos)

        # Costo ejecutado = suma de órdenes de compra no eliminadas de la oportunidad
        costo_ejecutado = Decimal("0")
        if p.oportunidad_id:
            ordenes = session.exec(
                select(PoOrder).where(
                    PoOrder.oportunidad_id == p.oportunidad_id,
                    PoOrder.deleted_at.is_(None),
                )
            ).all()
            costo_ejecutado = sum(o.total or Decimal("0") for o in ordenes)

        diff = importe_ejecutado - costo_ejecutado
        balance = "DEFICIT" if diff < 0 else "OK"
        print(f"{p.id:>4}  {p.nombre:<45}  {float(importe_ejecutado):>16,.0f}  {float(costo_ejecutado):>16,.0f}  {float(diff):>16,.0f}  {balance}")
        print(f"       oportunidad_id={p.oportunidad_id}")
