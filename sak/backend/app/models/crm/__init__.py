"""
CRM Models Package

This package contains all CRM-related models organized for better maintainability.
"""

from .catalogos import (
    CRMTipoOperacion,
    CRMMotivoPerdida,
    CRMCondicionPago,
    CRMTipoEvento,
    CRMMotivoEvento,
    Moneda,
    CRMCatalogoRespuesta,
    CRMTipoContacto,
)
from .contacto import CRMContacto
from .oportunidad import CRMOportunidad
from .evento import CRMEvento
from .mensaje import CRMMensaje
from .celular import CRMCelular
from .log_estado import CRMOportunidadLogEstado

__all__ = [
    # Catalog models
    "CRMTipoOperacion",
    "CRMMotivoPerdida", 
    "CRMCondicionPago",
    "CRMTipoEvento",
    "CRMMotivoEvento",
    "Moneda",
    "CRMCatalogoRespuesta",
    "CRMTipoContacto",
    # Core models
    "CRMContacto",
    "CRMOportunidad", 
    "CRMEvento",
    "CRMMensaje",
    "CRMCelular",
    "CRMOportunidadLogEstado",
]