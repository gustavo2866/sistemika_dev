from datetime import date
from typing import Any, Dict

from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.models import Propiedad, Vacancia
class PropiedadCRUD(GenericCRUD[Propiedad]):
    """CRUD de Propiedad con creación automática de vacancia."""

    def create(self, session: Session, data: Dict[str, Any], auto_commit: bool = True) -> Propiedad:  # type: ignore[override]
        obj = super().create(session, data, auto_commit=False)

        fecha_base = obj.estado_fecha or date.today()

        vacancia_payload: Dict[str, Any] = {
            "propiedad_id": obj.id,
            "ciclo_activo": True,
            "fecha_recibida": fecha_base,
        }

        session.add(Vacancia(**vacancia_payload))

        if auto_commit:
            session.commit()
            session.refresh(obj)
        else:
            session.flush()

        return obj


propiedad_crud = PropiedadCRUD(Propiedad)
