from datetime import UTC, date, datetime
from typing import Any, Dict, Optional

from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.models import Propiedad
from app.models.propiedad import PropiedadesLogStatus, PropiedadesStatus
from app.models.propietario import Propietario


class PropiedadCRUD(GenericCRUD[Propiedad]):
    """CRUD de Propiedad con reglas de vacancia y log de estado."""

    def _sync_propietario_legacy_field(
        self,
        session: Session,
        payload: Dict[str, Any],
        current: Optional[Propiedad] = None,
    ) -> None:
        propietario = payload.get("propietario")
        if isinstance(propietario, str):
            propietario = propietario.strip()
            if propietario:
                payload["propietario"] = propietario
                return

        propietario_id = payload.get("propietario_id")
        if propietario_id:
            propietario_ref = session.get(Propietario, propietario_id)
            propietario_nombre = getattr(propietario_ref, "nombre", None)
            if isinstance(propietario_nombre, str) and propietario_nombre.strip():
                payload["propietario"] = propietario_nombre.strip()
                return

        if current and isinstance(current.propietario, str) and current.propietario.strip():
            payload["propietario"] = current.propietario.strip()

    def _get_status_by_id(
        self, session: Session, status_id: Optional[int]
    ) -> Optional[PropiedadesStatus]:
        if not status_id:
            return None
        return session.get(PropiedadesStatus, status_id)

    def _get_initial_status(self, session: Session) -> Optional[PropiedadesStatus]:
        stmt = (
            select(PropiedadesStatus)
            .where(PropiedadesStatus.es_inicial == True)  # noqa: E712
            .order_by(PropiedadesStatus.orden.asc())
        )
        status = session.exec(stmt).first()
        if status:
            return status
        return session.exec(
            select(PropiedadesStatus).where(PropiedadesStatus.orden == 1)
        ).first()

    def _coerce_fecha_cambio(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, date):
            return datetime(value.year, value.month, value.day, tzinfo=UTC)
        if isinstance(value, str):
            s = value.strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            try:
                parsed = datetime.fromisoformat(s)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except Exception:
                try:
                    d = date.fromisoformat(s.split("T")[0])
                    return datetime(d.year, d.month, d.day, tzinfo=UTC)
                except Exception:
                    return datetime.now(UTC)
        return datetime.now(UTC)

    def create(
        self, session: Session, data: Dict[str, Any], auto_commit: bool = True
    ) -> Propiedad:
        payload = dict(data)
        payload.pop("vacancia_activa", None)
        payload.pop("vacancia_fecha", None)
        self._sync_propietario_legacy_field(session, payload)

        status_id = payload.get("propiedad_status_id")
        status = self._get_status_by_id(session, status_id)
        if status is None:
            status = self._get_initial_status(session)
            if status:
                payload["propiedad_status_id"] = status.id

        if not payload.get("estado_fecha"):
            payload["estado_fecha"] = date.today()

        fecha_estado = payload.get("estado_fecha")
        if status and status.orden == 1:
            payload["vacancia_activa"] = True
            payload["vacancia_fecha"] = fecha_estado

        return super().create(session, payload, auto_commit=auto_commit)

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
        auto_commit: bool = True,
    ) -> Optional[Propiedad]:
        payload = dict(data)
        usuario_id = payload.pop("usuario_id", None)
        payload.pop("vacancia_activa", None)
        payload.pop("vacancia_fecha", None)

        previous = self.get(session, obj_id)
        if not previous:
            return None

        self._sync_propietario_legacy_field(session, payload, current=previous)

        prev_status_id = previous.propiedad_status_id
        next_status_id = payload.get("propiedad_status_id", prev_status_id)
        status_changed = (
            "propiedad_status_id" in payload and next_status_id != prev_status_id
        )

        if status_changed and not payload.get("estado_fecha"):
            payload["estado_fecha"] = date.today()

        obj = super().update(
            session,
            obj_id,
            payload,
            check_version=check_version,
            auto_commit=False,
        )
        if not obj:
            return None

        if status_changed and next_status_id:
            estado_nuevo = self._get_status_by_id(session, next_status_id)
            estado_anterior = self._get_status_by_id(session, prev_status_id)
            fecha_cambio = obj.estado_fecha or date.today()

            if estado_nuevo and estado_nuevo.orden == 1:
                obj.vacancia_activa = True
                obj.vacancia_fecha = fecha_cambio
            elif estado_nuevo and estado_nuevo.orden == 4:
                obj.vacancia_activa = False
                obj.vacancia_fecha = None

            motivo = (obj.estado_comentario or "").strip() or None
            motivo_corto = motivo[:200] if motivo else None

            log = PropiedadesLogStatus(
                propiedad_id=obj.id,
                estado_anterior_id=prev_status_id,
                estado_nuevo_id=next_status_id,
                estado_anterior=estado_anterior.nombre if estado_anterior else None,
                estado_nuevo=estado_nuevo.nombre
                if estado_nuevo
                else f"Estado #{next_status_id}",
                fecha_cambio=self._coerce_fecha_cambio(fecha_cambio),
                usuario_id=usuario_id or 1,
                motivo=motivo_corto,
                observaciones=motivo,
            )
            session.add(log)

        if auto_commit:
            session.commit()
            session.refresh(obj)

        return obj


propiedad_crud = PropiedadCRUD(Propiedad)
