"""Despacho por estado del parte diario: carga, revision, persistencia y salida."""

from __future__ import annotations

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.emisor import V3MessageEmitter
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.adapters.carga_agent import ParteDiarioCargaAgentClient
from agente.v3.subprocesses.parte_diario.adapters.query_agent import ParteDiarioQueryAgentClient
from agente.v3.subprocesses.parte_diario.flows import aclaracion, comandos, carga, confirmar_salida, continuar, entrada, fecha, listado, revision, validacion_carga
from agente.v3.subprocesses.parte_diario.domain import obras
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.domain.obras import project_match_score
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State


# Despacha cada mensaje al flujo que corresponde a su estado conversacional.
class ParteDiarioSubprocess:

    name = "parteDiario"

    # Prepara los adaptadores de interpretacion, consultas y aclaraciones de empleados.
    def __init__(self, llm_client=None, query_agent_client=None, carga_agent_client=None) -> None:
        self._llm = llm_client or ParteDiarioLLMClient()
        self._query_agent = query_agent_client or ParteDiarioQueryAgentClient()
        self._carga_agent = carga_agent_client or ParteDiarioCargaAgentClient()

    # Ejecuta la etapa correspondiente y devuelve una unica respuesta con contexto.
    async def handle(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        # Lectura del estado establecido por el turno anterior.
        state = ParteDiarioV3State.from_dict(context.process_state)
        texto = message.text or ""
        if state.etapa in {"cargar_fecha", "seleccionar_fecha", "pendientes"}:
            texto = None
        respuesta = comandos.procesar(message.text or "", state)
        metadata = {}
        respuesta_guardado = None

        # Solo las transiciones sin pregunta continuan dentro del mismo turno.
        while respuesta is None:
            match state.etapa:
                case "inicial":
                    if entrada.es_menu_inicial(message.text):
                        respuesta = entrada.iniciar(state)
                    else:
                        respuesta = self._seleccionar_obra(message, state)
                        tokens = set(normalize_text(message.text).split())
                        if (
                            tokens & {"parte", "partes"}
                            or fecha.es_fecha_numerica(message.text or "")
                            or entrada.es_reportar(message.text)
                            or entrada.es_pendientes(message.text)
                        ):
                            texto = None
                case "seleccionar_accion":
                    respuesta = entrada.procesar(texto, state)
                    if respuesta is None:
                        accion = "partes pendientes" if state.modo_pendientes else "reportar"
                        respuesta = self._seleccionar_obra(message, state, texto_inicial=accion)
                    texto = None
                case "seleccionar_obra":
                    inicial = state.etapa == "inicial"
                    respuesta = self._seleccionar_obra(message, state)
                    tokens = set(normalize_text(message.text).split())
                    if not inicial or tokens & {"parte", "partes"} or fecha.es_fecha_numerica(message.text or ""):
                        texto = None
                case "cargar_fecha" | "seleccionar_fecha" | "pendientes":
                    respuesta = await fecha.procesar(message, state, self._llm)
                    if state.etapa == "carga":
                        respuesta = None
                case "carga":
                    respuesta = await carga.procesar(texto, state, self._llm, self._query_agent)
                case "carga_aclaracion":
                    respuesta = await aclaracion.procesar(texto, state, self._llm)
                case "listado":
                    respuesta = await listado.procesar(texto, state, self._llm)
                case etapa if etapa in validacion_carga.ETAPAS:
                    respuesta = await validacion_carga.procesar(texto, state, self._llm, self._carga_agent)
                case "revision":
                    respuesta, metadata = revision.procesar(message, state)
                    if state.etapa == "cargar_fecha":
                        respuesta_guardado = respuesta
                        respuesta = None
                        texto = None
                case "confirmar_salida":
                    respuesta = confirmar_salida.procesar(texto, state)
                case "continuar":
                    respuesta = continuar.procesar(texto, state)
                    texto = None
                case "finalizado":
                    break
                case _:
                    raise ValueError(f"Etapa de parte diario sin flujo: {state.etapa}")

        # Respuesta y actualizacion de contexto.
        if respuesta_guardado:
            respuesta = f"{respuesta_guardado}\n\n{respuesta or ''}".strip()
        return self._responder(context, state, respuesta, metadata, message.text or "")

    # Resuelve una obra asociada al remitente o solicita elegir entre sus opciones.
    def _seleccionar_obra(
        self,
        message: V3InboundMessage,
        state: ParteDiarioV3State,
        *,
        texto_inicial: str | None = None,
    ) -> str | None:
        effective_text = texto_inicial if texto_inicial is not None else (message.text or "")
        command = normalize_text(effective_text)
        if command == "salir":
            state.etapa = "finalizado"
            return "Carga de parte diario cancelada."
        seleccion_pendiente = bool(state.opciones_obra)
        options = state.opciones_obra or obras.resolver_obras_por_telefono(message.from_address)
        if not options:
            state.etapa = "finalizado"
            return "No encontre una obra asociada para cargar el parte diario."

        selected = next((item for item in options if str(item.opcion) == command), None)
        if selected is None and len(options) == 1:
            selected = options[0]
        if selected is None:
            excluded = {"parte", "partes", "diario", "diarios", "cargar", "carga", "cargo",
                        "obra", "obras", "pendiente", "pendientes", "de", "del", "la", "el",
                        "en", "para", "por", "quiero", "necesito"}
            query = " ".join(token for token in command.split() if token not in excluded)
            matches = [item for item in options if query and project_match_score(query, item.nombre) >= 0.75]
            selected = matches[0] if len(matches) == 1 else None

        if not seleccion_pendiente:
            state.texto_fecha_inicial = effective_text
            state.modo_pendientes = entrada.es_pendientes(effective_text)
            state.modo_apertura = "puntual" if state.modo_pendientes else "diario"
        if selected is None:
            state.etapa = "seleccionar_obra"
            state.opciones_obra = options
            menu = "\n".join(f"{item.opcion}: {item.nombre}" for item in options)
            return f"En que obra queres cargar el parte diario?\n{menu}"
        state.set_obra(selected)
        state.etapa = "cargar_fecha"
        return None

    # Serializa el estado y construye la respuesta que enviara el orquestador.
    def _responder(
        self, context: V3ConversationContext, state: ParteDiarioV3State, respuesta: str | None,
        metadata: dict, mensaje: str,
    ) -> V3ProcessResult:
        updated = context.copy()
        finalizado = state.etapa == "finalizado"
        updated.active_process = "general" if finalizado else self.name
        reply = respuesta or "Finalizamos la seleccion de partes diarios."
        if finalizado:
            if not metadata.get("parte_listo") and state.accion_cierre not in {"descartar", "salir"}:
                reply = f"{reply}\n\n{GENERAL_MENU_TEXT}"
        else:
            state.registrar_turno(mensaje, reply)
        updated.process_state = {} if finalizado else state.to_dict()
        return V3ProcessResult(
            context=updated,
            reply_text=reply,
            metadata={"process_name": self.name, "etapa": state.etapa,
                      "status": "returned_to_general" if finalizado else "active",
                      "handler_version": "revision", "accion_cierre": state.accion_cierre,
                      "idproyecto": state.proyecto_id, "contacto_id": state.contacto_id,
                      "nombre_obra": state.nombre_obra,
                      **metadata},
        )
