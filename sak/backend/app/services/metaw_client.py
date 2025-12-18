"""
Cliente para comunicarse con meta-w API
"""
import httpx
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

METAW_BASE_URL = "https://meta-w-webhook-653893994930.southamerica-east1.run.app/api/v1"


class MetaWClient:
    """Cliente para enviar mensajes a través de meta-w"""
    
    def __init__(self):
        self.base_url = METAW_BASE_URL
        self.timeout = 30.0
    
    async def enviar_mensaje(
        self,
        empresa_id: str,
        celular_id: str,
        telefono_destino: str,
        texto: str,
        nombre_contacto: Optional[str] = None,
        template_fallback_name: str = "notificacion_general",
        template_fallback_language: str = "es_AR"
    ) -> Dict[str, Any]:
        """
        Envía un mensaje a través de meta-w.
        
        Args:
            empresa_id: UUID de la empresa en meta-w
            celular_id: UUID del celular (canal) en meta-w
            telefono_destino: Número de teléfono sin + (ej: 5491156384310)
            texto: Contenido del mensaje
            nombre_contacto: Nombre del contacto (opcional)
            template_fallback_name: Template a usar si está fuera de ventana 24h
            template_fallback_language: Idioma del template
            
        Returns:
            Dict con respuesta de meta-w
            
        Raises:
            httpx.HTTPStatusError: Si meta-w retorna error
        """
        url = f"{self.base_url}/mensajes/send"
        
        payload = {
            "empresa_id": empresa_id,
            "celular_id": celular_id,
            "telefono_destino": telefono_destino,
            "texto": texto,
            "template_fallback_name": template_fallback_name,
            "template_fallback_language": template_fallback_language
        }
        
        if nombre_contacto:
            payload["nombre_contacto"] = nombre_contacto
        
        logger.info(f"Enviando mensaje a {telefono_destino} vía meta-w")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Mensaje enviado exitosamente. Meta message ID: {result.get('meta_message_id')}")
            return result


metaw_client = MetaWClient()
