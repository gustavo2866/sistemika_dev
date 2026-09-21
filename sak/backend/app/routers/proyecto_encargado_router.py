from sqlalchemy import or_

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.crm.contacto import CRMContacto
from app.models.proyecto import Proyecto
from app.models.proyecto_encargado import ProyectoEncargado


class ProyectoEncargadoCRUD(GenericCRUD[ProyectoEncargado]):
    def _apply_filters(self, stmt, filters):
        filters = dict(filters)
        proyecto_estado = filters.pop("proyecto_estado", None)
        stmt = super()._apply_filters(stmt, filters)
        if proyecto_estado:
            stmt = stmt.where(
                ProyectoEncargado.proyecto.has(Proyecto.estado == proyecto_estado)
            )
        return stmt

    def _apply_text_search(self, stmt, search_text: str):
        term = f"%{search_text.strip()}%"
        return (
            stmt.join(Proyecto, Proyecto.id == ProyectoEncargado.proyecto_id)
            .join(CRMContacto, CRMContacto.id == ProyectoEncargado.contacto_id)
            .where(
                or_(
                    Proyecto.nombre.ilike(term),
                    CRMContacto.nombre_completo.ilike(term),
                )
            )
        )


proyecto_encargado_crud = ProyectoEncargadoCRUD(ProyectoEncargado)

proyecto_encargado_router = create_generic_router(
    model=ProyectoEncargado,
    crud=proyecto_encargado_crud,
    prefix="/proyecto-encargados",
    tags=["proyecto-encargados"],
)
