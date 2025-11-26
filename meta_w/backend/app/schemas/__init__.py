"""
Schema exports for FastAPI routers.
"""
from .entities import (
    EmpresaCreate,
    EmpresaRead,
    CelularCreate,
    CelularRead,
    ContactoCreate,
    ContactoRead,
    MensajeRead,
    TemplateMessageRequest,
    WebhookVerifyResponse,
    WebhookEventCreate,
)

__all__ = [
    "EmpresaCreate",
    "EmpresaRead",
    "CelularCreate",
    "CelularRead",
    "ContactoCreate",
    "ContactoRead",
    "MensajeRead",
    "TemplateMessageRequest",
    "WebhookVerifyResponse",
    "WebhookEventCreate",
]
