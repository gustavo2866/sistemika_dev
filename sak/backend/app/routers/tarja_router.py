from datetime import date

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.base import filtrar_respuesta
from app.models.tarja import Tarja, TarjaDetalle, TarjaNovedad
from app.services.parte_diario_tarja_service import parte_diario_tarja_service


class GenerarTarjaRequest(BaseModel):
    idproyecto: int = Field(..., gt=0)
    fechainicio: date
    fechafinal: date
    contacto_id: int | None = Field(default=None, gt=0)

tarja_crud = NestedCRUD(
    Tarja,
    nested_relations={
        "detalles": {
            "model": TarjaDetalle,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
        "novedades": {
            "model": TarjaNovedad,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
    },
)

tarja_router = create_generic_router(
    model=Tarja,
    crud=tarja_crud,
    prefix="/tarjas",
    tags=["tarjas"],
)


@tarja_router.post("/generar")
def generar_tarja(
    payload: GenerarTarjaRequest,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.generar_tarja_desde_panel(
            session,
            idproyecto=payload.idproyecto,
            fechainicio=payload.fechainicio,
            fechafinal=payload.fechafinal,
            contacto_id=payload.contacto_id,
        )
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
