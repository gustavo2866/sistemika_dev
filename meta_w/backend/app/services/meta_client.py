"""
Cliente HTTP para comunicarse con la API de Meta WhatsApp Business.
"""
from typing import Any, Dict, Optional
from datetime import datetime
import httpx

from app.config import settings


class MetaAPIClient:
    """Cliente para interactuar con Meta WhatsApp Business API."""
    
    BASE_URL = "https://graph.facebook.com/v22.0"
    
    def __init__(self, access_token: str, phone_number_id: str):
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
    
    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Envía un mensaje de plantilla (template) a través de la API de Meta.
        
        Args:
            to: Número de teléfono destino en formato E.164 (ej: +541156384310)
            template_name: Nombre de la plantilla aprobada en Meta
            language_code: Código de idioma (ej: en_US, es_AR)
            components: Componentes opcionales para variables de la plantilla
            
        Returns:
            Respuesta de la API de Meta con message_id y conversation_id
            
        Raises:
            httpx.HTTPError: Si hay error en la comunicación
        """
        url = f"{self.BASE_URL}/{self.phone_number_id}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        }
        
        if components:
            payload["template"]["components"] = components
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
    
    async def send_text_message(self, to: str, text: str) -> Dict[str, Any]:
        """
        Envía un mensaje de texto simple.
        Solo funciona dentro de la ventana de 24 horas después de que el usuario escriba.
        """
        url = f"{self.BASE_URL}/{self.phone_number_id}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": text},
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
