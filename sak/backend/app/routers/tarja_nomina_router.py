from datetime import UTC, date, datetime, timedelta
from typing import Any, Sequence

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import ParteDiarioDetalle
from app.models.proyecto import Proyecto
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina
from app.models.crm.contacto import CRMContacto
from sqlalchemy import String, and_, cast, func, or_
from sqlmodel import Session, select


class TarjaNominaTrasladoRequest(BaseModel):
    proyecto_id: int = Field(..., gt=0)
    proyecto_encargado_id: int = Field(..., gt=0)
    fecha: date


class TarjaNominaCRUD(GenericCRUD[TarjaNomina]):
    ALTA_ESTADO_CODIGO = "ALT"

    @staticmethod
    def _is_truthy_filter(value: Any) -> bool:
        return str(value or "").strip().lower() in {"1", "true", "si", "sí"}

    @staticmethod
    def _empty_days(start_date) -> dict[str, dict[str, Any]]:
        return {
            f"D{day:02d}": {
                "detalle_id": None,
                "fecha": (start_date + timedelta(days=day - 1)).isoformat(),
                "horas": None,
                "idestado": None,
                "estado": None,
                "estado_nombre": None,
                "descripcion": None,
            }
            for day in range(1, 16)
        }

    @staticmethod
    def _row_values(row, start: int = 0) -> dict[str, Any]:
        def code_or_description(code, description):
            value = code or description
            return str(value).strip() if value else None

        return {
            "empleado": ", ".join(
                value for value in [row[start + 1], row[start]] if value
            )
            or None,
            "dni": row[start + 2],
            "categoria_codigo": code_or_description(
                row[start + 3], row[start + 4]
            ),
            "actividad_codigo": code_or_description(
                row[start + 5], row[start + 6]
            ),
            "obra": row[start + 7],
            "encargado": row[start + 8],
            "tarja_fecha_desde": (
                row[start + 9].isoformat() if row[start + 9] else None
            ),
            "tarja_fecha_hasta": (
                row[start + 10].isoformat() if row[start + 10] else None
            ),
            "proyecto_id": row[start + 11],
            "encargado_id": row[start + 12],
        }

    @staticmethod
    def _apply_extended_joins(stmt):
        return (
            stmt.select_from(TarjaNomina)
            .outerjoin(Nomina, TarjaNomina.nomina_id == Nomina.id)
            .outerjoin(
                NominaCategoria,
                TarjaNomina.nomina_categoria_id == NominaCategoria.id,
            )
            .outerjoin(
                NominaTarea,
                TarjaNomina.nomina_tarea_id == NominaTarea.id,
            )
            .join(Tarja, TarjaNomina.tarja_id == Tarja.id)
            .outerjoin(Proyecto, Tarja.idproyecto == Proyecto.id)
            .outerjoin(CRMContacto, Tarja.contacto_id == CRMContacto.id)
        )

    @staticmethod
    def _set_calculated(obj: TarjaNomina, values: dict[str, Any]) -> None:
        for field, value in values.items():
            try:
                setattr(obj, field, value)
            except Exception:
                object.__setattr__(obj, field, value)

    def _populate_calculated(
        self,
        session: Session,
        objs: Sequence[TarjaNomina],
    ) -> None:
        if not objs:
            return

        ids = [obj.id for obj in objs if obj.id is not None]
        if not ids:
            return

        stmt = self._apply_extended_joins(
            select(
                TarjaNomina.id,
                Nomina.nombre,
                Nomina.apellido,
                Nomina.dni,
                NominaCategoria.codigo,
                NominaCategoria.descripcion,
                NominaTarea.codigo,
                NominaTarea.descripcion,
                Proyecto.nombre,
                CRMContacto.nombre_completo,
                Tarja.fechainicio,
                Tarja.fechafinal,
                Tarja.idproyecto,
                Tarja.contacto_id,
            )
        ).where(TarjaNomina.id.in_(ids))
        rows = session.exec(stmt).all()
        extended_by_id = {row[0]: self._row_values(row, 1) for row in rows}

        for obj in objs:
            values = extended_by_id.get(obj.id)
            if not values:
                continue
            self._set_calculated(obj, values)
        self._populate_evento_no_editable(session, objs)

    def _populate_evento_no_editable(
        self,
        session: Session,
        objs: Sequence[TarjaNomina],
    ) -> None:
        ids = [int(obj.id) for obj in objs if obj.id is not None]
        if not ids:
            return

        rows = session.exec(
            select(ParteDiarioDetalle.descripcion, ParteDiarioEstado.abreviatura)
            .select_from(ParteDiarioDetalle)
            .join(ParteDiarioEstado, ParteDiarioEstado.id == ParteDiarioDetalle.idestado)
            .where(ParteDiarioEstado.activo.is_(False))
            .where(ParteDiarioEstado.deleted_at.is_(None))
            .where(ParteDiarioDetalle.descripcion.in_([str(item_id) for item_id in ids]))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        tipo_by_id = {}
        for descripcion, abreviatura in rows:
            normalized_id = str(descripcion or "").strip()
            if normalized_id.isdigit():
                tipo_by_id[int(normalized_id)] = str(abreviatura or "").strip().upper()
        for obj in objs:
            tipo_novedad = tipo_by_id.get(int(obj.id)) if obj.id is not None else None
            self._set_calculated(
                obj,
                {
                    "tipo_novedad": tipo_novedad,
                    "editable": tipo_novedad is None,
                },
            )

    def list(
        self,
        session: Session,
        *,
        page: int = 1,
        per_page: int = 25,
        sort_by: str = "created_at",
        sort_dir: str = "asc",
        filters: dict[str, Any] | None = None,
        deleted: str = "exclude",
        fields: str | None = None,
        include: str | None = None,
    ) -> tuple[Sequence[TarjaNomina], int]:
        page_stmt = self._apply_extended_joins(
            select(
                TarjaNomina.id.label("tarja_nomina_id"),
                func.count().over().label("_total"),
            )
        )
        if filters:
            page_stmt = self._apply_filters(page_stmt, filters)
        page_stmt = self._apply_soft_delete_filter(page_stmt, deleted)

        order_column = (
            getattr(TarjaNomina, sort_by)
            if hasattr(TarjaNomina, sort_by)
            else TarjaNomina.created_at
        )
        order_expression = (
            order_column.desc() if sort_dir.lower() == "desc" else order_column.asc()
        )
        offset = (page - 1) * per_page
        page_query = page_stmt.order_by(order_expression).offset(offset).limit(per_page)
        page_rows = page_query.cte("tarja_nomina_page")
        tipo_novedad_subquery = (
            select(ParteDiarioEstado.abreviatura)
            .select_from(ParteDiarioDetalle)
            .join(ParteDiarioEstado, ParteDiarioEstado.id == ParteDiarioDetalle.idestado)
            .where(ParteDiarioEstado.activo.is_(False))
            .where(ParteDiarioEstado.deleted_at.is_(None))
            .where(ParteDiarioDetalle.descripcion == cast(TarjaNomina.id, String))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
            .limit(1)
            .scalar_subquery()
        )

        stmt = self._apply_extended_joins(
            select(
                TarjaNomina,
                Nomina.nombre,
                Nomina.apellido,
                Nomina.dni,
                NominaCategoria.codigo,
                NominaCategoria.descripcion,
                NominaTarea.codigo,
                NominaTarea.descripcion,
                Proyecto.nombre,
                CRMContacto.nombre_completo,
                Tarja.fechainicio,
                Tarja.fechafinal,
                Tarja.idproyecto,
                Tarja.contacto_id,
                page_rows.c._total,
                TarjaDetalle.id,
                TarjaDetalle.fecha,
                TarjaDetalle.horas,
                TarjaDetalle.idestado,
                ParteDiarioEstado.abreviatura,
                ParteDiarioEstado.nombre,
                TarjaDetalle.descripcion,
                tipo_novedad_subquery.label("tipo_novedad"),
            )
        ).join(
            page_rows,
            page_rows.c.tarja_nomina_id == TarjaNomina.id,
        ).outerjoin(
            TarjaDetalle,
            and_(
                TarjaDetalle.tarja_id == TarjaNomina.tarja_id,
                TarjaDetalle.idnomina == TarjaNomina.nomina_id,
                TarjaDetalle.deleted_at.is_(None),
                TarjaDetalle.fecha >= Tarja.fechainicio,
                TarjaDetalle.fecha <= Tarja.fechafinal,
            ),
        ).outerjoin(
            ParteDiarioEstado,
            ParteDiarioEstado.id == TarjaDetalle.idestado,
        )
        if include:
            stmt = self._apply_include(stmt, include)
        rows = session.exec(
            stmt.order_by(order_expression, TarjaDetalle.fecha.asc())
        ).all()
        if not rows:
            if page == 1:
                return [], 0
            count_stmt = self._apply_extended_joins(
                select(func.count()).select_from(TarjaNomina)
            )
            if filters:
                count_stmt = self._apply_filters(count_stmt, filters)
            count_stmt = self._apply_soft_delete_filter(count_stmt, deleted)
            return [], int(session.exec(count_stmt).one())

        items_by_id: dict[int, TarjaNomina] = {}
        for row in rows:
            obj = row[0]
            if obj.id not in items_by_id:
                values = self._row_values(row, 1)
                values.update(self._empty_days(row[10]))
                tipo_novedad = str(row[22] or "").strip().upper() or None
                values.update(
                    {
                        "tipo_novedad": tipo_novedad,
                        "editable": tipo_novedad is None,
                    }
                )
                self._set_calculated(obj, values)
                items_by_id[obj.id] = obj

            detail_date = row[16]
            if row[15] is None or detail_date is None:
                continue
            day_number = (detail_date - row[10]).days + 1
            if not 1 <= day_number <= 15:
                continue
            day_key = f"D{day_number:02d}"
            self._set_calculated(
                obj,
                {
                    day_key: {
                        "detalle_id": row[15],
                        "fecha": detail_date.isoformat(),
                        "horas": float(row[17]) if row[17] is not None else None,
                        "idestado": row[18],
                        "estado": row[19],
                        "estado_nombre": row[20],
                        "descripcion": row[21],
                    }
                },
            )
        return list(items_by_id.values()), int(rows[0][14])

    def _apply_text_search(self, stmt, search_text: str):
        term = f"%{search_text}%"
        return stmt.where(
            or_(
                Nomina.nombre.ilike(term),
                Nomina.apellido.ilike(term),
                Nomina.dni.ilike(term),
                TarjaNomina.observaciones.ilike(term),
            )
        )

    def _apply_filters(self, stmt, filters: dict[str, Any]):
        remaining_filters = dict(filters)
        only_bonuses = self._is_truthy_filter(remaining_filters.pop("bonos", None))
        only_daily_updates = self._is_truthy_filter(
            remaining_filters.pop("parte_novedades", None)
        )

        if only_bonuses:
            stmt = stmt.where(
                or_(
                    TarjaNomina.adicional_importe != 0,
                    TarjaNomina.premio_importe != 0,
                )
            )

        if only_daily_updates:
            daily_update = (
                select(TarjaDetalle.id)
                .outerjoin(
                    ParteDiarioEstado,
                    ParteDiarioEstado.id == TarjaDetalle.idestado,
                )
                .where(TarjaDetalle.tarja_id == TarjaNomina.tarja_id)
                .where(TarjaDetalle.idnomina == TarjaNomina.nomina_id)
                .where(TarjaDetalle.deleted_at.is_(None))
                .where(
                    or_(
                        and_(
                            ParteDiarioEstado.abreviatura.is_not(None),
                            ParteDiarioEstado.abreviatura != "P",
                        ),
                        func.length(
                            func.trim(func.coalesce(TarjaDetalle.descripcion, ""))
                        )
                        > 0,
                    )
                )
                .exists()
            )
            stmt = stmt.where(daily_update)

        return super()._apply_filters(stmt, remaining_filters)

    def create(
        self,
        session: Session,
        data: dict[str, Any],
        auto_commit: bool = True,
    ) -> TarjaNomina:
        tarja_id = data.get("tarja_id")
        nomina_id = data.get("nomina_id")
        if not tarja_id or not nomina_id:
            raise ValueError("Tarja y empleado son obligatorios")

        tarja = session.get(Tarja, int(tarja_id))
        if tarja is None or tarja.deleted_at is not None:
            raise ValueError("La tarja indicada no existe")
        nomina = session.get(Nomina, int(nomina_id))
        if nomina is None or nomina.deleted_at is not None:
            raise ValueError("El empleado indicado no existe")

        fecha_ingreso_value = data.get("fecha_desde")
        if isinstance(fecha_ingreso_value, str):
            try:
                fecha_ingreso = date.fromisoformat(fecha_ingreso_value)
            except ValueError as exc:
                raise ValueError("La fecha de ingreso no es valida") from exc
        else:
            fecha_ingreso = fecha_ingreso_value
        if not isinstance(fecha_ingreso, date):
            raise ValueError("La fecha de ingreso es obligatoria")
        if not tarja.fechainicio <= fecha_ingreso <= tarja.fechafinal:
            raise ValueError("La fecha de ingreso debe estar dentro de la quincena")

        pertenece_a_otra_nomina = (
            nomina.idproyecto is not None
            and nomina.idproyecto != tarja.idproyecto
        ) or (
            nomina.encargado_contacto_id is not None
            and nomina.encargado_contacto_id != tarja.contacto_id
        )
        confirmar_traspaso = self._is_truthy_filter(
            data.get("confirmar_traspaso")
        )
        if pertenece_a_otra_nomina and not confirmar_traspaso:
            raise ValueError(
                "El empleado pertenece a otra nomina. Confirme el traspaso para continuar"
            )

        if pertenece_a_otra_nomina:
            registro_anterior = session.exec(
                select(TarjaNomina)
                .join(Tarja, TarjaNomina.tarja_id == Tarja.id)
                .where(TarjaNomina.nomina_id == nomina.id)
                .where(TarjaNomina.tarja_id != tarja.id)
                .where(TarjaNomina.deleted_at.is_(None))
                .where(Tarja.idproyecto == nomina.idproyecto)
                .order_by(TarjaNomina.fecha_desde.desc())
            ).first()
            fecha_baja = fecha_ingreso
            if registro_anterior is not None and registro_anterior.fecha_hasta >= fecha_ingreso:
                registro_anterior.fecha_hasta = fecha_baja
                registro_anterior.updated_at = datetime.now(UTC)
                session.add(registro_anterior)

        categoria_id = data.get("nomina_categoria_id")
        tarea_id = data.get("nomina_tarea_id")
        nomina.idproyecto = tarja.idproyecto
        nomina.encargado_contacto_id = tarja.contacto_id
        nomina.nomina_categoria_id = (
            int(categoria_id) if categoria_id not in (None, "") else None
        )
        nomina.nomina_tarea_id = (
            int(tarea_id) if tarea_id not in (None, "") else None
        )
        nomina.fecha_ingreso = fecha_ingreso
        nomina.fecha_egreso = None
        nomina.activo = True
        nomina.updated_at = datetime.now(UTC)
        session.add(nomina)

        data = dict(data)
        data["fecha_desde"] = fecha_ingreso
        data["fecha_hasta"] = tarja.fechafinal
        if tarja_id:
            stmt = (
                select(TarjaNomina)
                .where(TarjaNomina.tarja_id == int(tarja_id))
                .where(TarjaNomina.deleted_at.is_(None))
            )
            if nomina_id not in (None, ""):
                stmt = stmt.where(TarjaNomina.nomina_id == int(nomina_id))
            else:
                stmt = stmt.where(TarjaNomina.nomina_id.is_(None))
            existing = session.exec(stmt).first()
            if existing is not None:
                cleaned = self._clean_create(data)
                for field, value in cleaned.items():
                    setattr(existing, field, self._coerce_field_value(field, value))
                if hasattr(existing, "updated_at"):
                    existing.updated_at = datetime.now(UTC)
                session.add(existing)
                if auto_commit:
                    session.commit()
                    session.refresh(existing)
                else:
                    session.flush()
                return existing

        return super().create(session, data, auto_commit=auto_commit)

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
    ) -> TarjaNomina | None:
        obj = self.get(session, obj_id)
        if (
            obj is not None
            and self._get_no_editable_parte_detalle(session, obj) is not None
        ):
            raise ValueError("Las novedades inactivas de nomina no se pueden editar")
        return super().update(session, obj_id, data, check_version=check_version)

    def delete(self, session: Session, obj_id: Any, hard: bool = False) -> bool:
        obj = self.get(session, obj_id)
        if obj is None:
            return False

        deleted_at = datetime.now(UTC)
        tarja = session.get(Tarja, obj.tarja_id)
        nomina_id = int(obj.nomina_id) if obj.nomina_id is not None else None
        alta_detalle = self._get_alta_parte_detalle(session, obj)
        if alta_detalle is not None and tarja is not None and nomina_id is not None:
            for detalle in session.exec(
                select(TarjaDetalle)
                .where(TarjaDetalle.tarja_id == obj.tarja_id)
                .where(TarjaDetalle.idnomina == nomina_id)
                .where(TarjaDetalle.fecha >= tarja.fechainicio)
                .where(TarjaDetalle.fecha <= tarja.fechafinal)
                .where(TarjaDetalle.deleted_at.is_(None))
            ).all():
                if hard:
                    session.delete(detalle)
                else:
                    detalle.deleted_at = deleted_at
                    detalle.updated_at = deleted_at
                    session.add(detalle)

            if hard:
                session.delete(alta_detalle)
            else:
                alta_detalle.deleted_at = deleted_at
                alta_detalle.updated_at = deleted_at
                session.add(alta_detalle)

            other_nomina_count = session.exec(
                select(func.count())
                .select_from(TarjaNomina)
                .where(TarjaNomina.nomina_id == nomina_id)
                .where(TarjaNomina.id != obj.id)
                .where(TarjaNomina.deleted_at.is_(None))
            ).one()
            if int(other_nomina_count or 0) == 0:
                nomina = session.get(Nomina, nomina_id)
                if nomina is not None and nomina.deleted_at is None:
                    if hard:
                        session.delete(nomina)
                    else:
                        nomina.activo = False
                        nomina.deleted_at = deleted_at
                        nomina.updated_at = deleted_at
                        session.add(nomina)

        if hard:
            session.delete(obj)
        else:
            obj.deleted_at = deleted_at
            obj.updated_at = deleted_at
            session.add(obj)

        session.commit()
        return True

    def _get_alta_parte_detalle(
        self,
        session: Session,
        obj: TarjaNomina,
    ) -> ParteDiarioDetalle | None:
        if obj.id is None:
            return None
        stmt = (
            select(ParteDiarioDetalle)
            .select_from(ParteDiarioDetalle)
            .join(ParteDiarioEstado, ParteDiarioEstado.id == ParteDiarioDetalle.idestado)
            .where(ParteDiarioEstado.abreviatura == self.ALTA_ESTADO_CODIGO)
            .where(ParteDiarioEstado.deleted_at.is_(None))
            .where(ParteDiarioDetalle.descripcion == str(obj.id))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        )
        if obj.nomina_id is not None:
            stmt = stmt.where(ParteDiarioDetalle.idnomina == int(obj.nomina_id))
        return session.exec(stmt).first()

    def _get_no_editable_parte_detalle(
        self,
        session: Session,
        obj: TarjaNomina,
    ) -> ParteDiarioDetalle | None:
        if obj.id is None:
            return None
        stmt = (
            select(ParteDiarioDetalle)
            .select_from(ParteDiarioDetalle)
            .join(ParteDiarioEstado, ParteDiarioEstado.id == ParteDiarioDetalle.idestado)
            .where(ParteDiarioEstado.activo.is_(False))
            .where(ParteDiarioEstado.deleted_at.is_(None))
            .where(ParteDiarioDetalle.descripcion == str(obj.id))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        )
        if obj.nomina_id is not None:
            stmt = stmt.where(ParteDiarioDetalle.idnomina == int(obj.nomina_id))
        return session.exec(stmt).first()

    def trasladar(
        self,
        session: Session,
        source_id: int,
        data: TarjaNominaTrasladoRequest,
    ) -> tuple[TarjaNomina, TarjaNomina, Tarja]:
        source = session.get(TarjaNomina, source_id)
        if source is None or source.deleted_at is not None:
            raise ValueError("El registro de nomina origen no existe")
        if source.nomina_id is None:
            raise ValueError("El registro origen no tiene un empleado asociado")

        source_tarja = session.get(Tarja, source.tarja_id)
        if source_tarja is None or source_tarja.deleted_at is not None:
            raise ValueError("La tarja origen no existe")
        if not source_tarja.fechainicio <= data.fecha <= source_tarja.fechafinal:
            raise ValueError("La fecha del traslado debe estar dentro de la quincena")
        if data.proyecto_id == source_tarja.idproyecto:
            raise ValueError("La obra destino debe ser diferente de la obra actual")

        proyecto = session.get(Proyecto, data.proyecto_id)
        if proyecto is None or proyecto.deleted_at is not None:
            raise ValueError("La obra destino no existe")
        asignacion_encargado = session.get(
            ProyectoEncargado,
            data.proyecto_encargado_id,
        )
        if (
            asignacion_encargado is None
            or asignacion_encargado.deleted_at is not None
            or not asignacion_encargado.activo
            or asignacion_encargado.proyecto_id != proyecto.id
            or (
                asignacion_encargado.desde is not None
                and asignacion_encargado.desde > data.fecha
            )
            or (
                asignacion_encargado.hasta is not None
                and asignacion_encargado.hasta < data.fecha
            )
        ):
            raise ValueError("El encargado no esta habilitado para la obra destino")

        destination_tarja = session.exec(
            select(Tarja)
            .where(Tarja.idproyecto == proyecto.id)
            .where(Tarja.contacto_id == asignacion_encargado.contacto_id)
            .where(Tarja.fechainicio == source_tarja.fechainicio)
            .where(Tarja.fechafinal == source_tarja.fechafinal)
            .where(Tarja.deleted_at.is_(None))
        ).first()
        if destination_tarja is None:
            destination_tarja = Tarja(
                idproyecto=proyecto.id,
                contacto_id=asignacion_encargado.contacto_id,
                fechainicio=source_tarja.fechainicio,
                fechafinal=source_tarja.fechafinal,
                descripcion=(
                    f"Tarja {proyecto.nombre} "
                    f"{source_tarja.fechainicio.isoformat()} - "
                    f"{source_tarja.fechafinal.isoformat()}"
                ),
            )
            session.add(destination_tarja)
            session.flush()

        duplicate = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == destination_tarja.id)
            .where(TarjaNomina.nomina_id == source.nomina_id)
            .where(TarjaNomina.deleted_at.is_(None))
        ).first()
        if duplicate is not None:
            raise ValueError("El empleado ya existe en la tarja destino")

        now = datetime.now(UTC)
        source.fecha_hasta = data.fecha
        source.updated_at = now
        destination = TarjaNomina(
            tarja_id=int(destination_tarja.id),
            nomina_id=source.nomina_id,
            nomina_categoria_id=source.nomina_categoria_id,
            nomina_tarea_id=source.nomina_tarea_id,
            fecha_desde=data.fecha,
            fecha_hasta=source_tarja.fechafinal,
        )
        session.add(source)
        session.add(destination)

        nomina = session.get(Nomina, source.nomina_id)
        if nomina is None or nomina.deleted_at is not None:
            raise ValueError("El empleado asociado no existe")
        nomina.idproyecto = proyecto.id
        nomina.encargado_contacto_id = asignacion_encargado.contacto_id
        nomina.nomina_categoria_id = source.nomina_categoria_id
        nomina.nomina_tarea_id = source.nomina_tarea_id
        nomina.fecha_ingreso = data.fecha
        nomina.fecha_egreso = None
        nomina.activo = True
        nomina.updated_at = now
        session.add(nomina)

        session.commit()
        session.refresh(source)
        session.refresh(destination)
        session.refresh(destination_tarja)
        return source, destination, destination_tarja


tarja_nomina_crud = TarjaNominaCRUD(TarjaNomina)

tarja_nomina_router = create_generic_router(
    model=TarjaNomina,
    crud=tarja_nomina_crud,
    prefix="/tarja-nomina",
    tags=["tarja-nomina"],
)


@tarja_nomina_router.post("/{source_id:int}/trasladar")
def trasladar_tarja_nomina(
    source_id: int,
    payload: TarjaNominaTrasladoRequest,
    session: Session = Depends(get_session),
):
    try:
        source, destination, destination_tarja = tarja_nomina_crud.trasladar(
            session,
            source_id,
            payload,
        )
        return {
            "id": destination.id,
            "origen_id": source.id,
            "destino_id": destination.id,
            "tarja_destino_id": destination_tarja.id,
        }
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
