from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional
import os
import json

from sqlmodel import Session, select

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
    CRMTipoEvento,
    CRMMotivoEvento,
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
        
        # Log para debugging
        print(f"DEBUG _crear_contacto_si_necesario:")
        print(f"  - nombre: {repr(nombre)}")
        print(f"  - referencia: {repr(referencia)}")
        print(f"  - responsable_id: {repr(responsable_id)}")
        print(f"  - data completo: {data}")
        
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
        required_fields = ["tipo_operacion_id", "responsable_id"]
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

    def _obtener_catalogo_id(
        self,
        session: Session,
        model,
        codigo: str,
        nombre_catalogo: str,
    ) -> int:
        registro = session.exec(
            select(model).where(model.codigo == codigo)
        ).first()
        if registro:
            return registro.id
        registro = session.exec(select(model).limit(1)).first()
        if registro:
            return registro.id
        raise ValueError(f"No hay registros configurados para {nombre_catalogo}")

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
        mensaje.set_estado(EstadoMensaje.RECIBIDO.value)
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        return mensaje

    def crear_oportunidad_desde_mensaje(
        self,
        session: Session,
        mensaje_id: int,
        payload: Dict[str, Any],
    ) -> CRMMensaje:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")

        tipo_operacion_id = payload.get("tipo_operacion_id")
        nombre_oportunidad = payload.get("nombre_oportunidad")
        responsable_id = payload.get("responsable_id") or mensaje.responsable_id

        if not tipo_operacion_id:
            raise ValueError("tipo_operacion_id es obligatorio")
        if not nombre_oportunidad:
            raise ValueError("nombre de la oportunidad es obligatorio")
        if not responsable_id:
            raise ValueError("responsable_id es obligatorio")

        contacto_id = mensaje.contacto_id
        if contacto_id is None:
            contacto_nombre = payload.get("contacto_nombre")
            if not contacto_nombre:
                raise ValueError("El campo contacto_nombre es obligatorio si no existe contacto asociado")
            referencia = (
                payload.get("contacto_referencia")
                or mensaje.contacto_referencia
                or mensaje.origen_externo_id
                or mensaje.contacto_alias
                or mensaje.contenido[:64]  # type: ignore
                if mensaje.contenido
                else contacto_nombre
            )
            contacto_payload = {
                "nombre": contacto_nombre,
                "referencia": referencia,
                "responsable_id": responsable_id,
            }
            contacto = self._crear_contacto_si_necesario(session, contacto_payload)
            contacto_id = contacto.id

        oportunidad_payload: Dict[str, Any] = {
            "contacto_id": contacto_id,
            "tipo_operacion_id": tipo_operacion_id,
            "emprendimiento_id": payload.get("emprendimiento_id"),
            "responsable_id": responsable_id,
            "descripcion_estado": nombre_oportunidad,
            "descripcion": payload.get("descripcion"),
            "propiedad_id": payload.get("propiedad_id"),
            "fecha_estado": datetime.now(UTC),
        }
        oportunidad = crm_oportunidad_crud.create(session, oportunidad_payload)

        mensaje.contacto_id = contacto_id
        mensaje.oportunidad_id = oportunidad.id
        
        # Cambiar estado a "recibido" solo si el estado actual es "nuevo"
        if mensaje.estado == EstadoMensaje.NUEVO.value:
            mensaje.estado = EstadoMensaje.RECIBIDO.value
        
        session.add(mensaje)
        try:
            tipo_evento_id = self._obtener_catalogo_id(
                session, CRMTipoEvento, "crear", "tipos de evento"
            )
            motivo_evento_id = self._obtener_catalogo_id(
                session, CRMMotivoEvento, "crear", "motivos de evento"
            )
            self._crear_evento(
                session=session,
                contacto_id=contacto_id,
                oportunidad_id=oportunidad.id,
                data={
                    "tipo_id": tipo_evento_id,
                    "motivo_id": motivo_evento_id,
                    "descripcion": f"Oportunidad #{oportunidad.id} creada desde mensaje #{mensaje.id}",
                    "asignado_a_id": responsable_id,
                    "fecha_evento": datetime.now(UTC),
                    "estado_evento": "hecho",
                },
            )
        except ValueError:
            # Si no hay catálogos configurados, continuar sin evento explícito
            pass
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

    def responder_mensaje(
        self,
        session: Session,
        mensaje_id: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Responde a un mensaje creando:
        - Contacto (si no existe)
        - Oportunidad en estado 0-prospect (si no existe)
        - Mensaje de salida
        - Actualiza el mensaje original a 'recibido' si estaba en 'nuevo'
        
        Args:
            session: Sesión de base de datos
            mensaje_id: ID del mensaje original
            payload: {
                "asunto": str,
                "contenido": str,
                "contacto_nombre": str (obligatorio si no existe contacto_id)
            }
        
        Returns:
            {
                "mensaje_salida": CRMMensaje,
                "contacto_creado": bool,
                "contacto_id": int,
                "oportunidad_creada": bool,
                "oportunidad_id": int,
            }
        """
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")
        
        # Validar contenido
        contenido = payload.get("contenido")
        if not contenido or not contenido.strip():
            raise ValueError("El contenido de la respuesta es obligatorio")
        
        asunto = payload.get("asunto", "")
        if not asunto:
            asunto = f"RE: {mensaje.asunto}" if mensaje.asunto else "RE:"
        elif not asunto.upper().startswith("RE:"):
            asunto = f"RE: {asunto}"
        
        # Gestionar contacto
        contacto_id = mensaje.contacto_id
        contacto_creado = False
        
        if contacto_id is None:
            contacto_nombre = payload.get("contacto_nombre")
            if not contacto_nombre or not contacto_nombre.strip():
                raise ValueError("El campo contacto_nombre es obligatorio cuando no existe un contacto asociado")
            
            # Validar que haya responsable_id
            if not mensaje.responsable_id:
                raise ValueError("El mensaje debe tener un responsable_id asignado para crear el contacto")
            
            # Crear contacto
            referencia = (
                mensaje.contacto_referencia
                or mensaje.origen_externo_id
                or mensaje.contacto_alias
                or contacto_nombre
            )
            
            contacto_payload = {
                "nombre": contacto_nombre.strip(),
                "referencia": referencia,
                "responsable_id": mensaje.responsable_id,
            }
            contacto = self._crear_contacto_si_necesario(session, contacto_payload)
            contacto_id = contacto.id
            contacto_creado = True
            
            # Actualizar el mensaje original con el contacto
            mensaje.contacto_id = contacto_id
        
        # Gestionar oportunidad
        oportunidad_id = mensaje.oportunidad_id
        oportunidad_creada = False
        
        if oportunidad_id is None:
            # Crear oportunidad en estado 0-prospect
            oportunidad_payload = {
                "contacto_id": contacto_id,
                "estado": "0-prospect",
                "fecha_estado": datetime.now(UTC),
                "tipo_operacion_id": None,
                "descripcion": mensaje.contenido or "Consulta inicial",
                "descripcion_estado": mensaje.asunto or "Nueva oportunidad",
                "responsable_id": mensaje.responsable_id,
                "activo": True,
            }
            oportunidad = crm_oportunidad_crud.create(session, oportunidad_payload)
            oportunidad_id = oportunidad.id
            oportunidad_creada = True
            
            # Actualizar el mensaje original con la oportunidad
            mensaje.oportunidad_id = oportunidad_id
        
        # Crear mensaje de salida (respuesta)
        mensaje_salida_payload = {
            "tipo": TipoMensaje.SALIDA.value,
            "canal": mensaje.canal,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
            "asunto": asunto,
            "contenido": contenido.strip(),
            "estado": EstadoMensaje.PENDIENTE_ENVIO.value,
            "fecha_mensaje": datetime.now(UTC).isoformat(),
            "responsable_id": mensaje.responsable_id,
            "contacto_referencia": mensaje.contacto_referencia,
        }
        mensaje_salida = crm_mensaje_crud.create(session, mensaje_salida_payload)
        
        # Actualizar estado del mensaje original si es necesario
        if mensaje.estado == EstadoMensaje.NUEVO.value:
            mensaje.estado = EstadoMensaje.RECIBIDO.value
        
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        session.refresh(mensaje_salida)
        
        return {
            "mensaje_salida": mensaje_salida,
            "contacto_creado": contacto_creado,
            "contacto_id": contacto_id,
            "oportunidad_creada": oportunidad_creada,
            "oportunidad_id": oportunidad_id,
        }


crm_mensaje_service = CRMMensajeService()
