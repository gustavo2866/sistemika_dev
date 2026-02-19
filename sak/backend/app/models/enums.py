"""
Enumeraciones para el modelo de propiedades y CRM.
"""
from enum import Enum



class EstadoOportunidad(str, Enum):
    """Pipeline de oportunidad con prefijos numéricos."""
    PROSPECT = "0-prospect"
    ABIERTA = "1-abierta"
    VISITA = "2-visita"
    COTIZA = "3-cotiza"
    RESERVA = "4-reserva"
    GANADA = "5-ganada"
    PERDIDA = "6-perdida"


TRANSICIONES_ESTADO_OPORTUNIDAD = {
    EstadoOportunidad.PROSPECT.value: [
        EstadoOportunidad.ABIERTA.value,
        EstadoOportunidad.PERDIDA.value,
    ],
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
    """Estados de eventos con prefijo numérico para secuencia."""
    PENDIENTE = "1-pendiente"      # Evento programado
    REALIZADO = "2-realizado"      # Evento completado
    CANCELADO = "3-cancelado"      # Evento cancelado
    REAGENDAR = "4-reagendar"      # Requiere reprogramación


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


# Transiciones de estado permitidas para eventos
TRANSICIONES_ESTADO_EVENTO = {
    EstadoEvento.PENDIENTE.value: [
        EstadoEvento.REALIZADO.value,
        EstadoEvento.CANCELADO.value,
        EstadoEvento.REAGENDAR.value,
    ],
    EstadoEvento.REALIZADO.value: [],  # Estado final, no permite cambios
    EstadoEvento.CANCELADO.value: [],  # Estado final
    EstadoEvento.REAGENDAR.value: [],  # Estado final (se crea nuevo evento)
}


class EstadoEmprendimiento(str, Enum):
    PLANIFICACION = "planificacion"
    CONSTRUCCION = "construccion"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class TipoCompra(str, Enum):
    """Tipos de compra disponibles"""
    DIRECTA = "directa"
    NORMAL = "normal"
