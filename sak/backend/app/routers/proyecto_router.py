from datetime import UTC, datetime
from typing import Any, Dict, Optional

from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.crm.contacto import CRMContacto
from app.models.crm.oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad
from app.models.proyecto import Proyecto
from app.models.proyecto_avance import ProyectoAvance


class ProyectoCRUD(NestedCRUD):
    """CRUD de Proyecto con creacion y sincronizacion de oportunidad CRM."""

    def _pop_encargado_contacto_id(self, data: Dict[str, Any]) -> tuple[bool, Optional[int]]:
        if "encargado_contacto_id" not in data:
            return False, None

        raw_value = data.pop("encargado_contacto_id")
        if raw_value in (None, ""):
            return True, None

        try:
            contacto_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError("encargado_contacto_id es invalido") from exc

        if contacto_id <= 0:
            raise ValueError("encargado_contacto_id es invalido")

        return True, contacto_id

    def _get_encargado_contacto(self, session: Session, contacto_id: int) -> CRMContacto:
        contacto = session.get(CRMContacto, contacto_id)
        if contacto is None or getattr(contacto, "deleted_at", None) is not None:
            raise ValueError(f"Contacto encargado {contacto_id} no encontrado")
        return contacto

    def _sync_oportunidad_encargado(
        self,
        session: Session,
        proyecto: Proyecto,
        contacto_id: Optional[int],
    ) -> None:
        if contacto_id is None:
            return
        if not proyecto.oportunidad_id:
            raise ValueError("El proyecto no tiene oportunidad asociada para sincronizar encargado")

        contacto = self._get_encargado_contacto(session, contacto_id)
        oportunidad = session.get(CRMOportunidad, proyecto.oportunidad_id)
        if oportunidad is None or getattr(oportunidad, "deleted_at", None) is not None:
            raise ValueError(f"Oportunidad {proyecto.oportunidad_id} no encontrada")

        oportunidad.contacto_id = contacto.id
        session.add(oportunidad)
        proyecto.oportunidad = oportunidad

    def create(self, session: Session, data: Dict):
        data_copy = dict(data)
        _, encargado_contacto_id = self._pop_encargado_contacto_id(data_copy)
        nested_payloads = self._extract_nested_payloads(data_copy)

        try:
            proyecto = GenericCRUD.create(self, session, data_copy, auto_commit=False)

            if encargado_contacto_id:
                contacto = self._get_encargado_contacto(session, encargado_contacto_id)
            else:
                contacto = CRMContacto(
                    nombre_completo=f"proyecto: {proyecto.nombre}",
                    responsable_id=proyecto.responsable_id,
                    notas=f"Contacto creado automaticamente para proyecto: {proyecto.nombre}",
                )
                session.add(contacto)
                session.flush()

            oportunidad = CRMOportunidad(
                titulo=proyecto.nombre,
                contacto_id=contacto.id,
                tipo_operacion_id=4,
                responsable_id=proyecto.responsable_id,
                estado=EstadoOportunidad.PROSPECT.value,
                activo=True,
                fecha_estado=datetime.now(UTC),
                descripcion=f"Oportunidad creada automaticamente para proyecto: {proyecto.nombre}",
            )
            session.add(oportunidad)
            session.flush()

            proyecto.oportunidad_id = oportunidad.id
            proyecto.oportunidad = oportunidad
            session.add(proyecto)

            if nested_payloads:
                self._sync_nested_relations(session, proyecto, nested_payloads, is_create=True)

            session.commit()
            session.refresh(proyecto)
            return proyecto
        except Exception:
            session.rollback()
            raise

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
    ):
        data_copy = dict(data)
        encargado_present, encargado_contacto_id = self._pop_encargado_contacto_id(data_copy)
        nested_payloads = self._extract_nested_payloads(data_copy)

        try:
            proyecto = GenericCRUD.update(
                self,
                session,
                obj_id,
                data_copy,
                check_version=check_version,
                auto_commit=False,
            )

            if proyecto and nested_payloads:
                self._sync_nested_relations(session, proyecto, nested_payloads, is_create=False)

            if proyecto and encargado_present:
                self._sync_oportunidad_encargado(session, proyecto, encargado_contacto_id)

            session.commit()
            session.refresh(proyecto)
            return proyecto
        except Exception:
            session.rollback()
            raise


proyecto_crud = ProyectoCRUD(
    Proyecto,
    nested_relations={
        "avances": {
            "model": ProyectoAvance,
            "fk_field": "proyecto_id",
            "allow_delete": True,
        }
    },
)

proyecto_router = create_generic_router(
    model=Proyecto,
    crud=proyecto_crud,
    prefix="/proyectos",
    tags=["proyectos"],
)
