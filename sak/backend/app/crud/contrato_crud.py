from datetime import UTC, datetime
from typing import Any, Dict, Optional

from sqlmodel import Session

from app.core.nested_crud import NestedCRUD
from app.models.contrato import Contrato
from app.models.contrato_archivo import ContratoArchivo
from app.models.propiedad import Propiedad


class ContratoCRUD(NestedCRUD):
    def _sync_propiedad_from_vigente(self, session: Session, contrato: Contrato) -> None:
        if contrato.estado != "vigente":
            return

        propiedad = session.get(Propiedad, contrato.propiedad_id)
        if not propiedad:
            return

        propiedad.valor_alquiler = contrato.valor_alquiler
        propiedad.expensas = contrato.expensas
        propiedad.fecha_inicio_contrato = contrato.fecha_inicio
        propiedad.vencimiento_contrato = contrato.fecha_vencimiento
        propiedad.fecha_renovacion = contrato.fecha_renovacion
        propiedad.tipo_actualizacion_id = contrato.tipo_actualizacion_id
        propiedad.vacancia_activa = False
        propiedad.vacancia_fecha = None
        propiedad.updated_at = datetime.now(UTC)
        session.add(propiedad)

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
    ) -> Optional[Contrato]:
        obj = super().update(session, obj_id, data, check_version=check_version)
        if not obj:
            return None

        self._sync_propiedad_from_vigente(session, obj)
        session.commit()
        session.refresh(obj)
        return obj


contrato_crud = ContratoCRUD(
    Contrato,
    nested_relations={
        "archivos": {
            "model": ContratoArchivo,
            "fk_field": "contrato_id",
            "allow_delete": True,
        }
    },
)
