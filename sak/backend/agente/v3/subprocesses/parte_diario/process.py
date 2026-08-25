"""Coordinacion conversacional del proceso parte_diario."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from dataclasses import dataclass, field
import logging
import re
import unicodedata
from types import SimpleNamespace
from typing import Any
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.executor import (
    _registrar_o_encolar_conflicto,
    execute_plan,
    limpiar_conflictos_repetidos,
    registrar_pendiente_resuelto,
    registrar_pendiente_sin_validar,
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
    project_match_score,
    resolve_estado_codigo,
)
from app.models import (
    CRMContacto,
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
    name = "parteDiario"

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
        contacto_id = _parse_optional_int(getattr(ctx, "contacto_id", None))
        estados = self._load_estados()
        nominas_proyecto, nominas_completas = self._load_nominas(project.id, contacto_id=contacto_id)
        state = ParteDiarioState.from_dict(
            ctx.process_state,
            oportunidad_id=ctx.oportunidad_id,
            idproyecto=project.id,
        )
        state.contacto_id = contacto_id
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
            nominas_visibles = (
                self._load_nominas_for_display(
                    project.id,
                    contacto_id=contacto_id,
                    command=command,
                    alcance=None,
                    nominas_completas=nominas_completas,
                )
                if readonly_operation == "mostrar_nomina"
                else None
            )
            return self._from_execution(
                execute_plan(
                    state,
                    TurnPlan(operations=[ParteDiarioOperation(type=readonly_operation)]),
                    nominas_proyecto,
                    nominas_completas,
                    estados,
                    nominas_visibles=nominas_visibles,
                )
            )

        if state.esperando == "confirmacion_cambio_fecha":
            if command == "cambiar fecha":
                return self._apply_confirmed_date_change(state, estados)
            if command == "mantener fecha":
                state.fecha_propuesta = None
                state.esperando = None
                state.validacion_origen = None
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
            fallback_plan = _fallback_simple_attendance_plan(message_text, estados)
            if fallback_plan is None:
                return self._state_reply(
                    state,
                    "No pude interpretar el parte diario. Proba nuevamente con una descripcion breve.",
                )
            plan = fallback_plan

        validation_error = _validate_plan(plan)
        if validation_error:
            return self._state_reply(state, validation_error)

        if not _has_explicit_date_reference(message_text):
            plan.operations = [operation for operation in plan.operations if operation.type != "set_fecha"]

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

        project_error = self._resolve_external_project_operations(plan, int(project.id))
        if project_error:
            return self._state_reply(state, project_error)

        nominas_visibles = (
            self._load_nominas_for_display(
                project.id,
                contacto_id=contacto_id,
                command=message_text,
                alcance=_nomina_scope_from_operations(plan.operations),
                nominas_completas=nominas_completas,
            )
            if any(operation.type == "mostrar_nomina" for operation in plan.operations)
            else None
        )
        result = execute_plan(
            state,
            plan,
            nominas_proyecto,
            nominas_completas,
            estados,
            nominas_visibles=nominas_visibles,
        )
        if plan.is_readonly() and not had_conversational_draft:
            if any(operation.type == "mostrar_parte" for operation in plan.operations):
                result.reply = renderer.consulta(result.next_state)
            result.keep_active = False
        return self._from_execution(result, plan=plan)

    def _resolve_external_project_operations(self, plan: TurnPlan, current_project_id: int) -> str | None:
        for operation in plan.operations:
            if operation.type not in {"agregar_novedad", "modificar_novedad"}:
                continue
            if not operation.fuera_de_proyecto and not operation.nombre_proyecto:
                continue
            if not str(operation.nombre_proyecto or "").strip():
                return "Indica a que obra fue a trabajar."
            resolved_project_id, resolved_project_name, error = self._resolve_external_project_name(
                operation.nombre_proyecto,
                current_project_id,
            )
            if error:
                return error
            operation.fuera_de_proyecto = True
            operation.idproyecto_destino = resolved_project_id
            operation.nombre_proyecto = resolved_project_name
            operation.estado_codigo = operation.estado_codigo or "P"
        return None

    def _resolve_external_project_name(
        self,
        project_text: str | None,
        current_project_id: int,
    ) -> tuple[int | None, str | None, str | None]:
        query = str(project_text or "").strip()
        if not query:
            return None, None, "Indica a que obra fue a trabajar."
        projects = list(
            self._session.exec(
                select(Proyecto)
                .where(Proyecto.deleted_at.is_(None))
                .where(Proyecto.id != current_project_id)
                .order_by(Proyecto.nombre.asc())
            ).all()
        )
        matches = [
            (project_match_score(query, project.nombre), project)
            for project in projects
        ]
        matches = [(score, project) for score, project in matches if score >= 0.55]
        matches.sort(key=lambda pair: (-pair[0], str(pair[1].nombre or "")))
        if not matches:
            return None, None, f"No encontre la obra destino '{query}'. Indica el nombre de la obra."
        best_score, best_project = matches[0]
        close = [project for score, project in matches if best_score - score <= 0.05]
        if len(close) > 1:
            names = ", ".join(str(project.nombre) for project in close[:3])
            return None, None, f"La obra destino '{query}' es ambigua. Opciones: {names}."
        return int(best_project.id), str(best_project.nombre or "").strip(), None

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
            state.validacion_origen = state.validacion_origen or "cierre"
            state.esperando = "resolucion_conflictos"
            return self._state_reply(state, renderer.preguntar_conflicto(state.conflictos_novedad[0]))
        if state.pendientes_ambiguos:
            if not cerrar_parte:
                return self._build_confirmation_result(state, cerrar_parte=False)
            state.validacion_origen = state.validacion_origen or "cierre"
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
            if _is_unvalidated_selection(text, pending):
                unvalidated_name = pending.nombre
                state.pendientes_ambiguos.pop(0)
                registrar_pendiente_sin_validar(state, pending)
                if state.pendientes_ambiguos:
                    _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
                    return self._state_reply(
                        state,
                        f"{unvalidated_name} quedo registrado sin validar.\n\n"
                        f"{renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados)}",
                    )
                state.esperando = None
                return self._after_validation_completed(
                    state,
                    estados,
                    nominas_proyecto,
                    nominas_completas,
                    prefix=f"{unvalidated_name} quedo registrado sin validar.",
                )
            resolved = NominaResolver.resolve(text, nominas_proyecto, nominas_completas)
            if resolved.error:
                _prepare_pending_validation(pending, nominas_proyecto, nominas_completas)
                if state.validacion_origen == "carga" and not pending.candidatos and _looks_like_attendance_update(text):
                    state.esperando = None
                    state.validacion_origen = None
                    return await self.handle(
                        SimpleNamespace(
                            oportunidad_id=state.oportunidad_id,
                            contacto_id=state.contacto_id,
                            is_project=True,
                            active_process=self.name,
                            process_state=state.to_dict(),
                            message=SimpleNamespace(contenido=text),
                        )
                    )
                return self._state_reply(
                    state,
                    renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
                )
            pending.nombre = text.strip() or pending.nombre
            pending.nombre_no_encontrado = False
            if resolved.ambiguo:
                pending.candidatos = resolved.candidatos
                pending.candidatos_externos = resolved.candidatos_externos
                pending.mostrando_candidatos_externos = bool(pending.candidatos) and all(
                    item.fuera_de_proyecto for item in pending.candidatos
                )
                pending.pagina_candidatos = 0
                pending.lista_candidatos_mostrada = False
                return self._state_reply(state, renderer.preguntar_pendiente(pending, estados))
            selected = resolved.match
            if selected is None:
                pending.nombre_no_encontrado = True
                return self._state_reply(state, renderer.preguntar_pendiente(pending, estados))
            pending.candidatos = [selected]
            pending.pagina_candidatos = 0
            pending.lista_candidatos_mostrada = False
            pending.idnomina_resuelto = selected.idnomina
            pending.fuera_de_proyecto = selected.fuera_de_proyecto
            pending.nombre_proyecto = selected.nombre_proyecto
            if pending.estado_pendiente:
                return self._state_reply(state, renderer.preguntar_estado(pending, estados))

        if pending.nombre_pendiente:
            if _is_unvalidated_selection(text, pending):
                unvalidated_name = pending.nombre
                state.pendientes_ambiguos.pop(0)
                registrar_pendiente_sin_validar(state, pending)
                if state.pendientes_ambiguos:
                    _prepare_pending_validation(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
                    return self._state_reply(
                        state,
                        f"{unvalidated_name} quedo registrado sin validar.\n\n"
                        f"{renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados)}",
                    )
                state.esperando = None
                return self._after_validation_completed(
                    state,
                    estados,
                    nominas_proyecto,
                    nominas_completas,
                    prefix=f"{unvalidated_name} quedo registrado sin validar.",
                )
            if _is_other_candidates_command(text, pending):
                pending.mostrando_candidatos_externos = True
                pending.lista_candidatos_mostrada = False
                return self._state_reply(state, renderer.preguntar_pendiente(pending, estados))
            candidates = _active_validation_candidates(pending)
            if not pending.lista_candidatos_mostrada:
                return self._state_reply(
                    state,
                    renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
                )
            offset, visible_count = _candidate_page_selection_window(candidates, pending.pagina_candidatos)
            selected = parse_candidate_selection(
                text,
                candidates,
                offset=offset,
                visible_count=visible_count,
            )
            if selected is None:
                if state.validacion_origen == "carga":
                    state.esperando = None
                    state.validacion_origen = None
                    return await self.handle(
                        SimpleNamespace(
                            oportunidad_id=state.oportunidad_id,
                            contacto_id=state.contacto_id,
                            is_project=True,
                            active_process=self.name,
                            process_state=state.to_dict(),
                            message=SimpleNamespace(contenido=text),
                        )
                    )
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
        if state.validacion_origen == "carga":
            state.esperando = None
            state.validacion_origen = None
            result = self._state_reply(state, renderer.actualizado(state))
            if prefix and result.payload.get("reply_to_user"):
                result.payload["reply_to_user"] = f"{prefix}\n\n{result.payload['reply_to_user']}"
            return result
        state.esperando = "confirmacion_cierre_validado"
        state.validacion_origen = "cierre"
        result = self._state_reply(state, renderer.confirmar_cierre_validado(state))
        if prefix and result.payload.get("reply_to_user"):
            result.payload["reply_to_user"] = f"{prefix}\n\n{result.payload['reply_to_user']}"
        return result

    def _apply_confirmed_date_change(self, state: ParteDiarioState, estados: list[EstadoItem]) -> TurnResult:
        proposed = state.fecha_propuesta
        state.fecha_propuesta = None
        state.esperando = None
        state.validacion_origen = None
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
        existing = self._find_parte(int(state.idproyecto or 0), target_date, contacto_id=state.contacto_id)
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

    def _find_parte(self, idproyecto: int, fecha: str, *, contacto_id: int | None = None) -> ParteDiario | None:
        base_query = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto == idproyecto)
            .where(ParteDiario.fecha == date.fromisoformat(fecha))
            .where(ParteDiario.deleted_at.is_(None))
        )
        if contacto_id:
            parte = self._session.exec(base_query.where(ParteDiario.contacto_id == contacto_id)).first()
            if parte is not None:
                return parte
            return self._session.exec(base_query.where(ParteDiario.contacto_id.is_(None))).first()
        return self._session.exec(base_query).first()

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
                    nro_legajo=nomina.nro_legajo,
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

    def _load_nominas(
        self,
        idproyecto: int,
        *,
        contacto_id: int | None = None,
        filtrar_por_contacto: bool = True,
    ) -> tuple[list[NominaItem], list[NominaItem]]:
        projects = {item.id: item.nombre for item in self._session.exec(select(Proyecto)).all()}
        today = _today()
        rows = self._session.exec(
            select(Nomina)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
            .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= today))
            .order_by(Nomina.apellido, Nomina.nombre)
        ).all()
        encargado_ids = {
            int(item.encargado_contacto_id)
            for item in rows
            if item.encargado_contacto_id is not None
        }
        encargados = {}
        if encargado_ids:
            contacts = self._session.exec(select(CRMContacto).where(CRMContacto.id.in_(encargado_ids))).all()
            encargados = {
                int(contact.id): _contact_label(contact)
                for contact in contacts
                if contact.id is not None
            }
        all_items = [
            NominaItem(
                idnomina=int(item.id),
                nombre=item.nombre,
                apellido=item.apellido,
                idproyecto=item.idproyecto,
                nombre_proyecto=projects.get(item.idproyecto),
                fuera_de_proyecto=item.idproyecto != idproyecto,
                nro_legajo=item.nro_legajo,
                encargado_contacto_id=item.encargado_contacto_id,
                encargado_nombre=(
                    encargados.get(int(item.encargado_contacto_id))
                    if item.encargado_contacto_id is not None and item.encargado_contacto_id != contacto_id
                    else None
                ),
            )
            for item in rows
        ]
        project_items = [item for item in all_items if item.idproyecto == idproyecto]
        if filtrar_por_contacto and contacto_id is not None:
            assigned_to_contact = [
                item
                for item in project_items
                if item.encargado_contacto_id is not None and int(item.encargado_contacto_id) == contacto_id
            ]
            if assigned_to_contact:
                project_items = assigned_to_contact
        return project_items, all_items

    def _load_nominas_for_display(
        self,
        idproyecto: int,
        *,
        contacto_id: int | None,
        command: str,
        alcance: str | None,
        nominas_completas: list[NominaItem],
    ) -> list[NominaItem]:
        if _requests_global_nomina(command) or alcance == "global":
            return nominas_completas
        if _requests_full_nomina(command) or alcance == "obra":
            nominas_proyecto, _ = self._load_nominas(
                idproyecto,
                contacto_id=contacto_id,
                filtrar_por_contacto=False,
            )
            return nominas_proyecto
        nominas_proyecto, _ = self._load_nominas(
            idproyecto,
            contacto_id=contacto_id,
            filtrar_por_contacto=True,
        )
        return nominas_proyecto

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
        "confirmar_parte": result.cerrar_parte,
        "close_after_materialization": result.parte_listo,
        "cancelado": result.cancelado,
        "oportunidad_id": state.oportunidad_id,
        "idproyecto": state.idproyecto,
        "contacto_id": state.contacto_id,
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


def _fallback_simple_attendance_plan(message: str | None, estados: list[EstadoItem]) -> TurnPlan | None:
    """Parsea reportes simples si el LLM falla, sin cubrir consultas ni correcciones."""
    active_codes = {item.abreviatura.upper() for item in estados}
    operations: list[ParteDiarioOperation] = _parse_plural_absence_operations(message, active_codes)
    for segment in _split_simple_attendance_segments(message):
        operation = _parse_simple_attendance_segment(segment, active_codes)
        if operation is not None:
            operations.append(operation)
    if not operations:
        return None
    return TurnPlan(operations=operations)


def _parse_plural_absence_operations(
    message: str | None,
    active_codes: set[str],
) -> list[ParteDiarioOperation]:
    if "FAL" not in active_codes:
        return []
    normalized = _normalize_command(message)
    match = re.match(r"^faltaron\s+(?P<nombres>.+)$", normalized)
    if not match:
        return []
    names = [
        _clean_simple_name(name)
        for name in re.split(r"[,;\n]+|\s+y\s+", match.group("nombres"), flags=re.IGNORECASE)
        if _clean_simple_name(name)
    ]
    return [
        ParteDiarioOperation(type="agregar_novedad", nombre=name, estado_codigo="FAL")
        for name in names
    ]


def _split_simple_attendance_segments(message: str | None) -> list[str]:
    text = str(message or "").strip()
    if not text:
        return []
    parts = re.split(r"[,;\n]+|\s+y\s+", text, flags=re.IGNORECASE)
    return [part.strip(" .") for part in parts if part.strip(" .")]


def _parse_simple_attendance_segment(
    segment: str,
    active_codes: set[str],
) -> ParteDiarioOperation | None:
    normalized = _normalize_command(segment)
    hours = _parse_simple_hours(normalized)

    absence_prefix = re.match(
        r"^(?:falto|falta|no\s+vino|no\s+trabajo)\s+(?P<nombre>.+?)"
        r"(?:\s+\d{1,2}(?:[,.]\d+)?\s*(?:h|hs|horas?))?$",
        normalized,
    )
    if absence_prefix and "FAL" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(absence_prefix.group("nombre")),
            estado_codigo="FAL",
        )

    absence_suffix = re.match(
        r"^(?P<nombre>.+?)\s+(?:falto|falta|no\s+vino|no\s+trabajo)$",
        normalized,
    )
    if absence_suffix and "FAL" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(absence_suffix.group("nombre")),
            estado_codigo="FAL",
        )

    illness = re.match(
        r"^(?P<nombre>.+?)\s+(?:esta\s+)?(?:enfermo|enferma|enfermedad)$",
        normalized,
    )
    if illness and "ENF" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(illness.group("nombre")),
            estado_codigo="ENF",
        )

    worked = re.match(
        r"^(?P<nombre>.+?)\s+(?:trabajo|vino|presente)(?:\s+\d{1,2}(?:[,.]\d+)?\s*(?:h|hs|horas?))?$",
        normalized,
    )
    if worked and "P" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(worked.group("nombre")),
            estado_codigo="P",
            horas=hours,
        )

    return None


def _parse_simple_hours(normalized_segment: str) -> float | None:
    match = re.search(r"\b(\d{1,2}(?:[,.]\d+)?)\s*(?:h|hs|horas?)\b", normalized_segment)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def _clean_simple_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip(" .")


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
    project_candidates, external_candidates = NominaResolver.find_similar_grouped(
        pending.nombre,
        nominas_proyecto,
        nominas_completas,
    )
    candidates = project_candidates or external_candidates
    if candidates:
        pending.candidatos = candidates
        pending.candidatos_externos = external_candidates
        pending.mostrando_candidatos_externos = not bool(project_candidates)
        pending.nombre_no_encontrado = False
        pending.pagina_candidatos = 0
        pending.lista_candidatos_mostrada = False


def _candidate_page_selection_window(candidates: list[NominaItem], page: int) -> tuple[int, int]:
    return 0, len(candidates)


def _is_unvalidated_selection(text: str, pending: PendienteAmbiguo) -> bool:
    command = _normalize_command(text)
    candidates = _active_validation_candidates(pending)
    numbers = re.findall(r"\d+", command)
    offset, visible_count = _candidate_page_selection_window(candidates, pending.pagina_candidatos)
    has_more = offset + visible_count < len(candidates) or (
        not pending.mostrando_candidatos_externos and bool(pending.candidatos_externos)
    )
    row_count = visible_count + (1 if has_more else 0)
    if len(numbers) == 1:
        return int(numbers[0]) == row_count + 1
    pending_name = _normalize_command(pending.nombre)
    return command in {
        "ninguno",
        "ninguna",
        "ninguno de esos",
        "ninguna de esas",
        "registrar sin validar",
        "sin validar",
        "aceptar sin validar",
        f"registrar como {pending_name} sin validar",
    }


def _is_other_candidates_command(text: str, pending: PendienteAmbiguo) -> bool:
    return _normalize_command(text) == "otros" and bool(pending.candidatos_externos)


def _active_validation_candidates(pending: PendienteAmbiguo) -> list[NominaItem]:
    if pending.mostrando_candidatos_externos and pending.candidatos_externos:
        return pending.candidatos_externos
    return pending.candidatos or pending.candidatos_externos or []


def _looks_like_attendance_update(text: str | None) -> bool:
    tokens = set(_normalize_command(text).split())
    update_terms = {
        "falto",
        "falta",
        "faltaron",
        "ausente",
        "enfermo",
        "enfermedad",
        "accidente",
        "vacaciones",
        "permiso",
        "presente",
        "trabajo",
        "vino",
        "horas",
        "hora",
        "hs",
    }
    return bool(tokens & update_terms)


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


def _requests_full_nomina(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    full_phrases = {
        "toda la nomina",
        "toda nomina",
        "toda la obra",
        "toda obra",
        "todas las nominas",
        "todas nominas",
        "nomina completa",
        "nomina general",
        "nomina global",
        "personal completo",
        "personal general",
        "personal global",
        "todo el personal",
        "todos los empleados",
        "todos los empleados de la obra",
    }
    if any(phrase in command for phrase in full_phrases):
        return True
    tokens = set(command.split())
    return bool(
        "nomina" in tokens
        and ({"toda", "todas", "completa", "completo", "general", "global"} & tokens)
    )


def _nomina_scope_from_operations(operations: list[ParteDiarioOperation]) -> str | None:
    for operation in operations:
        if operation.type == "mostrar_nomina" and operation.alcance in {"propia", "obra", "global"}:
            return operation.alcance
    return None


def _requests_global_nomina(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    global_phrases = {
        "toda la empresa",
        "toda empresa",
        "todas las obras",
        "todas obras",
        "todos los proyectos",
        "todos proyectos",
        "no solo la obra",
        "no solo esta obra",
        "no solo de esta obra",
        "no solo la de esta obra",
    }
    return any(phrase in command for phrase in global_phrases)


def _has_explicit_date_reference(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    tokens = set(command.split())
    relative_terms = {
        "hoy",
        "ayer",
        "anteayer",
        "anteanoche",
        "manana",
        "pasado",
        "pasada",
        "anterior",
        "fecha",
        "dia",
    }
    weekdays = {"lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"}
    if tokens & relative_terms or tokens & weekdays:
        return True
    if re.search(r"\b\d{1,2}\s*(?:/|-)\s*\d{1,2}(?:\s*(?:/|-)\s*\d{2,4})?\b", command):
        return True
    if re.search(
        r"\b\d{1,2}\s+de\s+"
        r"(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b",
        command,
    ):
        return True
    return False


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


def _parse_optional_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _contact_label(contact: CRMContacto) -> str:
    return str(contact.nombre_completo or contact.email or contact.id)
