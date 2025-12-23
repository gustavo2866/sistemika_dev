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
    CanalMensaje,
    EstadoEvento,
    EstadoOportunidad,
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
            "titulo": nombre_oportunidad,
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
                "contacto_nombre": str (obligatorio si no existe contacto_id),
                "responsable_id": int (opcional, se usa del mensaje si no se provee)
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
        
        # Determinar responsable priorizando la oportunidad
        responsable_id: Optional[int] = None
        oportunidad_context: Optional[CRMOportunidad] = None
        contacto_context: Optional[CRMContacto] = None

        if mensaje.oportunidad_id:
            oportunidad_context = mensaje.oportunidad or session.get(CRMOportunidad, mensaje.oportunidad_id)
            if oportunidad_context and oportunidad_context.responsable_id:
                responsable_id = oportunidad_context.responsable_id

        if not responsable_id:
            responsable_id = payload.get("responsable_id") or mensaje.responsable_id

        if not responsable_id and mensaje.contacto_id:
            contacto_context = session.get(CRMContacto, mensaje.contacto_id)
            if contacto_context and contacto_context.responsable_id:
                responsable_id = contacto_context.responsable_id

        if not responsable_id:
            raise ValueError(
                "No se puede procesar la respuesta: el mensaje no tiene un responsable asignado. "
                "Por favor, asigna un responsable al mensaje, a la oportunidad asociada o proporciona un responsable_id en el payload."
            )
        
        # Gestionar contacto
        contacto_id = mensaje.contacto_id
        contacto_creado = False
        
        if contacto_id is None:
            contacto_nombre = payload.get("contacto_nombre")
            if not contacto_nombre or not contacto_nombre.strip():
                raise ValueError("El campo contacto_nombre es obligatorio cuando no existe un contacto asociado")
            
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
                "responsable_id": responsable_id,
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
            tipo_operacion_seleccionada = payload.get("tipo_operacion_id")
            if tipo_operacion_seleccionada is None:
                raise ValueError(
                    "tipo_operacion_id es obligatorio para crear la oportunidad desde la respuesta"
                )
            try:
                tipo_operacion_id = int(tipo_operacion_seleccionada)
            except (TypeError, ValueError):
                raise ValueError("tipo_operacion_id es inválido")

            # Crear oportunidad en estado 0-prospect
            titulo_oportunidad = mensaje.asunto or "Nueva oportunidad"
            oportunidad_payload = {
                "contacto_id": contacto_id,
                "estado": "0-prospect",
                "fecha_estado": datetime.now(UTC),
                "tipo_operacion_id": tipo_operacion_id,
                "titulo": titulo_oportunidad,
                "descripcion": mensaje.contenido or "Consulta inicial",
                "descripcion_estado": titulo_oportunidad,
                "responsable_id": responsable_id,
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
            "responsable_id": responsable_id,
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

    def enviar_mensaje(
        self,
        session: Session,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        contenido = payload.get("contenido")
        if not contenido or not contenido.strip():
            raise ValueError("El contenido del mensaje es obligatorio")

        oportunidad_id = payload.get("oportunidad_id")
        if not oportunidad_id:
            raise ValueError("oportunidad_id es obligatorio")

        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            raise ValueError("Oportunidad no encontrada")

        responsable_id = payload.get("responsable_id") or oportunidad.responsable_id
        if not responsable_id:
            raise ValueError("No se pudo determinar el responsable del mensaje")

        contacto_id = payload.get("contacto_id") or oportunidad.contacto_id
        contacto_creado = False

        if contacto_id is None:
            contacto_nombre = payload.get("contacto_nombre")
            if not contacto_nombre or not contacto_nombre.strip():
                raise ValueError(
                    "El campo contacto_nombre es obligatorio cuando la oportunidad no tiene contacto asignado"
                )
            referencia = payload.get("contacto_referencia") or oportunidad.descripcion_estado or contacto_nombre
            contacto_payload = {
                "nombre": contacto_nombre.strip(),
                "referencia": referencia,
                "responsable_id": responsable_id,
            }
            contacto = self._crear_contacto_si_necesario(session, contacto_payload)
            contacto_id = contacto.id
            contacto_creado = True
            if oportunidad.contacto_id is None:
                oportunidad.contacto_id = contacto_id
                session.add(oportunidad)

        asunto = payload.get("asunto")
        if not asunto:
            asunto = oportunidad.descripcion_estado or f"Oportunidad #{oportunidad_id}"

        canal = payload.get("canal") or CanalMensaje.WHATSAPP.value

        mensaje_payload = {
            "tipo": TipoMensaje.SALIDA.value,
            "canal": canal,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
            "asunto": asunto,
            "contenido": contenido.strip(),
            "estado": EstadoMensaje.PENDIENTE_ENVIO.value,
            "fecha_mensaje": datetime.now(UTC).isoformat(),
            "responsable_id": responsable_id,
            "contacto_referencia": payload.get("contacto_referencia"),
        }
        mensaje = crm_mensaje_crud.create(session, mensaje_payload)

        session.commit()
        session.refresh(mensaje)
        return {
            "mensaje_salida": mensaje,
            "contacto_id": contacto_id,
            "contacto_creado": contacto_creado,
            "oportunidad_id": oportunidad_id,
        }

    def _normalize_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if not isinstance(value, str):
            raise ValueError("fecha_evento es invalida")
        s = value.strip()
        if not s:
            raise ValueError("fecha_evento es invalida")
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(s)
        except ValueError as exc:
            raise ValueError("fecha_evento debe estar en formato ISO") from exc

    def agendar_evento_para_mensaje(
        self,
        session: Session,
        mensaje_id: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError("Mensaje no encontrado")

        titulo = (payload.get("titulo") or "").strip()
        tipo_evento_codigo = payload.get("tipo_evento_codigo") or payload.get("tipo_evento")
        tipo_id = payload.get("tipo_id")
        fecha_evento = payload.get("fecha_evento")
        asignado_a_id = payload.get("asignado_a_id")
        estado_evento = payload.get("estado_evento") or EstadoEvento.PENDIENTE.value
        descripcion = (payload.get("descripcion") or "").strip() or None

        if not titulo:
            raise ValueError("El t\u00edtulo del evento es obligatorio")
        if not tipo_id and not tipo_evento_codigo:
            raise ValueError("tipo_evento_codigo o tipo_id es obligatorio")
        if not fecha_evento:
            raise ValueError("fecha_evento es obligatorio")
        if not asignado_a_id:
            raise ValueError("asignado_a_id es obligatorio")

        fecha_evento_dt = self._normalize_datetime(fecha_evento)
        try:
            asignado_a_id_int = int(asignado_a_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("asignado_a_id es invalido") from exc

        responsable_id = payload.get("responsable_id") or mensaje.responsable_id or asignado_a_id_int
        if not responsable_id:
            raise ValueError("No se pudo determinar el responsable del evento")

        contacto_id = mensaje.contacto_id
        contacto_creado = False
        if contacto_id is None:
            contacto_nombre = (
                payload.get("contacto_nombre")
                or mensaje.contacto_nombre_propuesto
                or mensaje.contacto_alias
                or mensaje.asunto
                or f"Contacto mensaje #{mensaje.id}"
            )
            referencia = (
                payload.get("contacto_referencia")
                or mensaje.contacto_referencia
                or mensaje.origen_externo_id
                or mensaje.contacto_alias
                or contacto_nombre
            )
            contacto_payload = {
                "nombre": contacto_nombre,
                "referencia": referencia,
                "responsable_id": responsable_id,
            }
            contacto = self._crear_contacto_si_necesario(session, contacto_payload)
            contacto_id = contacto.id
            contacto_creado = True

        oportunidad_id = mensaje.oportunidad_id
        oportunidad_creada = False
        if oportunidad_id is None:
            titulo_oportunidad = titulo or mensaje.asunto or f"Seguimiento mensaje #{mensaje.id}"
            descripcion_estado = titulo or mensaje.asunto or f"Seguimiento mensaje #{mensaje.id}"
            oportunidad_payload: Dict[str, Any] = {
                "contacto_id": contacto_id,
                "responsable_id": responsable_id,
                "titulo": titulo_oportunidad,
                "estado": EstadoOportunidad.PROSPECT.value,
                "fecha_estado": datetime.now(UTC),
                "descripcion_estado": descripcion_estado,
                "descripcion": descripcion or mensaje.contenido,
                "tipo_operacion_id": payload.get("tipo_operacion_id"),
            }
            oportunidad = crm_oportunidad_crud.create(session, oportunidad_payload)
            oportunidad_id = oportunidad.id
            oportunidad_creada = True

        tipo_catalogo_codigo = tipo_evento_codigo or "nota"
        motivo_catalogo_codigo = payload.get("motivo_evento_codigo") or "general"
        if tipo_id is not None:
            try:
                tipo_catalogo_id = int(tipo_id)
            except (TypeError, ValueError) as exc:
                raise ValueError("tipo_id es invalido") from exc
        else:
            tipo_catalogo_id = self._obtener_catalogo_id(
                session, CRMTipoEvento, tipo_catalogo_codigo, "tipos de evento"
            )
        motivo_catalogo_id = self._obtener_catalogo_id(
            session, CRMMotivoEvento, motivo_catalogo_codigo, "motivos de evento"
        )

        descripcion_evento = descripcion or mensaje.contenido or titulo or "Actividad programada"

        evento = CRMEvento(
            oportunidad_id=oportunidad_id,
            contacto_id=contacto_id,
            tipo_id=tipo_catalogo_id,
            motivo_id=motivo_catalogo_id,
            titulo=titulo,
            fecha_evento=fecha_evento_dt,
            estado_evento=estado_evento,
            asignado_a_id=asignado_a_id_int,
            descripcion=descripcion_evento,
        )

        mensaje.contacto_id = contacto_id
        mensaje.oportunidad_id = oportunidad_id
        if mensaje.estado == EstadoMensaje.NUEVO.value:
            mensaje.estado = EstadoMensaje.RECIBIDO.value
        session.add(mensaje)
        session.add(evento)
        session.commit()
        session.refresh(mensaje)
        session.refresh(evento)

        return {
            "evento": evento.model_dump(),
            "evento_id": evento.id,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
            "contacto_creado": contacto_creado,
            "oportunidad_creada": oportunidad_creada,
        }


crm_mensaje_service = CRMMensajeService()
