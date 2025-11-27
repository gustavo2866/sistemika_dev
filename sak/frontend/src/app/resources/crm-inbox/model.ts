export type CRMMensaje = {
  id: number
  tipo: string
  canal: string
  estado: string
  created_at?: string
  fecha_mensaje?: string
  contacto_referencia?: string | null
  asunto?: string | null
  contenido?: string | null
  metadata?: Record<string, any>
  oportunidad_id?: number | null
}

export type FormValues = {
  contacto_nuevo: boolean
  contacto_id?: string
  contacto_nombre?: string
  contacto_referencia?: string
  contacto_responsable_id?: string
  oportunidad_id?: string
  crear_oportunidad?: boolean
  tipo_operacion_id?: string
  propiedad_id?: string
  responsable_oportunidad_id?: string
  evento_tipo_id?: string
  evento_motivo_id?: string
  evento_asignado_id?: string
  evento_descripcion?: string
  proximo_estado?: string
  fecha_proximo_estado?: string
  enviar_respuesta?: boolean
}

export type OportunidadAuto = {
  id: number
  label: string
  propiedad_id?: number | null
  propiedad_nombre?: string | null
  tipo_operacion_id?: number | null
  responsable_id?: number | null
  tipo_operacion_nombre?: string | null
  responsable_nombre?: string | null
  estado?: string | null
}

export const ESTADO_OPORTUNIDAD_CHOICES = [
  { id: "", name: "Selecciona estado" },
  { id: "1-abierta", name: "Abierta" },
  { id: "2-visita", name: "Visita" },
  { id: "3-cotiza", name: "Cotiza" },
  { id: "4-reserva", name: "Reserva" },
  { id: "5-ganada", name: "Ganada" },
  { id: "6-perdida", name: "Perdida" },
]

export type ConfirmPayload = {
  contacto_id?: number
  contacto_nuevo?: {
    nombre: string
    referencia: string
    responsable_id: number
  }
  oportunidad_id?: number
  oportunidad_nueva?: {
    tipo_operacion_id: number
    propiedad_id: number
    responsable_id: number
  }
  evento: {
    tipo_id?: number
    motivo_id?: number
    descripcion?: string
    asignado_a_id?: number
    proximo_estado?: string
    fecha_proximo_estado?: string
    enviar_respuesta: boolean
  }
}

type IdentityLike = { id?: number | string }

export const getDefaultFormValues = (
  message: CRMMensaje,
  identity?: IdentityLike,
): FormValues => ({
  contacto_nuevo: false,
  contacto_id: undefined,
  contacto_nombre: "",
  contacto_referencia: message.contacto_referencia ?? "",
  contacto_responsable_id: identity?.id != null ? String(identity.id) : "",
  oportunidad_id: undefined,
  crear_oportunidad: false,
  tipo_operacion_id: "",
  propiedad_id: "",
  responsable_oportunidad_id: identity?.id != null ? String(identity.id) : "",
  evento_tipo_id: "",
  evento_motivo_id: "",
  evento_asignado_id: identity?.id != null ? String(identity.id) : "",
  evento_descripcion: "",
  proximo_estado: "",
  fecha_proximo_estado: new Date().toISOString().slice(0, 10),
  enviar_respuesta: true,
})

const requireNumber = (value?: string, message?: string): number => {
  const numeric = value ? Number(value) : NaN
  if (Number.isNaN(numeric)) {
    throw new Error(message || "Valor numérico inválido")
  }
  return numeric
}

export const getContactoValidationError = (values: FormValues): string | null => {
  if (values.contacto_nuevo) {
    if (!values.contacto_nombre?.trim()) {
      return "Completa el nombre del contacto nuevo"
    }
    if (!values.contacto_responsable_id) {
      return "Selecciona un responsable para el contacto nuevo"
    }
  } else if (!values.contacto_id) {
    return "Selecciona un contacto existente"
  }
  return null
}

export const getOportunidadValidationError = (values: FormValues): string | null => {
  if (values.crear_oportunidad) {
    if (!values.tipo_operacion_id) {
      return "Selecciona el tipo de operación"
    }
    if (!values.propiedad_id) {
      return "Selecciona una propiedad para la oportunidad"
    }
    if (!values.responsable_oportunidad_id) {
      return "Selecciona un responsable para la oportunidad"
    }
    return null
  }
  if (!values.oportunidad_id) {
    return "Selecciona una oportunidad existente"
  }
  if (!values.tipo_operacion_id || !values.propiedad_id) {
    return "La oportunidad seleccionada debe incluir tipo y propiedad"
  }
  return null
}

export const buildConfirmPayload = (values: FormValues): ConfirmPayload => {
  const payload: ConfirmPayload = {
    evento: {
      tipo_id: values.evento_tipo_id ? Number(values.evento_tipo_id) : undefined,
      motivo_id: values.evento_motivo_id ? Number(values.evento_motivo_id) : undefined,
      descripcion: values.evento_descripcion,
      asignado_a_id: values.evento_asignado_id ? Number(values.evento_asignado_id) : undefined,
      proximo_estado: values.proximo_estado || undefined,
      fecha_proximo_estado: values.fecha_proximo_estado || undefined,
      enviar_respuesta: values.enviar_respuesta ?? false,
    },
  }

  if (!values.contacto_nuevo && values.contacto_id) {
    payload.contacto_id = Number(values.contacto_id)
  } else if (
    values.contacto_nuevo &&
    values.contacto_nombre &&
    values.contacto_referencia &&
    values.contacto_responsable_id
  ) {
    payload.contacto_nuevo = {
      nombre: values.contacto_nombre,
      referencia: values.contacto_referencia,
      responsable_id: Number(values.contacto_responsable_id),
    }
  } else {
    throw new Error("Selecciona un contacto existente o completá los datos para uno nuevo")
  }

  if (values.oportunidad_id) {
    payload.oportunidad_id = Number(values.oportunidad_id)
  } else if (values.crear_oportunidad) {
    if (!values.tipo_operacion_id || !values.responsable_oportunidad_id || !values.propiedad_id) {
      throw new Error("Completa tipo, responsable y propiedad para la oportunidad nueva")
    }
    payload.oportunidad_nueva = {
      tipo_operacion_id: requireNumber(values.tipo_operacion_id, "Tipo de operación inválido"),
      propiedad_id: requireNumber(values.propiedad_id, "Propiedad inválida"),
      responsable_id: requireNumber(values.responsable_oportunidad_id, "Responsable inválido"),
    }
  }

  return payload
}

type SummaryItem = { label: string; value: string }

export const getOportunidadSummaryData = ({
  crearOportunidad,
  values,
  autoOportunidad,
}: {
  crearOportunidad: boolean
  values: Pick<FormValues, "propiedad_id" | "tipo_operacion_id" | "responsable_oportunidad_id" | "oportunidad_id">
  autoOportunidad?: OportunidadAuto | null
}): SummaryItem[] => {
  if (crearOportunidad) {
    return [
      { label: "Modo", value: "Nueva oportunidad" },
      { label: "Propiedad", value: values.propiedad_id ? `ID ${values.propiedad_id}` : "Seleccionar propiedad" },
      { label: "Tipo operación", value: values.tipo_operacion_id || "-" },
      {
        label: "Responsable",
        value: values.responsable_oportunidad_id ? `ID ${values.responsable_oportunidad_id}` : "-",
      },
    ]
  }

  return [
    { label: "Modo", value: "Oportunidad existente" },
    {
      label: "Oportunidad",
      value: autoOportunidad?.label || (values.oportunidad_id ? `ID ${values.oportunidad_id}` : "Sin seleccionar"),
    },
    {
      label: "Propiedad",
      value:
        autoOportunidad?.propiedad_id != null
          ? `ID ${autoOportunidad.propiedad_id}`
          : "Propiedad registrada en CRM",
    },
  ]
}

export const getRespuestaSummaryData = (
  values: Pick<
    FormValues,
    "contacto_responsable_id" | "evento_tipo_id" | "evento_motivo_id" | "evento_asignado_id" | "evento_descripcion"
  >,
): SummaryItem[] => [
  {
    label: "Responsable contacto",
    value: values.contacto_responsable_id ? `ID ${values.contacto_responsable_id}` : "-",
  },
  { label: "Tipo evento", value: values.evento_tipo_id || "-" },
  { label: "Motivo", value: values.evento_motivo_id || "-" },
  { label: "Asignado a", value: values.evento_asignado_id ? `ID ${values.evento_asignado_id}` : "-" },
  { label: "Descripción", value: values.evento_descripcion || "-" },
]

export const CONTACTO_REFERENCE = {
  resource: "crm/contactos",
  labelField: "nombre_completo",
}

export const OPORTUNIDADES_REFERENCE = {
  resource: "crm/oportunidades",
  labelField: "descripcion_estado",
}

export const TIPOS_OPERACION_REFERENCE = {
  resource: "crm/catalogos/tipos-operacion",
  labelField: "nombre",
}

export const PROPIEDADES_REFERENCE = {
  resource: "propiedades",
  labelField: "nombre",
}

export const USERS_REFERENCE = {
  resource: "users",
  labelField: "nombre",
}

export const TIPOS_EVENTO_REFERENCE = {
  resource: "crm/catalogos/tipos-evento",
  labelField: "nombre",
}

export const MOTIVOS_EVENTO_REFERENCE = {
  resource: "crm/catalogos/motivos-evento",
  labelField: "nombre",
}

export const CRM_INBOX_FILTER = { tipo: "entrada" }
