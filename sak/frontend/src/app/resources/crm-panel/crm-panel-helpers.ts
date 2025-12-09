import type { CRMOportunidad, CRMOportunidadEstado } from "../crm-oportunidades/model";
import {
  formatEstadoOportunidad,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
} from "../crm-oportunidades/model";

// Tipos de bucket basados en estados
export type BucketKey = CRMOportunidadEstado;

// Colores de fondo para buckets (igual que list_panel)
export const ESTADO_BG_COLORS: Record<CRMOportunidadEstado, string> = {
  "0-prospect": "from-slate-50/90 to-slate-100/80",
  "1-abierta": "from-blue-50/90 to-blue-100/70",
  "2-visita": "from-cyan-50/90 to-cyan-100/70",
  "3-cotiza": "from-amber-50/90 to-amber-100/70",
  "4-reserva": "from-violet-50/90 to-violet-100/70",
  "5-ganada": "from-emerald-50/90 to-emerald-100/70",
  "6-perdida": "from-rose-50/90 to-rose-100/70",
};

// Formatear título de oportunidad
export const formatOportunidadTitulo = (oportunidad: CRMOportunidad): string => {
  return oportunidad.titulo || `Oportunidad #${oportunidad.id}`;
};

// Obtener nombre del contacto
export const getContactoName = (oportunidad: CRMOportunidad): string => {
  const contacto = (oportunidad as any).contacto;
  return contacto?.nombre_completo || contacto?.nombre || `Contacto #${oportunidad.contacto_id}`;
};

// Obtener nombre del responsable
export const getResponsableName = (oportunidad: CRMOportunidad): string => {
  const responsable = (oportunidad as any).responsable;
  return (
    responsable?.nombre_completo ||
    responsable?.nombre ||
    responsable?.email ||
    `Usuario #${oportunidad.responsable_id}`
  );
};

// Obtener info del avatar del responsable
export const getResponsableAvatarInfo = (oportunidad: CRMOportunidad) => {
  const responsable = (oportunidad as any).responsable;
  const name = getResponsableName(oportunidad);
  const avatarUrl = responsable?.avatar || responsable?.url_foto || null;
  
  // Generar iniciales
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return { name, avatarUrl, initials };
};

// Obtener nombre de propiedad
export const getPropiedadName = (oportunidad: CRMOportunidad): string => {
  const propiedad = (oportunidad as any).propiedad;
  if (!propiedad && !oportunidad.propiedad_id) return "Sin propiedad";
  return propiedad?.nombre || `Propiedad #${oportunidad.propiedad_id}`;
};

// Obtener nombre del tipo de operación
export const getTipoOperacionName = (oportunidad: CRMOportunidad): string => {
  const tipoOperacion = (oportunidad as any).tipo_operacion;
  return tipoOperacion?.nombre || tipoOperacion?.codigo || `Operación #${oportunidad.tipo_operacion_id}`;
};

// Clase de badge según estado
export const getEstadoBadgeClass = (estado: CRMOportunidadEstado): string => {
  return CRM_OPORTUNIDAD_ESTADO_BADGES[estado] ?? "bg-slate-100 text-slate-800";
};

// Formatear etiqueta de estado
export const formatEstadoLabel = (estado: CRMOportunidadEstado): string => {
  return formatEstadoOportunidad(estado);
};

// Formatear monto
export const formatMonto = (oportunidad: CRMOportunidad): string => {
  if (!oportunidad.monto) return "Sin monto";
  
  const moneda = (oportunidad as any).moneda;
  const simbolo = moneda?.simbolo || moneda?.codigo || "$";
  
  return `${simbolo} ${oportunidad.monto.toLocaleString("es-AR")}`;
};

// Formatear fecha de cierre estimada
export const formatFechaCierre = (fecha?: string | null): string => {
  if (!fecha) return "Sin fecha";
  
  const date = new Date(fecha);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Estilo de tarjeta según estado
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

// Utilidad cn (si no está importada)
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
