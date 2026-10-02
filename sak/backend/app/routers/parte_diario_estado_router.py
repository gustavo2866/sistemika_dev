from typing import Any

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.tarja import Tarja, TarjaDetalle
from app.services.parte_diario_tarja_service import parte_diario_tarja_service
from sqlmodel import Session, select


class ParteDiarioEstadoCRUD(GenericCRUD[ParteDiarioEstado]):
    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
    ) -> ParteDiarioEstado | None:
        updated = super().update(session, obj_id, data, check_version=check_version)
        if updated is None or "justifica" not in data:
            return updated

        affected = session.exec(
            select(TarjaDetalle.idnomina, Tarja.fechainicio, Tarja.fechafinal)
            .join(Tarja, Tarja.id == TarjaDetalle.tarja_id)
            .where(TarjaDetalle.idestado == updated.id)
            .where(TarjaDetalle.idnomina.is_not(None))
            .where(TarjaDetalle.deleted_at.is_(None))
            .where(Tarja.deleted_at.is_(None))
        ).all()
        by_range: dict[tuple, set[int]] = {}
        for nomina_id, fechainicio, fechafinal in affected:
            if nomina_id is not None:
                by_range.setdefault((fechainicio, fechafinal), set()).add(int(nomina_id))
        for (fechainicio, fechafinal), nomina_ids in by_range.items():
            parte_diario_tarja_service.recalcular_resumen_nomina(
                session,
                nomina_ids=nomina_ids,
                fechainicio=fechainicio,
                fechafinal=fechafinal,
            )
        if affected:
            session.commit()
            session.refresh(updated)
        return updated


parte_diario_estado_crud = ParteDiarioEstadoCRUD(ParteDiarioEstado)

parte_diario_estado_router = create_generic_router(
    model=ParteDiarioEstado,
    crud=parte_diario_estado_crud,
    prefix="/parte-diario-estados",
    tags=["parte-diario-estados"],
)
