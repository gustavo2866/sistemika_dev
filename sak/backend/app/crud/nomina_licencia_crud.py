from datetime import UTC, date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.models.nomina_licencia import NominaLicencia
from app.models.parte_diario_estado import ParteDiarioEstado


class NominaLicenciaCRUD(GenericCRUD[NominaLicencia]):
    def _apply_filters(self, stmt, filters: dict[str, Any]):
        filtros = dict(filters)
        vigente_desde = self._parse_date(filtros.pop("vigente_desde", None))
        vigente_hasta = self._parse_date(filtros.pop("vigente_hasta", None))
        stmt = super()._apply_filters(stmt, filtros)
        if vigente_desde is not None:
            stmt = stmt.where(
                or_(
                    NominaLicencia.fecha_hasta.is_(None),
                    NominaLicencia.fecha_hasta >= vigente_desde,
                )
            )
        if vigente_hasta is not None:
            stmt = stmt.where(NominaLicencia.fecha_desde <= vigente_hasta)
        return stmt

    def create(
        self,
        session: Session,
        data: dict[str, Any],
        auto_commit: bool = True,
    ) -> NominaLicencia:
        payload = dict(data)
        reemplazar_novedades = bool(payload.pop("_reemplazar_novedades", False))
        nomina_id, fecha_desde, fecha_hasta = self._validar(session, payload)
        from app.services.nomina_licencia_service import nomina_licencia_service

        validacion = nomina_licencia_service.validar_cobertura(
            session,
            nomina_id=nomina_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            tipo_novedad=str(payload.get("tipo_novedad") or ""),
            comentario=str(payload.get("comentario") or ""),
        )
        self._asegurar_cobertura_habilitada(validacion, reemplazar_novedades)
        try:
            licencia = super().create(session, payload, auto_commit=False)
            nomina_licencia_service.sincronizar_partes_diarios(
                session,
                licencia=licencia,
                cobertura_anterior=None,
                reemplazar_novedades=reemplazar_novedades,
            )
            if auto_commit:
                session.commit()
                session.refresh(licencia)
            return licencia
        except Exception:
            if auto_commit:
                session.rollback()
            raise

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
        auto_commit: bool = True,
    ) -> NominaLicencia | None:
        existing = self.get(session, obj_id)
        if existing is None:
            return None
        payload = dict(data)
        reemplazar_novedades = bool(payload.pop("_reemplazar_novedades", False))
        cobertura_anterior = (existing.fecha_desde, existing.fecha_hasta)
        nomina_anterior = int(existing.nomina_id)
        nomina_id, fecha_desde, fecha_hasta = self._validar(
            session, payload, existing=existing
        )
        from app.services.nomina_licencia_service import nomina_licencia_service

        validacion = nomina_licencia_service.validar_cobertura(
            session,
            nomina_id=nomina_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            tipo_novedad=str(
                payload.get("tipo_novedad", existing.tipo_novedad) or ""
            ),
            comentario=str(payload.get("comentario", existing.comentario) or ""),
            licencia_id=int(existing.id),
            cobertura_anterior=(
                cobertura_anterior if nomina_id == nomina_anterior else None
            ),
            fecha_desde_modificada=fecha_desde != cobertura_anterior[0],
            tipo_novedad_modificado=(
                str(payload.get("tipo_novedad") or "").strip().upper()
                != str(existing.tipo_novedad or "").strip().upper()
            ),
        )
        if nomina_id != nomina_anterior:
            validacion_anterior = nomina_licencia_service.validar_cobertura(
                session,
                nomina_id=nomina_anterior,
                fecha_desde=cobertura_anterior[0],
                fecha_hasta=cobertura_anterior[1],
                tipo_novedad=existing.tipo_novedad,
                comentario=existing.comentario,
                licencia_id=int(existing.id),
                cobertura_anterior=cobertura_anterior,
                eliminar=True,
            )
            if validacion_anterior.bloqueada:
                validacion = validacion_anterior
        self._asegurar_cobertura_habilitada(validacion, reemplazar_novedades)
        try:
            licencia = super().update(
                session,
                obj_id,
                payload,
                check_version=check_version,
                auto_commit=False,
            )
            if licencia is None:
                return None
            nomina_licencia_service.sincronizar_partes_diarios(
                session,
                licencia=licencia,
                cobertura_anterior=cobertura_anterior,
                reemplazar_novedades=reemplazar_novedades,
            )
            if auto_commit:
                session.commit()
                session.refresh(licencia)
            return licencia
        except Exception:
            if auto_commit:
                session.rollback()
            raise

    def delete(self, session: Session, obj_id: Any, hard: bool = False) -> bool:
        licencia = self.get(session, obj_id)
        if licencia is None:
            return False
        from app.services.nomina_licencia_service import nomina_licencia_service

        cobertura_anterior = (licencia.fecha_desde, licencia.fecha_hasta)
        validacion = nomina_licencia_service.validar_cobertura(
            session,
            nomina_id=int(licencia.nomina_id),
            fecha_desde=licencia.fecha_desde,
            fecha_hasta=licencia.fecha_hasta,
            tipo_novedad=licencia.tipo_novedad,
            comentario=licencia.comentario,
            licencia_id=int(licencia.id),
            cobertura_anterior=cobertura_anterior,
            eliminar=True,
        )
        if validacion.bloqueada:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar la licencia porque afecta tarjas cerradas",
            )
        try:
            nomina_licencia_service.sincronizar_partes_diarios(
                session,
                licencia=licencia,
                cobertura_anterior=cobertura_anterior,
                eliminar=True,
            )
            if hard:
                session.delete(licencia)
            else:
                ahora = datetime.now(UTC)
                licencia.deleted_at = ahora
                licencia.updated_at = ahora
                session.add(licencia)
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise

    def validar_guardado(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        obj_id: int | None = None,
    ):
        payload = dict(data)
        existing = self.get(session, obj_id) if obj_id is not None else None
        if obj_id is not None and existing is None:
            raise ValueError("Licencia de nomina no encontrada")
        nomina_id, fecha_desde, fecha_hasta = self._validar(
            session,
            payload,
            existing=existing,
        )
        from app.services.nomina_licencia_service import nomina_licencia_service

        anterior = (
            (existing.fecha_desde, existing.fecha_hasta)
            if existing is not None and int(existing.nomina_id) == nomina_id
            else None
        )
        validacion = nomina_licencia_service.validar_cobertura(
            session,
            nomina_id=nomina_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            tipo_novedad=str(
                payload.get(
                    "tipo_novedad",
                    existing.tipo_novedad if existing is not None else "",
                )
                or ""
            ),
            comentario=str(
                payload.get(
                    "comentario",
                    existing.comentario if existing is not None else "",
                )
                or ""
            ),
            licencia_id=int(existing.id) if existing is not None else None,
            cobertura_anterior=anterior,
            fecha_desde_modificada=bool(
                existing is not None and fecha_desde != existing.fecha_desde
            ),
            tipo_novedad_modificado=bool(
                existing is not None
                and str(payload.get("tipo_novedad") or "").strip().upper()
                != str(existing.tipo_novedad or "").strip().upper()
            ),
        )
        if existing is not None and int(existing.nomina_id) != nomina_id:
            validacion_anterior = nomina_licencia_service.validar_cobertura(
                session,
                nomina_id=int(existing.nomina_id),
                fecha_desde=existing.fecha_desde,
                fecha_hasta=existing.fecha_hasta,
                tipo_novedad=existing.tipo_novedad,
                comentario=existing.comentario,
                licencia_id=int(existing.id),
                cobertura_anterior=(existing.fecha_desde, existing.fecha_hasta),
                eliminar=True,
            )
            if validacion_anterior.bloqueada:
                return validacion_anterior
        return validacion

    def validar_eliminacion(self, session: Session, obj_id: int):
        licencia = self.get(session, obj_id)
        if licencia is None:
            raise ValueError("Licencia de nomina no encontrada")
        from app.services.nomina_licencia_service import nomina_licencia_service

        cobertura_anterior = (licencia.fecha_desde, licencia.fecha_hasta)
        return nomina_licencia_service.validar_cobertura(
            session,
            nomina_id=int(licencia.nomina_id),
            fecha_desde=licencia.fecha_desde,
            fecha_hasta=licencia.fecha_hasta,
            tipo_novedad=licencia.tipo_novedad,
            comentario=licencia.comentario,
            licencia_id=int(licencia.id),
            cobertura_anterior=cobertura_anterior,
            eliminar=True,
        )

    @staticmethod
    def _asegurar_cobertura_habilitada(validacion, reemplazar_novedades: bool) -> None:
        if validacion.bloqueada:
            raise ValueError("La licencia afecta una o mas tarjas cerradas")
        if validacion.novedades_conflictivas and not reemplazar_novedades:
            fechas = ", ".join(
                sorted({item.fecha.strftime("%d/%m/%Y") for item in validacion.novedades_conflictivas})
            )
            raise ValueError(
                f"Existen novedades en partes abiertos para: {fechas}. "
                "Confirme su reemplazo para continuar"
            )

    def _validar(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        existing: NominaLicencia | None = None,
    ) -> tuple[int, date, date | None]:
        nomina_id = self._optional_int(
            data.get("nomina_id", existing.nomina_id if existing is not None else None)
        )
        codigo = str(
            data.get("tipo_novedad", existing.tipo_novedad if existing is not None else "")
            or ""
        ).strip().upper()
        fecha_desde = self._parse_date(
            data.get("fecha_desde", existing.fecha_desde if existing is not None else None)
        )
        fecha_hasta = self._parse_date(
            data.get("fecha_hasta", existing.fecha_hasta if existing is not None else None)
        )
        if nomina_id is None or fecha_desde is None:
            raise ValueError("Empleado y fecha desde son obligatorios")
        if fecha_hasta is not None and fecha_hasta < fecha_desde:
            raise ValueError("La fecha hasta no puede ser anterior a la fecha desde")

        estado = session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.abreviatura == codigo)
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.licencia.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
        ).first()
        if estado is None:
            raise ValueError("El tipo de licencia debe ser un estado activo marcado como licencia")

        otras = session.exec(
            select(NominaLicencia)
            .where(NominaLicencia.nomina_id == nomina_id)
            .where(NominaLicencia.deleted_at.is_(None))
        ).all()
        for otra in otras:
            if existing is not None and otra.id == existing.id:
                continue
            if self._se_superponen(
                fecha_desde,
                fecha_hasta,
                otra.fecha_desde,
                otra.fecha_hasta,
            ):
                raise ValueError(
                    "El empleado ya tiene una licencia que se superpone con el periodo indicado"
                )

        data["tipo_novedad"] = codigo
        return nomina_id, fecha_desde, fecha_hasta

    @staticmethod
    def _se_superponen(
        desde_a: date,
        hasta_a: date | None,
        desde_b: date,
        hasta_b: date | None,
    ) -> bool:
        return (hasta_a is None or desde_b <= hasta_a) and (
            hasta_b is None or desde_a <= hasta_b
        )

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if value in (None, ""):
            return None
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        try:
            return int(value) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None


nomina_licencia_crud = NominaLicenciaCRUD(NominaLicencia)
