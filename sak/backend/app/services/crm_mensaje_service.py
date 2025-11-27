from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional
import os
import json

from sqlmodel import Session

from app.services.pdf_extraction_service import OPENAI_AVAILABLE
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.crud.crm_evento_crud import crm_evento_crud
from app.crud.crm_oportunidad_crud import crm_oportunidad_crud
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.models import (
    CRMMensaje,
    CRMContacto,
    CRMOportunidad,
    CRMEvento,
    EstadoMensaje,
    TipoMensaje,
)


class CRMMensajeService:
    """Orquesta las acciones compuestas del flujo de mensajes."""
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

    def _crear_contacto_si_necesario(
        self, session: Session, data: Dict[str, Any]
    ) -> CRMContacto:
        nombre = data.get("nombre")
        referencia = data.get("referencia")
        responsable_id = data.get("responsable_id")
        if not nombre or not referencia or not responsable_id:
            raise ValueError("nombre, referencia y responsable_id son obligatorios para crear contacto")
        payload = {
            "nombre_completo": nombre,
            "telefonos": [referencia] if referencia and "@" not in referencia else [],
            "email": referencia if referencia and "@" in referencia else None,
            "responsable_id": responsable_id,
        }
        contacto = crm_contacto_crud.create(session, payload)
        return contacto

    def _crear_oportunidad_si_necesario(
        self,
        session: Session,
        contacto_id: int,
        payload: Optional[Dict[str, Any]],
    ) -> Optional[CRMOportunidad]:
        if not payload:
            return None
        required_fields = ["tipo_operacion_id", "propiedad_id", "responsable_id"]
        missing = [f for f in required_fields if payload.get(f) is None]
        if missing:
            raise ValueError(f"Faltan campos obligatorios para oportunidad: {', '.join(missing)}")
        data = {
            **payload,
            "contacto_id": contacto_id,
        }
        return crm_oportunidad_crud.create(session, data)

    def _crear_evento(
        self,
        session: Session,
        contacto_id: int,
        oportunidad_id: Optional[int],
        data: Dict[str, Any],
    ) -> CRMEvento:
        required_fields = ["tipo_id", "motivo_id", "descripcion", "asignado_a_id"]
        missing = [f for f in required_fields if data.get(f) is None]
        if missing:
            raise ValueError(f"Faltan campos obligatorios para evento: {', '.join(missing)}")
        fecha_evento = data.get("fecha_evento")
        if not fecha_evento:
            fecha_evento = datetime.now(UTC).isoformat()
        evento_payload = {
            **data,
            "fecha_evento": fecha_evento,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
        }
        return crm_evento_crud.create(session, evento_payload)

    def confirmar(self, session: Session, mensaje_id: int, payload: Dict[str, Any]) -> CRMMensaje:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")
        if mensaje.tipo != TipoMensaje.ENTRADA.value:
            raise ValueError("Solo se pueden confirmar mensajes de entrada")
        if mensaje.estado != EstadoMensaje.NUEVO.value:
            raise ValueError("El mensaje ya fue procesado o no esta en estado nuevo")

        contacto_id = payload.get("contacto_id")
        contacto_nuevo = payload.get("contacto_nuevo")
        if contacto_id is None and contacto_nuevo:
            contacto = self._crear_contacto_si_necesario(session, contacto_nuevo)
            contacto_id = contacto.id

        if contacto_id is None:
            raise ValueError("Se requiere contacto_id o datos de contacto_nuevo para confirmar")

        oportunidad_id = payload.get("oportunidad_id")
        oportunidad_nueva = payload.get("oportunidad_nueva")
        oportunidad = None
        if oportunidad_id is None and oportunidad_nueva:
            oportunidad = self._crear_oportunidad_si_necesario(session, contacto_id, oportunidad_nueva)
            oportunidad_id = oportunidad.id if oportunidad else None

        evento_data = payload.get("evento") or {}
        evento = self._crear_evento(session, contacto_id, oportunidad_id, evento_data)

        mensaje.contacto_id = contacto_id
        mensaje.evento_id = evento.id
        mensaje.oportunidad_id = oportunidad_id
        mensaje.set_estado(EstadoMensaje.CONFIRMADO.value)
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        return mensaje

    def sugerir_llm(self, session: Session, mensaje_id: int, force: bool = False) -> Dict[str, Any]:
        if not OPENAI_AVAILABLE:
            raise ValueError("OpenAI no está disponible en este entorno")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY no configurada")

        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")

        if mensaje.metadata_json and mensaje.metadata_json.get("llm_suggestions") and not force:
            return mensaje.metadata_json.get("llm_suggestions")

        try:
            import openai  # type: ignore
        except ImportError:
            raise ValueError("OpenAI no está instalado")

        client = openai.OpenAI(api_key=self.openai_api_key)
        prompt = (
            "Eres un asistente que analiza mensajes de clientes. "
            "Devuelve un JSON con: contacto_sugerido (nombre/email/telefono si lo ves), "
            "propiedad_sugerida (si se menciona), oportunidad_tipo (breve texto) y resumen."
            f"\nCanal: {mensaje.canal}\nContenido:\n{mensaje.contenido or ''}"
        )
        completion = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            response_format={"type": "json_object"},
            max_output_tokens=800,
        )
        raw = completion.output[0].content[0].text  # type: ignore
        try:
            suggestions = json.loads(raw)
        except Exception:
            suggestions = {"raw": raw}

        metadata = mensaje.metadata_json or {}
        metadata["llm_suggestions"] = suggestions
        mensaje.metadata_json = metadata
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        return suggestions

    def reintentar_salida(self, session: Session, mensaje_id: int) -> CRMMensaje:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")
        if mensaje.tipo != TipoMensaje.SALIDA.value:
            raise ValueError("Solo aplica a mensajes de salida")
        if mensaje.estado != EstadoMensaje.ERROR_ENVIO.value:
            raise ValueError("Solo se puede reintentar desde estado error_envio")
        mensaje.set_estado(EstadoMensaje.PENDIENTE_ENVIO.value)
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        return mensaje


crm_mensaje_service = CRMMensajeService()
