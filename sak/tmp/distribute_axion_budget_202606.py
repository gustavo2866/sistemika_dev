from __future__ import annotations

from decimal import Decimal
from datetime import date
from pathlib import Path
from typing import Any

from sqlmodel import Session, select
from sqlalchemy import extract

from app.db import engine
from app.models.constructora.proyectos_conceptos import ProyectosConceptos
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto import Proyecto

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ID = 18
PERIOD = date(2026, 6, 1)
CONCEPT_NAME_TO_COLUMN = {
    "mo_propia": "mo_propia",
    "mo_terceros": "mo_terceros",
    "materiales": "materiales",
    "herramientas": "herramientas",
}


def _as_decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0))


def _round_money(amount: Decimal) -> Decimal:
    return amount.quantize(Decimal("0.01"))


def build_concept_montos(project_budget: ProyPresupuesto | None) -> dict[str, Decimal]:
    if project_budget is None:
        return {}

    concept_montos = {
        name: _as_decimal(getattr(project_budget, column))
        for name, column in CONCEPT_NAME_TO_COLUMN.items()
    }

    known_total = sum(concept_montos.values(), Decimal("0"))
    importe = _as_decimal(project_budget.importe)
    if importe > known_total:
        concept_montos["varios"] = _round_money(importe - known_total)
    return concept_montos


def main() -> None:
    with Session(engine) as session:
        proyecto = session.get(Proyecto, PROJECT_ID)
        print(f"Proyecto: {proyecto.nombre if proyecto else 'N/A'}")

        project_budget = session.exec(
            select(ProyPresupuesto)
            .where(ProyPresupuesto.deleted_at.is_(None))
            .where(ProyPresupuesto.proyecto_id == PROJECT_ID)
            .where(ProyPresupuesto.fecha == PERIOD)
        ).first()

        if project_budget is None:
            raise RuntimeError(f"No existe ProyPresupuesto para proyecto {PROJECT_ID} en {PERIOD}")

        concept_montos = build_concept_montos(project_budget)
        print("Montos por concepto:")
        for concept, amount in concept_montos.items():
            print(f" - {concept}: {amount}")

        # Obtener filas ERP del periodo y proyecto
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
            .where(extract("year", ErpPresupuesto.fecha) == PERIOD.year)
            .where(extract("month", ErpPresupuesto.fecha) == PERIOD.month)
            .order_by(ErpPresupuesto.id)
        ).all()

        print(f"Filas ERP encontradas: {len(rows)}")

        concept_rows: dict[str, list[dict[str, Any]]] = {key: [] for key in concept_montos}
        for row in rows:
            concepto_id = row.proyectos_concepto_id
            concepto_name = None
            if concepto_id is not None:
                concepto_obj = session.get(ProyectosConceptos, int(concepto_id))
                if concepto_obj is not None:
                    concepto_name = concepto_obj.nombre.lower()
            if concepto_name is None:
                concepto_name = "varios"
            if concepto_name in concept_rows:
                concept_rows[concepto_name].append(
                    {
                        "id": row.id,
                        "erp_cuenta_id": row.erp_cuenta_id,
                        "real_egreso": _as_decimal(row.real_egreso),
                        "current_egreso": _as_decimal(row.egreso),
                    }
                )
            elif concepto_name == "varios":
                concept_rows.setdefault("varios", []).append(
                    {
                        "id": row.id,
                        "erp_cuenta_id": row.erp_cuenta_id,
                        "real_egreso": _as_decimal(row.real_egreso),
                        "current_egreso": _as_decimal(row.egreso),
                    }
                )

        updated = []
        for concept, amount in concept_montos.items():
            if amount <= 0:
                continue
            target_rows = concept_rows.get(concept, [])
            if not target_rows:
                print(f"Sin filas ERP para {concept}; se omite")
                continue

            total_weight = sum(item["real_egreso"] for item in target_rows)
            if total_weight <= 0:
                print(f"Peso cero para {concept}; se omite")
                continue

            remaining = amount
            for index, item in enumerate(target_rows):
                weight = item["real_egreso"]
                share = (amount * weight / total_weight).quantize(Decimal("0.01"))
                if index == len(target_rows) - 1:
                    share = remaining
                remaining -= share
                if share < 0:
                    share = Decimal("0")
                presupuesto_obj = session.get(ErpPresupuesto, item["id"])
                if presupuesto_obj is not None:
                    presupuesto_obj.egreso = share
                    updated.append((presupuesto_obj.id, concept, item["current_egreso"], share))

        session.commit()

        print("\nActualizaciones aplicadas:")
        for row_id, concept, old_value, new_value in updated:
            print(f" - {row_id} [{concept}] {old_value} -> {new_value}")

        print(f"\nTotal filas actualizadas: {len(updated)}")


if __name__ == "__main__":
    main()
