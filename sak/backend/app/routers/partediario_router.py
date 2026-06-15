from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.partediario import ParteDiario, ParteDiarioDetalle
from fastapi import Depends, Query
from sqlmodel import Session, select

# Define NestedCRUD for ParteDiario with its nested detalles

parte_diario_crud = NestedCRUD(
    ParteDiario,
    nested_relations={
        "detalles": {
            "model": ParteDiarioDetalle,
            "fk_field": "parte_diario_id",
            "allow_delete": True,
        }
    },
)

parte_diario_router = create_generic_router(
    model=ParteDiario,
    crud=parte_diario_crud,
    prefix="/parte-diario",
    tags=["parte-diario"],
)


@parte_diario_router.get("/detalles-nomina")
def get_detalles_nomina_proyecto(
    idproyecto: int = Query(..., gt=0),
    session: Session = Depends(get_session),
):
    empleados = session.exec(
        select(Nomina)
        .where(
            Nomina.idproyecto == idproyecto,
            Nomina.activo.is_(True),
            Nomina.deleted_at.is_(None),
        )
        .order_by(Nomina.apellido, Nomina.nombre)
    ).all()

    return {
        "data": [
            {
                "idnomina": empleado.id,
                "nombre_provisorio": None,
                "horas": 8,
                "idestado": None,
                "ingreso": None,
                "egreso": None,
                "descripcion": None,
                "nomina": {
                    "id": empleado.id,
                    "nombre": empleado.nombre,
                    "apellido": empleado.apellido,
                    "dni": empleado.dni,
                },
            }
            for empleado in empleados
        ],
        "total": len(empleados),
    }
