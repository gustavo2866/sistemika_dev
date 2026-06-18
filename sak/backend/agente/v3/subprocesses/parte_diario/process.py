"""Coordinacion conversacional del proceso parte_diario."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from dataclasses import dataclass, field
import logging
import re
import unicodedata
from typing import Any
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.executor import (
    _registrar_o_encolar_conflicto,
    execute_plan,
    limpiar_conflictos_repetidos,
    registrar_pendiente_resuelto,
)
from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.models import (
    EstadoItem,
    ExecutionResult,
    NominaItem,
    NovedadPersonal,
    ParteDiarioOperation,
    ParteDiarioState,
    PendienteAmbiguo,
    TurnPlan,
)
from agente.v3.subprocesses.parte_diario.resolver import (
    NominaResolver,
    normalize_text,
    parse_candidate_selection,
    parse_estado_local,
    resolve_estado_codigo,
)
from app.models import (
    EstadoParteDiario,
    Nomina,
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
)


BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")
logger = logging.getLogger(__name__)
_RESERVED_OPERATIONS = {"confirmar", "cancelar"}
_MUTATING_OPERATIONS = {"agregar_novedad", "modificar_novedad", "eliminar_novedad", "sin_novedades"}


@dataclass(slots=True)
class TurnResult:
    payload: dict[str, Any] = field(default_factory=dict)
    keep_active: bool = True
    process_state: dict[str, Any] = field(default_factory=dict)


class ParteDiarioProcess:
    name = "parte_diario"

    def __init__(self, *, session: Session | None, llm_client: ParteDiarioLLMClient | None = None) -> None:
        self._session = session
        self._llm = llm_client or ParteDiarioLLMClient()

    def priority(self, ctx: Any) -> int | None:
        return 100 if ctx.is_project and ctx.active_process == self.name else None

    async def handle(self, ctx: Any) -> TurnResult:
        if self._session is None:
            return self._simple_reply("El proceso de parte diario requiere una sesion de base de datos.", keep_active=False)
        project = self._resolve_project(ctx.oportunidad_id)
        if project is None:
            return self._simple_reply("No encontre un proyecto asociado para cargar el parte diario.", keep_active=False)
        estados = self._load_estados()
        nominas_proyecto, nominas_completas = self._load_nominas(project.id)
        state = ParteDiarioState.from_dict(
            ctx.process_state,
            oportunidad_id=ctx.oportunidad_id,
            idproyecto=project.id,
        )
        had_conversational_draft = _has_conversational_draft(state)
        limpiar_conflictos_repetidos(state)
        command = _normalize_command(ctx.message.contenido)

        if command == "cancelar":
            return self._from_execution(
                execute_plan(
                    state,
                    TurnPlan(operations=[ParteDiarioOperation(type="cancelar")]),
                    nominas_proyecto,
                    nominas_completas,
                    estados,
                )
            )

        readonly_operation = _parse_local_readonly_operation(command)
        if readonly_operation and state.esperando in {"confirmacion_ambiguos", "resolucion_conflictos"}:
            return self._from_execution(
                execute_plan(
                    state,
                    TurnPlan(operations=[ParteDiarioOperation(type=readonly_operation)]),
                    nominas_proyecto,
                    nominas_completas,
                    estados,
                )
            )

        if state.esperando == "confirmacion_cambio_fecha":
            if command == "cambiar fecha":
                return self._apply_confirmed_date_change(state, estados)
            if command == "mantener fecha":
                state.fecha_propuesta = None
                state.esperando = None
                return self._state_reply(state, renderer.fecha_original_conservada(state.fecha))
            return self._state_reply(
                state,
                renderer.preguntar_cambio_fecha(state.fecha, str(state.fecha_propuesta)),
            )

        if state.esperando == "resolucion_conflictos":
            return self._handle_conflict_selection(state, command, estados, nominas_proyecto, nominas_completas)

        if state.esperando == "confirmacion_ambiguos":
            return await self._handle_pending_selection(
                state,
                ctx.message.contenido,
                estados,
                nominas_proyecto,
                nominas_completas,
            )

        if command == "confirmar":
            return self._handle_exact_confirmation(state, estados, nominas_proyecto, nominas_completas)

        if command == "cerrar":
            return self._handle_exact_confirmation(
                state,
                estados,
                nominas_proyecto,
                nominas_completas,
                cerrar_parte=True,
            )

        self._session.commit()
        message_text = _normalize_attendance_transcription(
            ctx.message.contenido,
            nominas_proyecto,
            nominas_completas,
        )
        try:
            plan = await self._llm.interpret_turn(message_text, state, nominas_proyecto, estados)
        except Exception:
            logger.exception("No se pudo interpretar el turno de parte_diario")
            return self._state_reply(
                state,
                "No pude interpretar el parte diario. Proba nuevamente con una descripcion breve.",
            )

        validation_error = _validate_plan(plan)
        if validation_error:
            return self._state_reply(state, validation_error)

        date_operations = [operation for operation in plan.operations if operation.type == "set_fecha"]
        if date_operations:
            new_date = _parse_date_reference(date_operations[-1].fecha)
            if new_date is None:
                return self._state_reply(state, "No pude interpretar la fecha del parte diario.")
            if new_date > _today():
                return self._state_reply(state, "No se pueden registrar partes diarios de fechas futuras.")
            if state.fecha and state.fecha != new_date.isoformat() and not plan.is_readonly():
                state.fecha_propuesta = new_date.isoformat()
                state.esperando = "confirmacion_cambio_fecha"
                return self._state_reply(state, renderer.preguntar_cambio_fecha(state.fecha, state.fecha_propuesta))
            date_error = self._apply_date(
                state,
                new_date.isoformat(),
                estados,
                allow_closed=plan.is_readonly(),
            )
            if date_error:
                return self._simple_reply(date_error, keep_active=False)
            plan.operations = [operation for operation in plan.operations if operation.type != "set_fecha"]

        if state.fecha is None and not plan.is_readonly():
            date_error = self._apply_date(state, _today().isoformat(), estados)
            if date_error:
                return self._simple_reply(date_error, keep_active=False)

        result = execute_plan(state, plan, nominas_proyecto, nominas_completas, estados)
        if plan.is_readonly() and not had_conversational_draft:
            if any(operation.type == "mostrar_parte" for operation in plan.operations):
                result.reply = renderer.consulta(result.next_state)
            result.keep_active = False
        return self._from_execution(result, plan=plan)

    def _handle_exact_confirmation(
        self,
        state: ParteDiarioState,
        estados: list[EstadoItem],
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
        *,
        cerrar_parte: bool = False,
    ) -> TurnResult:
        if state.conflictos_novedad:
            if not cerrar_parte:
                return self._build_confirmation_result(state, cerrar_parte=False)
            state.esperando = "resolucion_conflictos"
            return self._state_reply(state, renderer.preguntar_conflicto(state.conflictos_novedad[0]))
        if state.pendientes_ambiguos:
            if not cerrar_parte:
                return self._build_confirmation_result(state, cerrar_parte=False)
            state.esperando = "confirmacion_ambiguos"
            _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
            return self._state_reply(state, renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados))
        if not state.novedades and not state.sin_novedades_informado:
            return self._state_reply(state, renderer.falta_informacion())
        business_errors = _validate_state_business_rules(state)
        if business_errors:
            return self._state_reply(
                state,
                "\n".join(business_errors) + "\n\n" + renderer.solicitar_confirmacion(state),
            )
        return self._build_confirmation_result(state, cerrar_parte=cerrar_parte)

    def _build_confirmation_result(self, state: ParteDiarioState, *, cerrar_parte: bool) -> TurnResult:
        return self._from_execution(
            ExecutionResult(
                status="confirmed",
                next_state=state,
                reply=renderer.confirmado(state, cerrado=cerrar_parte),
                parte_listo=True,
                cerrar_parte=cerrar_parte,
                applied_operations=["confirmar"],
            )
        )

    async def _handle_pending_selection(
        self,
        state: ParteDiarioState,
        text: str,
        estados: list[EstadoItem],
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> TurnResult:
        if not state.pendientes_ambiguos:
            return self._after_validation_completed(state, estados, nominas_proyecto, nominas_completas)
        pending = state.pendientes_ambiguos[0]
        if pending.nombre_no_encontrado:
            resolved = NominaResolver.resolve(text, nominas_proyecto, nominas_completas)
            pending.nombre = text.strip() or pending.nombre
            if resolved.error:
                _prepare_pending_validation(pending, nominas_proyecto, nominas_completas)
                return self._state_reply(
                    state,
                    renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
                )
            pending.nombre_no_encontrado = False
            if resolved.ambiguo:
                pending.candidatos = resolved.candidatos
                return self._state_reply(state, renderer.preguntar_pendiente(pending, estados))
            selected = resolved.match
            if selected is None:
                pending.nombre_no_encontrado = True
                return self._state_reply(state, renderer.preguntar_pendiente(pending, estados))
            pending.candidatos = [selected]
            pending.idnomina_resuelto = selected.idnomina
            pending.fuera_de_proyecto = selected.fuera_de_proyecto
            pending.nombre_proyecto = selected.nombre_proyecto
            if pending.estado_pendiente:
                return self._state_reply(state, renderer.preguntar_estado(pending, estados))

        if pending.nombre_pendiente:
            if _is_unvalidated_selection(text, pending):
                skipped_name = pending.nombre
                state.pendientes_ambiguos.pop(0)
                if state.pendientes_ambiguos:
                    _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
                    return self._state_reply(
                        state,
                        f"{skipped_name} quedo sin validar y no se registrara en el parte.\n\n"
                        f"{renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados)}",
                    )
                state.esperando = None
                return self._after_validation_completed(
                    state,
                    estados,
                    nominas_proyecto,
                    nominas_completas,
                    prefix=f"{skipped_name} quedo sin validar y no se registrara en el parte.",
                )
            selected = parse_candidate_selection(text, pending.candidatos or [])
            if selected is None:
                return self._state_reply(
                    state,
                    renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
                )
            pending.idnomina_resuelto = selected.idnomina
            pending.fuera_de_proyecto = selected.fuera_de_proyecto
            pending.nombre_proyecto = selected.nombre_proyecto
            if pending.estado_pendiente:
                return self._state_reply(state, renderer.preguntar_estado(pending, estados))

        elif pending.estado_pendiente:
            selected_state = parse_estado_local(text, estados)
            if selected_state is None and pending.intentos_estado < 2:
                self._session.commit()
                try:
                    code = await self._llm.interpretar_estado_pendiente(text, estados)
                except Exception:
                    logger.exception("No se pudo interpretar el estado pendiente de parte_diario")
                    code = "NO_DETERMINADO"
                selected_state = resolve_estado_codigo(code, estados)
            if selected_state is None:
                pending.intentos_estado += 1
                return self._state_reply(
                    state,
                    renderer.validacion_requerida(
                        renderer.preguntar_estado(pending, estados, exigir_numero=pending.intentos_estado >= 2)
                    ),
                )
            pending.idestado = selected_state.id
            pending.estado_codigo = selected_state.abreviatura
            pending.descripcion = _append_description(pending.descripcion, text)

        pending_error = _validate_pending_business_rules(pending)
        if pending_error:
            pending.idestado = None
            pending.estado_codigo = None
            return self._state_reply(state, f"{pending_error}\n\n{renderer.preguntar_estado(pending, estados)}")

        state.pendientes_ambiguos.pop(0)
        registrar_pendiente_resuelto(state, pending, estados)
        if state.conflictos_novedad:
            state.esperando = "resolucion_conflictos"
            return self._state_reply(state, renderer.preguntar_conflicto(state.conflictos_novedad[0]))
        if state.pendientes_ambiguos:
            _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
            return self._state_reply(state, renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados))
        return self._after_validation_completed(state, estados, nominas_proyecto, nominas_completas)

    def _handle_conflict_selection(
        self,
        state: ParteDiarioState,
        command: str,
        estados: list[EstadoItem],
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> TurnResult:
        if not state.conflictos_novedad:
            return self._after_validation_completed(state, estados, nominas_proyecto, nominas_completas)
        conflict = state.conflictos_novedad[0]
        numbers = re.findall(r"\d+", command)
        if len(numbers) != 1:
            return self._state_reply(state, renderer.validacion_requerida(renderer.preguntar_conflicto(conflict)))
        index = int(numbers[0]) - 1
        if not 0 <= index < len(conflict.opciones):
            return self._state_reply(state, renderer.validacion_requerida(renderer.preguntar_conflicto(conflict)))
        selected = conflict.opciones[index]
        state.novedades = [item for item in state.novedades if item.idnomina != conflict.idnomina]
        state.novedades.append(selected)
        state.conflictos_novedad.pop(0)
        if state.conflictos_novedad:
            return self._state_reply(state, renderer.preguntar_conflicto(state.conflictos_novedad[0]))
        if state.pendientes_ambiguos:
            state.esperando = "confirmacion_ambiguos"
            _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
            return self._state_reply(state, renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados))
        return self._after_validation_completed(state, estados, nominas_proyecto, nominas_completas)

    def _after_validation_completed(
        self,
        state: ParteDiarioState,
        estados: list[EstadoItem],
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
        *,
        prefix: str | None = None,
    ) -> TurnResult:
        state.esperando = None
        result = self._handle_exact_confirmation(state, estados, nominas_proyecto, nominas_completas, cerrar_parte=True)
        if prefix and result.payload.get("reply_to_user"):
            result.payload["reply_to_user"] = f"{prefix}\n\n{result.payload['reply_to_user']}"
        return result

    def _apply_confirmed_date_change(self, state: ParteDiarioState, estados: list[EstadoItem]) -> TurnResult:
        proposed = state.fecha_propuesta
        state.fecha_propuesta = None
        state.esperando = None
        if not proposed:
            return self._state_reply(state, "No hay un cambio de fecha pendiente.")
        error = self._apply_date(state, proposed, estados)
        if error:
            return self._state_reply(state, error)
        return self._state_reply(state, renderer.actualizado(state))

    def _apply_date(
        self,
        state: ParteDiarioState,
        target_date: str,
        estados: list[EstadoItem],
        *,
        allow_closed: bool = False,
    ) -> str | None:
        existing = self._find_parte(int(state.idproyecto or 0), target_date)
        if existing and existing.estado == EstadoParteDiario.CERRADO and not allow_closed:
            return renderer.parte_cerrado(target_date)
        if existing and state.parte_id == existing.id and state.fecha == target_date:
            return None
        state.fecha = target_date
        state.sin_novedades_informado = False
        if existing is None:
            state.parte_id = None
            state.retomado = False
            return None
        loaded, loaded_pending = self._load_explicit_items(existing, estados, int(state.idproyecto or 0))
        if not state.novedades and not state.pendientes_ambiguos:
            state.novedades = loaded
            state.pendientes_ambiguos = loaded_pending
        else:
            for novedad in loaded:
                _registrar_o_encolar_conflicto(state, novedad)
            state.pendientes_ambiguos.extend(loaded_pending)
        state.parte_id = existing.id
        state.retomado = True
        return None

    def _find_parte(self, idproyecto: int, fecha: str) -> ParteDiario | None:
        return self._session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == idproyecto)
            .where(ParteDiario.fecha == date.fromisoformat(fecha))
            .where(ParteDiario.deleted_at.is_(None))
        ).first()

    def _load_explicit_items(
        self,
        parte: ParteDiario,
        estados: list[EstadoItem],
        idproyecto: int,
    ) -> tuple[list[NovedadPersonal], list[PendienteAmbiguo]]:
        status_by_id = {item.id: item.abreviatura for item in estados}
        projects = {item.id: item.nombre for item in self._session.exec(select(Proyecto)).all()}
        rows = self._session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id == parte.id)
            .where(ParteDiarioDetalle.origen == OrigenDetalle.AGENTE)
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).all()
        novedades: list[NovedadPersonal] = []
        pendientes: list[PendienteAmbiguo] = []
        for row in rows:
            nomina = self._session.get(Nomina, row.idnomina) if row.idnomina is not None else None
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
                )
            )
        return novedades, pendientes

    def _resolve_project(self, oportunidad_id: int) -> Proyecto | None:
        return self._session.exec(
            select(Proyecto)
            .where(Proyecto.oportunidad_id == oportunidad_id)
            .where(Proyecto.deleted_at.is_(None))
        ).first()

    def _load_estados(self) -> list[EstadoItem]:
        rows = self._session.exec(
            select(ParteDiarioEstado)
            .where(ParteDiarioEstado.activo.is_(True))
            .where(ParteDiarioEstado.deleted_at.is_(None))
            .order_by(ParteDiarioEstado.nombre)
        ).all()
        return [EstadoItem(id=int(item.id), abreviatura=item.abreviatura, nombre=item.nombre) for item in rows]

    def _load_nominas(self, idproyecto: int) -> tuple[list[NominaItem], list[NominaItem]]:
        projects = {item.id: item.nombre for item in self._session.exec(select(Proyecto)).all()}
        today = _today()
        rows = self._session.exec(
            select(Nomina)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= today))
            .order_by(Nomina.apellido, Nomina.nombre)
        ).all()
        all_items = [
            NominaItem(
                idnomina=int(item.id),
                nombre=item.nombre,
                apellido=item.apellido,
                idproyecto=item.idproyecto,
                nombre_proyecto=projects.get(item.idproyecto),
                fuera_de_proyecto=item.idproyecto != idproyecto,
                nro_legajo=item.nro_legajo,
            )
            for item in rows
        ]
        return [item for item in all_items if item.idproyecto == idproyecto], all_items

    def _from_execution(self, result: ExecutionResult, *, plan: TurnPlan | None = None) -> TurnResult:
        return TurnResult(
            payload=_payload(result, plan=plan),
            keep_active=result.keep_active,
            process_state=result.next_state.to_dict(),
        )

    def _state_reply(self, state: ParteDiarioState, text: str) -> TurnResult:
        return TurnResult(
            payload=_payload(ExecutionResult("waiting", state, text)),
            keep_active=True,
            process_state=state.to_dict(),
        )

    @staticmethod
    def _simple_reply(text: str, *, keep_active: bool) -> TurnResult:
        return TurnResult(
            payload={"type": "parte_diario_reply", "reply_to_user": text, "parte_listo": False},
            keep_active=keep_active,
        )


def _payload(result: ExecutionResult, *, plan: TurnPlan | None = None) -> dict:
    state = result.next_state
    process_metadata = {
        "status": result.status,
        "operations": result.applied_operations,
    }
    if plan is not None:
        process_metadata["llm_operations"] = [operation.type for operation in plan.operations]
        process_metadata["llm_raw"] = plan.raw_response
        process_metadata["llm_ms"] = plan.llm_ms
    return {
        "type": "parte_diario_reply",
        "reply_to_user": result.reply,
        "parte_listo": result.parte_listo,
        "cerrar_parte": result.cerrar_parte,
        "close_after_materialization": result.parte_listo,
        "cancelado": result.cancelado,
        "oportunidad_id": state.oportunidad_id,
        "idproyecto": state.idproyecto,
        "fecha": state.fecha,
        "parte_id_existente": state.parte_id,
        "sin_novedades_informado": state.sin_novedades_informado,
        "novedades": [item.to_dict() for item in state.novedades],
        "pendientes_ambiguos": [item.to_dict() for item in state.pendientes_ambiguos],
        "conflictos_novedad": [item.to_dict() for item in state.conflictos_novedad],
        "errores": result.errors,
        "parte_diario": process_metadata,
    }


def _validate_plan(plan: TurnPlan) -> str | None:
    operation_types = {item.type for item in plan.operations}
    if operation_types & _RESERVED_OPERATIONS:
        return "No pude validar la accion solicitada. Proba nuevamente."
    if operation_types & _MUTATING_OPERATIONS and operation_types & {
        "solicitar_confirmacion",
        "solicitar_cancelacion",
    }:
        return "No pude validar acciones mezcladas en el mismo mensaje. Envialas por separado."
    for operation in plan.operations:
        for value in (operation.horas, operation.horas_extra):
            if value is not None and not 0 <= value <= 24:
                return "Las horas informadas deben estar entre 0 y 24."
        if operation.horas_extra is not None and operation.horas_extra + 9 > 24:
            return "La jornada total no puede superar 24 horas."
    return None


def _has_conversational_draft(state: ParteDiarioState) -> bool:
    return bool(
        state.parte_id
        or state.novedades
        or state.pendientes_ambiguos
        or state.conflictos_novedad
        or state.sin_novedades_informado
    )


def _validate_pending_business_rules(pending: PendienteAmbiguo) -> str | None:
    code = str(pending.estado_codigo or "").upper()
    if pending.horas_extra is not None and code != "P":
        return f"Para {pending.nombre}, las horas extra solo pueden registrarse como PRESENTE."
    if (
        not pending.fuera_de_proyecto
        and code == "P"
        and pending.horas is not None
        and pending.horas < 9
    ):
        return f"Para {pending.nombre}, una jornada menor a 9 horas requiere indicar el motivo."
    return None


def _validate_state_business_rules(state: ParteDiarioState) -> list[str]:
    errors: list[str] = []
    for novedad in state.novedades:
        code = str(novedad.estado_codigo or "").upper()
        if (
            not novedad.fuera_de_proyecto
            and code == "P"
            and novedad.horas is not None
            and novedad.horas < 9
            and not str(novedad.descripcion or "").strip()
        ):
            errors.append(f"Para {novedad.nombre}, una jornada menor a 9 horas requiere indicar el motivo.")
    return errors


def _prepare_pending_validation(
    pending: PendienteAmbiguo,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> None:
    if not pending.nombre_no_encontrado or pending.candidatos:
        return
    candidates = NominaResolver.find_similar(pending.nombre, nominas_proyecto, nominas_completas)
    if candidates:
        pending.candidatos = candidates
        pending.nombre_no_encontrado = False


def _is_unvalidated_selection(text: str, pending: PendienteAmbiguo) -> bool:
    command = _normalize_command(text)
    candidates = pending.candidatos or []
    numbers = re.findall(r"\d+", command)
    if len(numbers) == 1 and int(numbers[0]) == len(candidates) + 1:
        return True
    pending_name = _normalize_command(pending.nombre)
    return command in {
        "registrar sin validar",
        "sin validar",
        "aceptar sin validar",
        f"registrar como {pending_name} sin validar",
    }


def _normalize_command(text: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(text or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _parse_local_readonly_operation(command: str) -> str | None:
    tokens = set(command.split())
    asks_to_show = any(
        token.startswith(("mostr", "muestr", "consult", "resum")) or token == "ver"
        for token in tokens
    )
    if not asks_to_show:
        return None
    if "parte" in tokens:
        return "mostrar_parte"
    if "nomina" in tokens or "personal" in tokens or "empleado" in tokens or "empleados" in tokens:
        return "mostrar_nomina"
    return None


def _normalize_attendance_transcription(
    text: str | None,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> str:
    normalized = _normalize_command(text)
    if "falcon" not in normalized.split():
        return str(text or "")

    active_tokens = {
        token
        for item in [*nominas_proyecto, *nominas_completas]
        for token in normalize_text(f"{item.apellido} {item.nombre}").split()
    }
    if "falcon" in active_tokens:
        return str(text or "")
    return re.sub(r"\bfalc[oó]n\b", "falto", str(text or ""), flags=re.IGNORECASE)


def _today() -> date:
    return datetime.now(BUENOS_AIRES).date()


def _parse_date_reference(value: str | None) -> date | None:
    normalized = _normalize_command(value)
    if normalized == "hoy":
        return _today()
    if normalized == "ayer":
        return _today() - timedelta(days=1)
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError:
        return None


def _append_description(current: str | None, incoming: str) -> str:
    return f"{current}. {incoming}" if current else incoming
