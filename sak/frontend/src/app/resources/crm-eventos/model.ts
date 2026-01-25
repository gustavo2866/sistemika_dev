import {
  createEntitySchema,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_EVENTO_ESTADOS = ["1-pendiente", "2-realizado", "3-cancelado", "4-reagendar"] as const;

export type CRMEventoEstado = (typeof CRM_EVENTO_ESTADOS)[number];

export const CRM_EVENTO_ESTADO_CHOICES = CRM_EVENTO_ESTADOS.map((estado) => ({
  id: estado,
  name: estado.split('-')[1].charAt(0).toUpperCase() + estado.split('-')[1].slice(1),
}));

export const CRM_EVENTO_TIPO_CHOICES = [
  { id: "llamada", name: "Llamada" },
  { id: "reunion", name: "Reunion" },
  { id: "visita", name: "Visita" },
  { id: "email", name: "Email" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "nota", name: "Nota" },
];

export const CRM_EVENTO_VALIDATIONS = {
  DESCRIPCION_MAX: 2000,
  PROXIMO_PASO_MAX: 500,
} as const;

export type CRMEvento = {
  id: number;
  oportunidad_id: number;
  contacto_id?: number | null;
  tipo_id: number;
  motivo_id?: number | null;
  tipo_evento?: string | null;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  estado_evento: CRMEventoEstado;
  asignado_a_id: number;
  resultado?: string | null;
  fecha_estado?: string | null;
  tipo_catalogo?: { id?: number; codigo?: string; nombre?: string } | null;
  oportunidad?: {
    id?: number;
    estado?: string;
    titulo?: string | null;
    descripcion_estado?: string;
    contacto_id?: number;
    propiedad_id?: number;
    contacto?: { id?: number; nombre?: string; nombre_completo?: string } | null;
  } | null;
  contacto?: { id?: number; nombre?: string; nombre_completo?: string } | null;
  asignado_a?: { id?: number; nombre?: string } | null;
};

export type CRMEventoFormValues = {
  oportunidad_id: number | null;
  tipo_id: number | null;
  titulo: string;
  descripcion?: string;
  fecha_evento: string;
  estado_evento: CRMEventoEstado;
  asignado_a_id: number | null;
  resultado?: string | null;
};

export const CRM_EVENTO_DEFAULTS: CRMEventoFormValues = {
  oportunidad_id: null,
  tipo_id: null,
  titulo: "",
  descripcion: "",
  fecha_evento: "",
  estado_evento: "1-pendiente",
  asignado_a_id: null,
  resultado: "",
};

export const crmEventoSchema = createEntitySchema<
  CRMEventoFormValues,
  CRMEvento
>({
  fields: {
    oportunidad_id: referenceField({
      required: true,
      resource: "crm/oportunidades",
      labelField: "id",
    }),
    titulo: stringField({
      required: true,
      maxLength: 255,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: CRM_EVENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
    tipo_id: referenceField({
      required: true,
      resource: "crm/catalogos/tipos-evento",
      labelField: "nombre",
      defaultValue: undefined,
    }),
    fecha_evento: stringField({
      required: true,
      defaultValue: "",
    }),
    estado_evento: selectField({
      required: true,
      options: CRM_EVENTO_ESTADO_CHOICES,
      defaultValue: "1-pendiente",
    }),
    asignado_a_id: referenceField({
      required: true,
      resource: "users",
      labelField: "nombre",
    }),
    resultado: stringField({
      required: false,
      maxLength: CRM_EVENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
  },
});

export type SeguimientoOptionId = "hoy" | "manana" | "semana" | "siguiente";

export const seguimientoOptions: Array<{ id: SeguimientoOptionId; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "manana", label: "Manana" },
  { id: "semana", label: "Semana" },
  { id: "siguiente", label: "Siguiente" },
];

export const bucketOrder = ["vencido", "hoy", "manana", "semana", "siguientes"] as const;
export type FechaBucket = (typeof bucketOrder)[number];

export const bucketLabels: Record<FechaBucket, string> = {
  vencido: "Vencidos",
  hoy: "Hoy",
  manana: "Manana",
  semana: "Semana",
  siguientes: "Siguientes",
};

export const formatDateTimeShort = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const datePart = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const timePart = date
    .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(":", ":");
  return `${datePart} ${timePart}`;
};

export const isEventoCompleted = (record: CRMEvento) =>
  record.estado_evento === "2-realizado" ||
  record.estado_evento?.includes("realizado") ||
  record.estado_evento?.includes("hecho");

const normalizeFechaBase = (record?: CRMEvento) => {
  const base = new Date();
  if (record?.fecha_evento) {
    const current = new Date(record.fecha_evento);
    if (!Number.isNaN(current.getTime())) {
      base.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());
    }
  }
  return base;
};

const getDateBounds = (reference: Date) => {
  const startToday = new Date(reference);
  startToday.setHours(0, 0, 0, 0);

  const endToday = new Date(startToday);
  endToday.setHours(23, 59, 59, 999);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const endTomorrow = new Date(startTomorrow);
  endTomorrow.setHours(23, 59, 59, 999);

  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() + 2);

  const endWeek = new Date(startToday);
  const daysUntilSunday = (7 - endWeek.getDay()) % 7;
  endWeek.setDate(endWeek.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  endWeek.setHours(23, 59, 59, 999);

  return { startToday, endToday, startTomorrow, endTomorrow, startWeek, endWeek };
};

export const computeSeguimientoDate = (optionId: SeguimientoOptionId, record?: CRMEvento) => {
  const option = seguimientoOptions.find((item) => item.id === optionId);
  if (!option) return null;

  const base = normalizeFechaBase(record);
  const now = new Date();

  const copyTime = (target: Date) => {
    target.setHours(
      base.getHours(),
      base.getMinutes(),
      base.getSeconds(),
      base.getMilliseconds()
    );
  };

  if (optionId === "hoy") {
    return base;
  }

  if (optionId === "manana") {
    const target = new Date(base);
    target.setDate(target.getDate() + 1);
    return target;
  }

  const { startWeek, endWeek } = getDateBounds(now);

  if (optionId === "semana") {
    // Si hoy es viernes/sábado/domingo, mantener el mismo día
    if (now.getDay() >= 5) {
      return base;
    }
    copyTime(startWeek);
    return startWeek;
  }

  const nextAfterWeek = new Date(endWeek);
  nextAfterWeek.setDate(nextAfterWeek.getDate() + 1);
  copyTime(nextAfterWeek);
  return nextAfterWeek;
};

export const getFechaBucketLabel = (fecha?: string | null): FechaBucket => {
  if (!fecha) return "siguientes";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "siguientes";

  const now = new Date();
  const { startToday, endToday, startTomorrow, endTomorrow, startWeek, endWeek } = getDateBounds(now);

  if (date < startToday) return "vencido";
  if (date <= endToday) return "hoy";
  if (date >= startTomorrow && date <= endTomorrow) return "manana";
  if (date >= startWeek && date <= endWeek) return "semana";
  return "siguientes";
};

export const getContactoDisplayName = (record: CRMEvento) =>
  record.contacto?.nombre_completo?.trim() ||
  record.contacto?.nombre?.trim() ||
  (record.contacto_id ? `Contacto #${record.contacto_id}` : "Sin contacto");

export const getTipoEventoValue = (record: CRMEvento) =>
  record.tipo_evento?.trim() ||
  record.tipo_catalogo?.codigo?.trim() ||
  record.tipo_catalogo?.nombre?.trim() ||
  "";

export const getResponsableDisplayName = (record: CRMEvento) =>
  record.asignado_a?.nombre?.trim() ||
  (record.asignado_a_id ? `Usuario #${record.asignado_a_id}` : "Sin responsable");

export const getResponsableAvatarUrl = (record: CRMEvento) =>
  (record.asignado_a as any)?.url_foto ||
  (record.asignado_a as any)?.avatar ||
  null;

export const getInitials = (value: string, maxLetters = 2) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, maxLetters)
    .join("")
    .toUpperCase();
