"""Operaciones propias del parte diario: borradores, fechas, guardado y consultas.

Los flows conducen la conversacion. Empleados, obras y encargados resuelven sus
entidades; novedades aplica operaciones. Este modulo concentra los accesos al
parte y sus detalles, sin interpretar mensajes ni decidir preguntas de carga.
"""

from __future__ import annotations

from app.utils.jornada import get_jornada_esperada

from datetime import date, timedelta
import logging

from sqlalchemy import or_
from sqlmodel import Session, select
from app import db

from agente.v3.contracts import V3InboundMessage
from agente.v3.subprocesses.parte_diario.domain import empleados, novedades, obras
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, NovedadPersonal, ParteDiarioDraft, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.state import ParteDiarioFechaOption, ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import calendario, interpretacion, renderer
from agente.v3.subprocesses.parte_diario.utils.calendario import es_dia_laborable, fecha_es_feriado
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from app.models import EstadoParteDiario, OrigenDetalle, ParteDiario, ParteDiarioDetalle, ParteDiarioEstado
from app.services.parte_diario_service import parte_diario_service

logger = logging.getLogger(__name__)


# region Borradores, fechas y guardado

# Recupera el borrador de una fecha e informa si el parte es de solo lectura.
def preparar_borrador_fecha(
    state: ParteDiarioV3State,
    fecha: str,
) -> tuple[str | None, bool]:
    draft = state.draft()
    if draft.fecha and draft.fecha != fecha:
        draft = ParteDiarioDraft.from_dict({}, oportunidad_id=int(state.oportunidad_id or 0), idproyecto=state.proyecto_id)
        draft.contacto_id = state.contacto_id
    with Session(db.engine) as session:
        existing = buscar_parte(session, int(state.proyecto_id), fecha, contacto_id=state.contacto_id)
        cerrado = bool(existing and existing.estado in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO})
        error = aplicar_fecha(session, draft, fecha, cargar_estados(session), allow_closed=True)
    if not error:
        state.set_draft(draft)
    return error, cerrado


# Lista fechas laborables recientes junto con el estado del parte correspondiente.
def build_fecha_options(
    proyecto_id: int,
    *,
    contacto_id: int | None = None,
    today: date | None = None,
    days: int = 7,
) -> list[ParteDiarioFechaOption]:
    today = today or calendario.hoy()
    dates = [today - timedelta(days=offset) for offset in range(days)]
    dates = [target_date for target_date in dates if es_dia_laborable(target_date)]
    with Session(db.engine) as session:
        base_query = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == proyecto_id)
            .where(ParteDiario.fecha.in_(dates))
            .where(ParteDiario.deleted_at.is_(None))
        )
        partes = (
            session.exec(base_query.where(ParteDiario.contacto_id == contacto_id)).all()
            if contacto_id
            else session.exec(base_query).all()
        )
        if contacto_id and not partes:
            partes = session.exec(base_query.where(ParteDiario.contacto_id.is_(None))).all()
    by_date = {parte.fecha: parte for parte in partes}
    options: list[ParteDiarioFechaOption] = []
    for index, target_date in enumerate(dates, start=1):
        parte = by_date.get(target_date)
        if parte is None:
            status = "sin cargar"
            parte_id = None
        elif parte.estado == EstadoParteDiario.CONFIRMADO:
            status = "confirmado"
            parte_id = parte.id
        elif parte.estado == EstadoParteDiario.CERRADO:
            status = "cerrado"
            parte_id = parte.id
        else:
            status = "borrador"
            parte_id = parte.id
        options.append(
            ParteDiarioFechaOption(
                opcion=index,
                fecha=target_date.isoformat(),
                estado=status,
                parte_id=parte_id,
            )
        )
    return options


# Lista fechas editables de mas antigua a mas nueva, excluyendo las indicadas.
def pending_parts_last_days_options(
    state: ParteDiarioV3State,
    *,
    exclude_fechas: set[str | None] | None = None,
    days: int = 10,
) -> list[ParteDiarioFechaOption]:
    if not state.proyecto_id:
        return []
    excluded = {str(item) for item in (exclude_fechas or set()) if item}
    try:
        options = build_fecha_options(
            int(state.proyecto_id),
            contacto_id=state.contacto_id,
            days=days,
        )
    except Exception:
        logger.exception("Error consultando partes pendientes")
        return []
    pending_options = sorted(
        (
            option
            for option in options
            if option.estado in {"borrador", "sin cargar"}
            and option.fecha not in excluded
            and not fecha_es_feriado(option.fecha)
        ),
        key=lambda item: item.fecha,
    )
    return [
        ParteDiarioFechaOption(
            opcion=index,
            fecha=option.fecha,
            estado=option.estado,
            parte_id=option.parte_id,
        )
        for index, option in enumerate(pending_options, start=1)
    ]


# Verifica integridad final y persiste usando la transaccion y trazabilidad existentes.
def persistir_borrador(state: ParteDiarioV3State, message: V3InboundMessage) -> dict:
    draft = state.draft()
    if not state.has_resolved_obra():
        raise ValueError("Falta definir la obra y el contacto del parte.")
    if not draft.fecha:
        raise ValueError("Falta definir la fecha del parte.")
    fecha = date.fromisoformat(draft.fecha)
    hoy = calendario.hoy()
    if fecha > hoy:
        raise ValueError("No se puede guardar un parte con fecha futura.")
    if draft.pendientes_ambiguos or draft.conflictos_novedad or draft.fecha_propuesta:
        raise ValueError("Quedan aclaraciones pendientes. No se modifico el borrador.")

    # El estado se decide al guardar, no por el comando ni por la fecha de apertura del menu.
    cerrar = fecha < hoy
    # Guardar confirma tambien el resumen explicito sin novedades.
    sin_novedades = draft.sin_novedades_informado or not draft.novedades
    payload = {
        "type": "parte_diario_reply", "parte_listo": True,
        "cerrar_parte": cerrar, "confirmar_parte": cerrar,
        "close_after_materialization": True, "cancelado": False,
        "contacto_id": state.contacto_id, "oportunidad_id": state.oportunidad_id,
        "idproyecto": state.proyecto_id, "fecha": draft.fecha,
        "parte_id_existente": draft.parte_id, "sin_novedades_informado": sin_novedades,
        "novedades": [item.to_dict() for item in draft.novedades],
        "pendientes_ambiguos": [], "conflictos_novedad": [], "errores": [],
        "parte_diario": {"status": "confirmed" if cerrar else "saved",
                         "operations": ["confirmar" if cerrar else "guardar"]},
    }
    with Session(db.engine) as session:
        parte = parte_diario_service.create_or_update_from_agent_v3_confirmation(
            session, contacto_id=state.contacto_id, oportunidad_id=state.oportunidad_id,
            result=payload, conversation_id=message.conversation_id,
            provider=message.provider, channel_type=message.channel_type,
            account_ref=message.account_ref, from_address=message.from_address,
            to_address=message.to_address, external_message_id=message.external_message_id,
            text=message.text, message_type=message.message_type,
            raw_payload=message.raw_payload, normalized_payload=message.normalized_payload,
            received_at=message.received_at,
        )
        metadata = {"status": "confirmed" if cerrar else "saved", "parte_listo": True,
                    "parte_diario_id": parte.id, "mensaje_origen_id": parte.mensaje_origen_id,
                    "result": payload}
        draft.parte_id = parte.id
    draft.sin_novedades_informado = sin_novedades
    state.set_draft(draft)
    return metadata


# endregion


# region Recuperacion del parte y sus detalles

# Recupera el catalogo activo de motivos del parte diario.
def cargar_estados(session: Session) -> list[EstadoItem]:
    rows = session.exec(
        select(ParteDiarioEstado)
        .where(ParteDiarioEstado.activo.is_(True))
        .where(ParteDiarioEstado.deleted_at.is_(None))
        .order_by(ParteDiarioEstado.nombre)
    ).all()
    return [EstadoItem(id=int(item.id), abreviatura=item.abreviatura, nombre=item.nombre) for item in rows]


# Busca el parte por obra, fecha y contacto, con alternativa sin contacto.
def buscar_parte(session: Session, idproyecto: int, fecha: str, *, contacto_id: int | None = None) -> ParteDiario | None:
    base_query = (
        select(ParteDiario)
        .where(ParteDiario.idproyecto == idproyecto)
        .where(ParteDiario.fecha == date.fromisoformat(fecha))
        .where(ParteDiario.deleted_at.is_(None))
    )
    if contacto_id:
        parte = session.exec(base_query.where(ParteDiario.contacto_id == contacto_id)).first()
        if parte is not None:
            return parte
        return session.exec(base_query.where(ParteDiario.contacto_id.is_(None))).first()
    return session.exec(base_query).first()


# Convierte detalles guardados por el agente en novedades y personas pendientes.
def cargar_detalles(
    session: Session,
    parte: ParteDiario,
    estados: list[EstadoItem],
    idproyecto: int,
) -> tuple[list[NovedadPersonal], list[PendienteAmbiguo]]:
    status_by_id = {item.id: item.abreviatura for item in estados}
    projects = obras.nombres_por_ids(session)
    rows = session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == parte.id)
        .where(ParteDiarioDetalle.origen == OrigenDetalle.AGENTE)
        .where(ParteDiarioDetalle.deleted_at.is_(None))
    ).all()
    novedades: list[NovedadPersonal] = []
    pendientes: list[PendienteAmbiguo] = []
    for row in rows:
        nomina = empleados.obtener(session, row.idnomina) if row.idnomina is not None else None
        if nomina is None:
            provisional_name = str(row.nombre_provisorio or "").strip()
            if not provisional_name:
                continue
            pendientes.append(
                PendienteAmbiguo(
                    nombre=provisional_name,
                    idestado=row.idestado,
                    estado_codigo=status_by_id.get(row.idestado),
                    horas=float(row.horas),
                    descripcion=row.descripcion,
                    nombre_no_encontrado=True,
                )
            )
            continue
        external = nomina.idproyecto != idproyecto
        novedades.append(
            NovedadPersonal(
                nombre=f"{nomina.apellido}, {nomina.nombre}",
                idnomina=nomina.id,
                idestado=row.idestado,
                estado_codigo=status_by_id.get(row.idestado),
                horas=float(row.horas),
                ingreso=row.ingreso.isoformat() if row.ingreso else None,
                egreso=row.egreso.isoformat() if row.egreso else None,
                descripcion=row.descripcion,
                fuera_de_proyecto=external,
                nombre_proyecto=projects.get(nomina.idproyecto) if external else None,
                nro_legajo=nomina.nro_legajo,
            )
        )
    return novedades, pendientes


# Asigna la fecha y combina el parte existente con las novedades del borrador.
def aplicar_fecha(
    session: Session,
    state: ParteDiarioDraft,
    target_date: str,
    estados: list[EstadoItem],
    *,
    allow_closed: bool = False,
) -> str | None:
    existing = buscar_parte(session, int(state.idproyecto or 0), target_date, contacto_id=state.contacto_id)
    if existing and existing.estado in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO} and not allow_closed:
        return renderer.parte_cerrado(target_date)
    if existing and state.parte_id == existing.id and state.fecha == target_date:
        return None
    state.fecha = target_date
    state.sin_novedades_informado = False
    if existing is None:
        state.parte_id = None
        state.retomado = False
        return None
    loaded, loaded_pending = cargar_detalles(session, existing, estados, int(state.idproyecto or 0))
    if not state.novedades and not state.pendientes_ambiguos:
        state.novedades = loaded
        state.pendientes_ambiguos = loaded_pending
    else:
        for novedad in loaded:
            novedades._registrar_o_encolar_conflicto(state, novedad)
        state.pendientes_ambiguos.extend(loaded_pending)
    state.parte_id = existing.id
    state.retomado = True
    return None

# endregion


# region Consultas de partes guardados

# Consulta partes guardados sin modificar el estado conversacional.
class ParteDiarioQueryService:
    # Fija la obra, el encargado y la fecha de referencia para las consultas de solo lectura.
    def __init__(
        self,
        *,
        session: Session,
        proyecto_id: int,
        contacto_id: int | None,
        nombre_obra: str | None,
        fecha: str | None = None,
    ) -> None:
        self._session = session
        self._proyecto_id = proyecto_id
        self._contacto_id = contacto_id
        self._nombre_obra = nombre_obra or "la obra seleccionada"
        parsed_fecha, fecha_error = calendario.parsear_iso_fecha(fecha) if fecha else (None, None)
        self._fecha = parsed_fecha if fecha_error is None else None

    # Consulta detalles guardados por persona, motivo u horas y agrupa la respuesta.
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
        start, end, error = calendario.parsear_rango(desde, hasta)
        if error:
            return error
        states_by_id = self._estado_by_id()
        state_ids_by_code = {code.upper(): idestado for idestado, code in states_by_id.items()}
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
            candidates = empleados.buscar_en_contexto(self._session, self._proyecto_id, self._contacto_id, self._fecha, persona)
            if not candidates:
                return f"No encontre a {persona} en la nomina asociada a {self._nombre_obra}."
            if len(candidates) > 1:
                names = ", ".join(renderer.etiqueta_nomina(item) for item in candidates[:8])
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
        nominas = empleados.obtener_por_ids(self._session, {detail.idnomina for detail in rows if detail.idnomina})
        proyectos = obras.nombres_por_ids(self._session, {item.idproyecto for item in nominas.values() if item.idproyecto})
        filtered: list[tuple[date, ParteDiarioDetalle]] = []
        for detail in rows:
            parte = partes_by_id.get(detail.parte_diario_id)
            if parte is None:
                continue
            state_code = states_by_id.get(int(detail.idestado or 0))
            if renderer._is_internal_nomina_state(state_code):
                continue
            if selected_state_id is not None and detail.idestado != selected_state_id:
                continue
            if candidate_ids is not None and detail.idnomina not in candidate_ids:
                continue
            nomina = nominas.get(detail.idnomina)
            is_external = bool(nomina is not None and nomina.idproyecto != self._proyecto_id)
            if (
                selected_state_id is None
                and not incluir_presentes
                and str(state_code or "").upper() == "P"
                and not is_external
                and float(detail.horas) == get_jornada_esperada(parte.fecha)
            ):
                continue
            if solo_horas_extras and is_external:
                continue
            if normalized_scope in {"nomina obra", "nomina_obra"} and is_external:
                continue
            if normalized_scope in {"otra nomina", "otra_nomina"} and not is_external:
                continue
            detail_hours = float(detail.horas)
            if solo_horas_extras and not detail_hours > get_jornada_esperada(parte.fecha):
                continue
            if horas_igual_a is not None and detail_hours != horas_igual_a:
                continue
            if horas_menor_que is not None and not detail_hours < horas_menor_que:
                continue
            if horas_mayor_que is not None and not detail_hours > horas_mayor_que:
                continue
            filtered.append((parte.fecha, detail))

        return renderer.consulta_novedades(
            filtered, states_by_id, nominas, proyectos, self._proyecto_id,
            self._nombre_obra, persona, normalized_state, solo_horas_extras, agrupar_por, horas_igual_a,
        )

    # Lista estados de partes en un periodo, incluyendo fechas sin cargar si se solicita.
    def consultar_partes(
        self,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        estado_parte: str | None = None,
        incluir_sin_cargar: bool = False,
    ) -> str:
        start, end, error = calendario.parsear_rango(desde, hasta)
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

    # Consulta la obra, la nomina o el catalogo de estados segun el pedido.
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
        } and not interpretacion._requests_global_nomina(pedido_usuario):
            nominas = empleados.listar_contexto(self._session, self._proyecto_id, self._contacto_id, self._fecha)
            if not nominas:
                return f"No hay personal activo asignado a {self._nombre_obra}."
            return "*NOMINA ACTIVA*\n" + "\n".join(f"- {renderer.etiqueta_nomina(item)}" for item in nominas[:30])
        if normalized in {"toda la nomina", "nomina completa"} or interpretacion._requests_global_nomina(tipo) or interpretacion._requests_global_nomina(pedido_usuario):
            nominas = empleados.listar_activas(self._session)
            if not nominas:
                return "No hay personal activo en la nomina."
            proyectos = obras.nombres_por_ids(self._session, {item.idproyecto for item in nominas if item.idproyecto})
            return renderer.nomina_completa(nominas, proyectos)
        if normalized == "estados":
            states = self._session.exec(
                select(ParteDiarioEstado)
                .where(ParteDiarioEstado.deleted_at.is_(None))
                .order_by(ParteDiarioEstado.abreviatura.asc())
            ).all()
            return "Estados disponibles:\n" + "\n".join(f"- {item.abreviatura}: {item.nombre}" for item in states)
        return "No reconozco ese tipo de contexto. Puedo consultar obra, nomina o estados."

    # Devuelve los borradores y dias laborables sin cargar del periodo solicitado.
    def consultar_partes_pendientes(self, *, desde: str | None = None, hasta: str | None = None) -> str:
        return self.consultar_partes(desde=desde, hasta=hasta, estado_parte="borrador", incluir_sin_cargar=True).replace(
            "Partes consultados:",
            "Partes pendientes:",
        )

    # Recupera partes no eliminados del periodo, limitados a la obra y el contacto.
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

    # Construye el mapa de identificadores a codigos de motivo.
    def _estado_by_id(self) -> dict[int, str]:
        rows = self._session.exec(
            select(ParteDiarioEstado).where(ParteDiarioEstado.deleted_at.is_(None))
        ).all()
        return {int(item.id): item.abreviatura for item in rows if item.id is not None}

# endregion
