"""
Enumeraciones para el modelo de propiedades y CRM.
"""
from enum import Enum


class EstadoPropiedad(str, Enum):
    """Estados posibles de una propiedad con prefijo numérico para secuencia."""
    RECIBIDA = "1-recibida"
    EN_REPARACION = "2-en_reparacion"
    DISPONIBLE = "3-disponible"
    REALIZADA = "4-realizada"
    RETIRADA = "5-retirada"


# Transiciones permitidas (usar .value para strings)
TRANSICIONES_ESTADO_PROPIEDAD = {
    "1-recibida": ["2-en_reparacion", "3-disponible", "4-realizada"],
    "2-en_reparacion": ["3-disponible", "5-retirada"],
    "3-disponible": ["4-realizada", "5-retirada"],
    "4-realizada": ["1-recibida", "5-retirada"],
    "5-retirada": [],  # Estado final
}


class EstadoOportunidad(str, Enum):
    """Pipeline de oportunidad con prefijos numéricos."""
    ABIERTA = "1-abierta"
    VISITA = "2-visita"
    COTIZA = "3-cotiza"
    RESERVA = "4-reserva"
    GANADA = "5-ganada"
    PERDIDA = "6-perdida"


TRANSICIONES_ESTADO_OPORTUNIDAD = {
    EstadoOportunidad.ABIERTA.value: [
        EstadoOportunidad.VISITA.value,
        EstadoOportunidad.COTIZA.value,
        EstadoOportunidad.PERDIDA.value,
    ],
    EstadoOportunidad.VISITA.value: [
        EstadoOportunidad.COTIZA.value,
        EstadoOportunidad.PERDIDA.value,
    ],
    EstadoOportunidad.COTIZA.value: [
        EstadoOportunidad.RESERVA.value,
        EstadoOportunidad.GANADA.value,
        EstadoOportunidad.PERDIDA.value,
    ],
    EstadoOportunidad.RESERVA.value: [
        EstadoOportunidad.GANADA.value,
        EstadoOportunidad.PERDIDA.value,
    ],
    EstadoOportunidad.GANADA.value: [EstadoOportunidad.ABIERTA.value],
    EstadoOportunidad.PERDIDA.value: [EstadoOportunidad.ABIERTA.value],
}


class EstadoEvento(str, Enum):
    PENDIENTE = "pendiente"
    HECHO = "hecho"


class TipoMensaje(str, Enum):
    ENTRADA = "entrada"
    SALIDA = "salida"


class CanalMensaje(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    RED_SOCIAL = "red_social"
    OTRO = "otro"


class EstadoMensaje(str, Enum):
    NUEVO = "nuevo"
    RECIBIDO = "recibido"
    DESCARTADO = "descartado"
    PENDIENTE_ENVIO = "pendiente_envio"
    ENVIADO = "enviado"
    ERROR_ENVIO = "error_envio"


class PrioridadMensaje(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class EstadoEmprendimiento(str, Enum):
    PLANIFICACION = "planificacion"
    CONSTRUCCION = "construccion"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"
