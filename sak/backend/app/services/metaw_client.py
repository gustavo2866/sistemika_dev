"""
Compatibility facade for the old meta-w client contract.

The implementation now delegates to the internal channels module instead of
posting to the external meta_w service.
"""
from typing import Any, Dict, Optional

from app.modules.channels.gateway import channel_gateway


class MetaWClient:
    """Backward-compatible client used by the CRM layer."""

    async def enviar_mensaje(
        self,
        empresa_id: str,
        celular_id: str,
        telefono_destino: str,
        texto: str,
        nombre_contacto: Optional[str] = None,
        template_fallback_name: str = "notificacion_general",
        template_fallback_language: str = "en",
    ) -> Dict[str, Any]:
        return await channel_gateway.enviar_mensaje(
            empresa_id=empresa_id,
            celular_id=celular_id,
            telefono_destino=telefono_destino,
            texto=texto,
            nombre_contacto=nombre_contacto,
            template_fallback_name=template_fallback_name,
            template_fallback_language=template_fallback_language,
        )


metaw_client = MetaWClient()
