import { cn } from "@/lib/utils";

// Define el shape de la oportunidad CRM que usan las vistas.
export type CRMOportunidad = {
  id: number;
  created_at: string;
  titulo?: string | null;
  contacto_id: number;
  tipo_operacion_id: number;
  emprendimiento_id?: number | null;
  propiedad_id: number;
  tipo_propiedad_id?: number | null;
  estado: CRMOportunidadEstado;
  fecha_estado: string;
  motivo_perdida_id?: number | null;
  monto?: number | null;
  moneda_id?: number | null;
  condicion_pago_id?: number | null;
  forma_pago_descripcion?: string | null;
  probabilidad?: number | null;
  fecha_cierre_estimada?: string | null;
  responsable_id: number;
  descripcion_estado?: string | null;
  cotizacion_aplicada?: number | null;
  activo?: boolean;
};

// Tipo nominal para los estados de oportunidad.
export type CRMOportunidadEstado = (typeof CRM_OPORTUNIDAD_ESTADOS)[number];

// Tipos de bucket basados en estados.
export type BucketKey = CRMOportunidadEstado;

// Lista canonica de estados permitidos para oportunidades.
export const CRM_OPORTUNIDAD_ESTADOS = [
  "0-prospect",
  "1-abierta",
  "2-visita",
  "3-cotiza",
  "4-reserva",
  "5-ganada",
  "6-perdida",
] as const;

// Opciones de estado listas para selects.
export const CRM_OPORTUNIDAD_ESTADO_CHOICES = CRM_OPORTUNIDAD_ESTADOS.map(
  (estado) => ({
    id: estado,
    name: estado.replace("-", " "),
  }),
);

// Colores de badge por estado para uso consistente en UI.
export const CRM_OPORTUNIDAD_ESTADO_BADGES: Record<CRMOportunidadEstado, string> =
  {
    "0-prospect": "bg-slate-100 text-slate-800",
    "1-abierta": "bg-blue-100 text-blue-800",
    "2-visita": "bg-cyan-100 text-cyan-800",
    "3-cotiza": "bg-amber-100 text-amber-800",
    "4-reserva": "bg-violet-100 text-violet-800",
    "5-ganada": "bg-emerald-100 text-emerald-800",
    "6-perdida": "bg-rose-100 text-rose-800",
  };

// Convierte un estado a etiqueta amigable en UI.
export const formatEstadoOportunidad = (
  estado?: CRMOportunidadEstado | null,
) => {
  if (!estado) {
    return "Sin estado";
  }
  const found = CRM_OPORTUNIDAD_ESTADO_CHOICES.find(
    (choice) => choice.id === estado,
  );
  return found?.name ?? estado;
};

// Colores de fondo para buckets en kanban.
export const ESTADO_BG_COLORS: Record<CRMOportunidadEstado, string> = {
  "0-prospect": "from-slate-50/90 to-slate-100/80",
  "1-abierta": "from-blue-50/90 to-blue-100/70",
  "2-visita": "from-cyan-50/90 to-cyan-100/70",
  "3-cotiza": "from-amber-50/90 to-amber-100/70",
  "4-reserva": "from-violet-50/90 to-violet-100/70",
  "5-ganada": "from-emerald-50/90 to-emerald-100/70",
  "6-perdida": "from-rose-50/90 to-rose-100/70",
};

// Normaliza ids de inputs a numero o null.
export const normalizeOportunidadId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

// Convierte ids opcionales a numero o undefined.
export const parseNumericId = (value?: unknown) => {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : undefined;
};

// Formatea fecha y hora para resumentes de oportunidad.
export const formatDateTimeValue = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleString("es-AR", options ?? { dateStyle: "short", timeStyle: "short" });
};

// Formatea fecha corta para encabezados.
export const formatDateValue = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Formatea el titulo de la oportunidad.
export const formatOportunidadTitulo = (oportunidad: CRMOportunidad): string => {
  return oportunidad.titulo || `Oportunidad #${oportunidad.id}`;
};

// Obtiene el nombre del contacto asociado.
export const getContactoName = (oportunidad: CRMOportunidad): string => {
  const contacto = (oportunidad as { contacto?: { nombre_completo?: string; nombre?: string } })
    .contacto;
  return contacto?.nombre_completo || contacto?.nombre || `Contacto #${oportunidad.contacto_id}`;
};

// Obtiene el nombre del responsable asociado.
export const getResponsableName = (oportunidad: CRMOportunidad): string => {
  const responsable = (oportunidad as {
    responsable?: { nombre_completo?: string; nombre?: string; email?: string };
  }).responsable;
  return (
    responsable?.nombre_completo ||
    responsable?.nombre ||
    responsable?.email ||
    `Usuario #${oportunidad.responsable_id}`
  );
};

// Devuelve datos del responsable para avatar.
export const getResponsableAvatarInfo = (oportunidad: CRMOportunidad) => {
  const responsable = (oportunidad as { responsable?: { avatar?: string; url_foto?: string } })
    .responsable;
  const name = getResponsableName(oportunidad);
  const avatarUrl = responsable?.avatar || responsable?.url_foto || null;

  // Generar iniciales.
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return { name, avatarUrl, initials };
};

// Obtiene el nombre de la propiedad asociada.
export const getPropiedadName = (oportunidad: CRMOportunidad): string => {
  const propiedad = (oportunidad as { propiedad?: { nombre?: string } }).propiedad;
  if (!propiedad && !oportunidad.propiedad_id) return "Sin propiedad";
  return propiedad?.nombre || `Propiedad #${oportunidad.propiedad_id}`;
};

// Obtiene el nombre del emprendimiento asociado.
export const getEmprendimientoName = (oportunidad: CRMOportunidad): string => {
  const emprendimiento = (oportunidad as { emprendimiento?: { nombre?: string } }).emprendimiento;
  if (!emprendimiento && !oportunidad.emprendimiento_id) return "Sin emprendimiento";
  return emprendimiento?.nombre || `Emprendimiento #${oportunidad.emprendimiento_id}`;
};

// Obtiene el nombre del tipo de operacion.
export const getTipoOperacionName = (oportunidad: CRMOportunidad): string => {
  const tipoOperacion = (oportunidad as { tipo_operacion?: { nombre?: string; codigo?: string } })
    .tipo_operacion;
  return (
    tipoOperacion?.nombre ||
    tipoOperacion?.codigo ||
    `Operacion #${oportunidad.tipo_operacion_id}`
  );
};

// Calcula la clase CSS del badge segun estado.
export const getEstadoBadgeClass = (estado: CRMOportunidadEstado): string => {
  return CRM_OPORTUNIDAD_ESTADO_BADGES[estado] ?? "bg-slate-100 text-slate-800";
};

// Formatea etiqueta de estado para UI.
export const formatEstadoLabel = (estado: CRMOportunidadEstado): string => {
  return formatEstadoOportunidad(estado);
};

// Formatea el monto con simbolo de moneda.
export const formatMonto = (oportunidad: CRMOportunidad): string => {
  if (!oportunidad.monto) return "Sin monto";

  const moneda = (oportunidad as { moneda?: { simbolo?: string; codigo?: string } }).moneda;
  const simbolo = moneda?.simbolo || moneda?.codigo || "$";

  return `${simbolo} ${oportunidad.monto.toLocaleString("es-AR")}`;
};

// Formatea fecha de creacion en formato dd/mm/aaaa.
export const formatCreatedDate = (fecha: string): string => {
  const date = new Date(fecha);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Devuelve clases de estilo para tarjeta segun estado.
export const getCardStyle = (estado: CRMOportunidadEstado): string => {
  const baseClasses = "transition-all hover:shadow-md";

  switch (estado) {
    case "5-ganada":
      return cn(baseClasses, "border-emerald-200 bg-emerald-50/30");
    case "6-perdida":
      return cn(baseClasses, "border-rose-200 bg-rose-50/30 opacity-75");
    default:
      return cn(baseClasses, "border-slate-200 bg-white");
  }
};
