"""Consultas read-only para el asistente contextual de parte diario."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import or_
from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario.calendario import es_dia_laborable
from agente.v3.subprocesses.parte_diario.process import _requests_global_nomina, _today
from agente.v3.subprocesses.parte_diario.resolver import normalize_text
from app.models import EstadoParteDiario, Nomina, OrigenDetalle, ParteDiario, ParteDiarioDetalle, ParteDiarioEstado, Proyecto


class ParteDiarioQueryService:
    def __init__(self, *, session: Session, proyecto_id: int, contacto_id: int | None, nombre_obra: str | None) -> None:
        self._session = session
        self._proyecto_id = proyecto_id
        self._contacto_id = contacto_id
        self._nombre_obra = nombre_obra or "la obra seleccionada"

    def consultar_novedades(
        self,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        estado_codigo: str | None = None,
        persona: str | None = None,
        incluir_presentes: bool = False,
        horas_igual_a: float | None = None,
        horas_menor_que: float | None = None,
        horas_mayor_que: float | None = None,
        solo_horas_extras: bool = False,
        alcance_personal: str | None = "todos",
        agrupar_por: str | None = "fecha",
    ) -> str:
        start, end, error = _parse_date_range(desde, hasta)
        if error:
            return error
        states_by_id = self._estado_by_id()
        state_ids_by_code = self._estado_ids_by_code()
        selected_state_id: int | None = None
        normalized_state = str(estado_codigo or "").strip().upper() or None
        if solo_horas_extras:
            normalized_state = "P"
            incluir_presentes = True
        if normalized_state:
            selected_state_id = state_ids_by_code.get(normalized_state)
            if selected_state_id is None:
                return f"No encontre el estado {normalized_state} en el catalogo de estados del parte diario."
        normalized_scope = normalize_text(alcance_personal or "todos")
        if normalized_scope not in {"todos", "nomina obra", "nomina_obra", "otra nomina", "otra_nomina"}:
            return "No reconozco el alcance de personal solicitado."

        candidate_ids: set[int] | None = None
        if persona:
            candidates = self._find_nomina_candidates(persona)
            if not candidates:
                return f"No encontre a {persona} en la nomina asociada a {self._nombre_obra}."
            if len(candidates) > 1:
                names = ", ".join(_nomina_label(item) for item in candidates[:8])
                suffix = "..." if len(candidates) > 8 else ""
                return f"Encontre mas de una persona para {persona}: {names}{suffix}. Pedi la consulta con nombre mas especifico."
            candidate_ids = {int(candidates[0].id)}

        partes = self._query_partes(start, end)
        parte_ids = [item.id for item in partes if item.id is not None]
        if not parte_ids:
            return f"No hay partes guardados para {self._nombre_obra} en el periodo consultado."

        rows = self._session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id.in_(parte_ids))
            .where(ParteDiarioDetalle.origen == OrigenDetalle.AGENTE)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
            .order_by(ParteDiarioDetalle.parte_diario_id.desc(), ParteDiarioDetalle.id.asc())
        ).all()
        partes_by_id = {item.id: item for item in partes if item.id is not None}
        filtered: list[tuple[date, ParteDiarioDetalle]] = []
        for detail in rows:
            parte = partes_by_id.get(detail.parte_diario_id)
            if parte is None:
                continue
            state_code = states_by_id.get(int(detail.idestado or 0))
            if selected_state_id is not None and detail.idestado != selected_state_id:
                continue
            if candidate_ids is not None and detail.idnomina not in candidate_ids:
                continue
            is_external = self._detail_is_external(detail)
            if (
                selected_state_id is None
                and not incluir_presentes
                and str(state_code or "").upper() == "P"
                and not is_external
                and float(detail.horas) == 9
            ):
                continue
            if solo_horas_extras and is_external:
                continue
            if normalized_scope in {"nomina obra", "nomina_obra"} and is_external:
                continue
            if normalized_scope in {"otra nomina", "otra_nomina"} and not is_external:
                continue
            detail_hours = float(detail.horas)
            if solo_horas_extras and not detail_hours > 9:
                continue
            if horas_igual_a is not None and detail_hours != horas_igual_a:
                continue
            if horas_menor_que is not None and not detail_hours < horas_menor_que:
                continue
            if horas_mayor_que is not None and not detail_hours > horas_mayor_que:
                continue
            filtered.append((parte.fecha, detail))

        if not filtered:
            subject = f" para {persona}" if persona else ""
            state_text = " con horas extras" if solo_horas_extras else (f" con estado {normalized_state}" if normalized_state else "")
            return f"No encontre novedades{state_text}{subject} en {self._nombre_obra} en el periodo consultado."

        if str(agrupar_por or "fecha").lower() == "persona":
            grouped_by_person: dict[str, list[str]] = {}
            for item_date, detail in filtered:
                value = item_date.strftime("%d/%m/%Y")
                if solo_horas_extras:
                    value = f"{value} ({_format_decimal(Decimal(str(float(detail.horas) - 9)))}h extras)"
                grouped_by_person.setdefault(self._detail_person_label(detail), []).append(value)
            lines = ["Horas extras registradas:" if solo_horas_extras else "Novedades registradas:"]
            for person in sorted(grouped_by_person):
                lines.append(f"- {person}: {', '.join(grouped_by_person[person])}")
            return "\n".join(lines)

        grouped: dict[date, list[str]] = {}
        for item_date, detail in filtered:
            label = self._extra_hours_label(detail) if solo_horas_extras else self._detalle_label(detail, states_by_id)
            grouped.setdefault(item_date, []).append(label)
        if solo_horas_extras:
            title = "Horas extras registradas:"
        elif horas_igual_a == 0:
            title = "Personas que no trabajaron:"
        elif normalized_state == "FAL":
            title = "Faltas registradas:"
        else:
            title = "Novedades registradas:"
        lines = [title]
        for item_date in sorted(grouped.keys(), reverse=True):
            lines.append(f"- {item_date.strftime('%d/%m/%Y')}: " + "; ".join(grouped[item_date]))
        return "\n".join(lines)

    def consultar_partes(
        self,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        estado_parte: str | None = None,
        incluir_sin_cargar: bool = False,
    ) -> str:
        start, end, error = _parse_date_range(desde, hasta)
        if error:
            return error
        normalized_state = str(estado_parte or "").strip().lower()
        pending_alias = normalized_state in {"pendiente", "pendientes"}
        if pending_alias:
            normalized_state = EstadoParteDiario.BORRADOR.value
            incluir_sin_cargar = True
        valid_states = {item.value for item in EstadoParteDiario}
        if normalized_state and normalized_state not in valid_states:
            return f"No reconozco el estado de parte {estado_parte}."
        partes = self._query_partes(start, end)
        by_date = {item.fecha: item for item in partes}
        rows: list[str] = []
        cursor = end
        while cursor >= start:
            if incluir_sin_cargar and not es_dia_laborable(cursor):
                cursor -= timedelta(days=1)
                continue
            parte = by_date.get(cursor)
            if parte is None:
                if incluir_sin_cargar:
                    rows.append(f"{cursor.strftime('%d/%m/%Y')}: sin cargar")
            else:
                state = parte.estado.value if hasattr(parte.estado, "value") else str(parte.estado)
                if not normalized_state or state == normalized_state:
                    rows.append(f"{cursor.strftime('%d/%m/%Y')}: {state}")
            cursor -= timedelta(days=1)
        if not rows:
            return f"No encontre partes para {self._nombre_obra} entre {start.strftime('%d/%m/%Y')} y {end.strftime('%d/%m/%Y')}."
        title = "Partes pendientes:" if pending_alias else "Partes consultados:"
        return title + "\n" + "\n".join(f"- {item}" for item in rows[:20])

    def consultar_contexto_parte(self, *, tipo: str, pedido_usuario: str | None = None) -> str:
        normalized = normalize_text(tipo)
        if normalized == "obra":
            return f"Obra seleccionada: {self._nombre_obra}."
        if normalized in {
            "nomina",
            "nomina obra",
            "nomina proyecto",
            "personal",
            "empleado",
            "empleados",
        } and not _requests_global_nomina(pedido_usuario):
            nominas = self._load_scoped_nomina()
            if not nominas:
                return f"No hay personal activo asignado a {self._nombre_obra}."
            return "*NOMINA ACTIVA*\n" + "\n".join(f"- {_nomina_label(item)}" for item in nominas[:30])
        if _requests_global_nomina(tipo) or _requests_global_nomina(pedido_usuario):
            nominas = self._load_all_nomina()
            if not nominas:
                return "No hay personal activo en la nomina."
            return "*NOMINA COMPLETA*\n" + "\n".join(f"- {self._nomina_with_project_label(item)}" for item in nominas[:30])
        if normalized == "estados":
            states = self._session.exec(
                select(ParteDiarioEstado)
                .where(ParteDiarioEstado.deleted_at.is_(None))
                .order_by(ParteDiarioEstado.abreviatura.asc())
            ).all()
            return "Estados disponibles:\n" + "\n".join(f"- {item.abreviatura}: {item.nombre}" for item in states)
        return "No reconozco ese tipo de contexto. Puedo consultar obra, nomina o estados."

    def consultar_faltas_persona(self, *, persona: str, desde: str | None = None, hasta: str | None = None) -> str:
        return self.consultar_novedades(
            persona=persona,
            desde=desde,
            hasta=hasta,
            horas_igual_a=0,
            agrupar_por="persona",
        )

    def consultar_faltas(self, *, desde: str | None = None, hasta: str | None = None) -> str:
        return self.consultar_novedades(desde=desde, hasta=hasta, horas_igual_a=0)

    def consultar_parte_fecha(self, *, fecha: str) -> str:
        target_date, error = _parse_iso_date(fecha)
        if error:
            return error
        parte = self._find_parte(target_date)
        if parte is None:
            return f"No hay un parte diario guardado para {target_date.strftime('%d/%m/%Y')} en {self._nombre_obra}."
        detalles = self._session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id == parte.id)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
            .order_by(ParteDiarioDetalle.id.asc())
        ).all()
        estado_label = parte.estado.value if hasattr(parte.estado, "value") else str(parte.estado)
        if not detalles:
            return (
                f"Parte diario de {self._nombre_obra} del {target_date.strftime('%d/%m/%Y')}: "
                f"{estado_label}, sin novedades registradas."
            )
        lines = [
            f"Parte diario de {self._nombre_obra} del {target_date.strftime('%d/%m/%Y')}: {estado_label}.",
            "Novedades:",
        ]
        states = self._estado_by_id()
        for detail in detalles[:20]:
            lines.append(f"- {self._detalle_label(detail, states)}")
        if len(detalles) > 20:
            lines.append(f"- ... y {len(detalles) - 20} registros mas.")
        return "\n".join(lines)

    def consultar_partes_pendientes(self, *, desde: str | None = None, hasta: str | None = None) -> str:
        return self.consultar_partes(desde=desde, hasta=hasta, estado_parte="borrador", incluir_sin_cargar=True).replace(
            "Partes consultados:",
            "Partes pendientes:",
        )

    def _find_nomina_candidates(self, persona: str) -> list[Nomina]:
        needle = normalize_text(persona)
        if not needle:
            return []
        tokens = [token for token in needle.split() if token]
        nominas = self._load_scoped_nomina()
        return [
            item
            for item in nominas
            if all(token in normalize_text(f"{item.apellido} {item.nombre}") for token in tokens)
        ]

    def _load_scoped_nomina(self) -> list[Nomina]:
        rows = self._session.exec(
            select(Nomina)
            .where(Nomina.idproyecto == self._proyecto_id)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
        ).all()
        return rows

    def _load_all_nomina(self) -> list[Nomina]:
        return self._session.exec(
            select(Nomina)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
        ).all()

    def _nomina_with_project_label(self, item: Nomina) -> str:
        suffix = ""
        if item.idproyecto:
            project = self._session.get(Proyecto, item.idproyecto)
            if project is not None and project.nombre:
                suffix = f" ({project.nombre})"
        return f"{_nomina_label(item)}{suffix}"

    def _query_partes(self, desde: date, hasta: date) -> list[ParteDiario]:
        query = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == self._proyecto_id)
            .where(ParteDiario.fecha >= desde)
            .where(ParteDiario.fecha <= hasta)
            .where(ParteDiario.deleted_at.is_(None))
            .order_by(ParteDiario.fecha.desc())
        )
        if self._contacto_id:
            query = query.where(or_(ParteDiario.contacto_id == self._contacto_id, ParteDiario.contacto_id.is_(None)))
        return self._session.exec(query).all()

    def _find_parte(self, fecha: date) -> ParteDiario | None:
        query = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == self._proyecto_id)
            .where(ParteDiario.fecha == fecha)
            .where(ParteDiario.deleted_at.is_(None))
        )
        if self._contacto_id:
            scoped = self._session.exec(query.where(ParteDiario.contacto_id == self._contacto_id)).first()
            if scoped is not None:
                return scoped
            return self._session.exec(query.where(ParteDiario.contacto_id.is_(None))).first()
        return self._session.exec(query).first()

    def _estado_by_id(self) -> dict[int, str]:
        rows = self._session.exec(
            select(ParteDiarioEstado).where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        return {int(item.id): item.abreviatura for item in rows if item.id is not None}

    def _estado_ids_by_code(self) -> dict[str, int]:
        rows = self._session.exec(
            select(ParteDiarioEstado).where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        return {item.abreviatura.upper(): int(item.id) for item in rows if item.id is not None}

    def _detalle_label(self, detail: ParteDiarioDetalle, states: dict[int, str]) -> str:
        name = str(detail.nombre_provisorio or "").strip()
        legajo = ""
        external = ""
        if detail.idnomina:
            nomina = self._session.get(Nomina, detail.idnomina)
            if nomina is not None:
                name = _nomina_label(nomina)
                legajo = f" (legajo {nomina.nro_legajo})" if nomina.nro_legajo else ""
                external = self._external_nomina_label(nomina)
        if not name:
            name = "Persona sin identificar"
        state = states.get(int(detail.idestado or 0), "estado pendiente")
        hours = _format_decimal(detail.horas)
        description = f", motivo: {detail.descripcion}" if detail.descripcion else ""
        return f"{name}{legajo}{external}: {state}, {hours}h{description}"

    def _detail_person_label(self, detail: ParteDiarioDetalle) -> str:
        name = str(detail.nombre_provisorio or "").strip()
        if detail.idnomina:
            nomina = self._session.get(Nomina, detail.idnomina)
            if nomina is not None:
                return f"{_nomina_label(nomina)}{self._external_nomina_label(nomina)}"
        return name or "Persona sin identificar"

    def _detail_is_external(self, detail: ParteDiarioDetalle) -> bool:
        if not detail.idnomina:
            return False
        nomina = self._session.get(Nomina, detail.idnomina)
        return bool(nomina is not None and nomina.idproyecto != self._proyecto_id)

    def _external_nomina_label(self, nomina: Nomina) -> str:
        if nomina.idproyecto == self._proyecto_id:
            return ""
        project_name = None
        if nomina.idproyecto:
            project = self._session.get(Proyecto, nomina.idproyecto)
            project_name = project.nombre if project is not None else None
        suffix = f": {project_name}" if project_name else ""
        return f" (otra nomina{suffix})"

    def _extra_hours_label(self, detail: ParteDiarioDetalle) -> str:
        extra = max(0.0, float(detail.horas) - 9)
        return (
            f"{self._detail_person_label(detail)}: "
            f"{_format_decimal(Decimal(str(extra)))}h extras ({_format_decimal(detail.horas)}h reportadas)"
        )


def _parse_date_range(desde: str | None, hasta: str | None) -> tuple[date, date, str | None]:
    default_end = _today()
    default_start = default_end - timedelta(days=30)
    start, start_error = _parse_iso_date(desde) if desde else (default_start, None)
    end, end_error = _parse_iso_date(hasta) if hasta else (default_end, None)
    if start_error:
        return default_start, default_end, start_error
    if end_error:
        return default_start, default_end, end_error
    if start > end:
        return default_start, default_end, "El rango de fechas esta invertido."
    return start, end, None


def _parse_iso_date(value: str | None) -> tuple[date, str | None]:
    try:
        return date.fromisoformat(str(value or "").strip()), None
    except ValueError:
        return _today(), "No pude interpretar la fecha de la consulta."


def _nomina_label(item: Nomina) -> str:
    return f"{item.apellido}, {item.nombre}"


def _format_decimal(value: Decimal) -> str:
    as_float = float(value)
    return f"{as_float:g}"
