"""
Enumeraciones para el modelo de propiedades y vacancias.
"""
from enum import Enum


class EstadoPropiedad(str, Enum):
    """Estados posibles de una propiedad con prefijo numérico para secuencia."""
    RECIBIDA = "1-recibida"
    EN_REPARACION = "2-en_reparacion"
    DISPONIBLE = "3-disponible"
    ALQUILADA = "4-alquilada"
    RETIRADA = "5-retirada"


# Transiciones permitidas (usar .value para strings)
TRANSICIONES_ESTADO_PROPIEDAD = {
    "1-recibida": ["2-en_reparacion", "3-disponible", "4-alquilada"],
    "2-en_reparacion": ["3-disponible", "5-retirada"],
    "3-disponible": ["4-alquilada", "5-retirada"],
    "4-alquilada": ["1-recibida", "5-retirada"],
    "5-retirada": []  # Estado final
}
