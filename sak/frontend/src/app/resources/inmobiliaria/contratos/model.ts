import { z } from "zod";

// ── Estado ──────────────────────────────────────────────────────────────────

export type ContratoEstado =
  | "borrador"
  | "vigente"
  | "rescindido"
  | "finalizado";

// 'vencido' no es un estado persistido: es una condición computable
// sobre un contrato vigente cuya fecha_vencimiento < hoy.
export const isContratoVencido = (contrato: { estado?: string | null; fecha_vencimiento?: string | null }): boolean =>
  contrato.estado === "vigente" && !!contrato.fecha_vencimiento && new Date(contrato.fecha_vencimiento) < new Date();

export const CONTRATO_ESTADO_LABELS: Record<ContratoEstado, string> = {
  borrador: "Borrador",
  vigente: "Vigente",
  rescindido: "Rescindido",
  finalizado: "Finalizado",
};

export const CONTRATO_ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700 border-slate-200",
  vigente: "bg-emerald-100 text-emerald-700 border-emerald-200",
  // badge especial para vigente-vencido (aplicar via isContratoVencido)
  vencido: "bg-amber-100 text-amber-700 border-amber-200",
  rescindido: "bg-rose-100 text-rose-800 border-rose-200",
  finalizado: "bg-slate-100 text-slate-600 border-slate-200",
};

export const getContratoEstadoLabel = (estado?: string | null): string => {
  if (!estado) return "Sin estado";
  return CONTRATO_ESTADO_LABELS[estado as ContratoEstado] ?? estado;
};

export const getContratoEstadoBadgeClass = (estado?: string | null): string =>
  CONTRATO_ESTADO_BADGES[estado ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";

// ── Types ────────────────────────────────────────────────────────────────────

export type ContratoArchivo = {
  id: number;
  contrato_id: number;
  nombre: string;
  tipo?: string | null;
  archivo_url: string;
  mime_type?: string | null;
  tamanio_bytes?: number | null;
  created_at?: string | null;
};

export type Contrato = {
  id: number;
  propiedad_id?: number | null;
  propiedad?: {
    id: number;
    nombre: string;
    propietario?: string | null;
    propietario_id?: number | null;
    propietario_ref?: { id: number; nombre: string } | null;
  } | null;
  tipo_contrato_id?: number | null;
  tipo_contrato?: { id: number; nombre: string } | null;
  tipo_actualizacion_id?: number | null;
  tipo_actualizacion?: { id: number; nombre: string } | null;
  // Vigencia
  fecha_inicio?: string | null;
  fecha_vencimiento?: string | null;
  fecha_renovacion?: string | null;
  duracion_meses?: number | null;
  // Económico
  valor_alquiler?: number | null;
  expensas?: number | null;
  deposito_garantia?: number | null;
  moneda?: string | null;
  // Inquilino
  inquilino_nombre?: string | null;
  inquilino_apellido?: string | null;
  inquilino_dni?: string | null;
  inquilino_cuit?: string | null;
  inquilino_email?: string | null;
  inquilino_telefono?: string | null;
  inquilino_domicilio?: string | null;
  // Garante 1
  garante1_nombre?: string | null;
  garante1_apellido?: string | null;
  garante1_dni?: string | null;
  garante1_cuit?: string | null;
  garante1_email?: string | null;
  garante1_telefono?: string | null;
  garante1_domicilio?: string | null;
  // Garante 2
  garante2_nombre?: string | null;
  garante2_apellido?: string | null;
  garante2_dni?: string | null;
  garante2_cuit?: string | null;
  garante2_email?: string | null;
  garante2_telefono?: string | null;
  garante2_domicilio?: string | null;
  // Observaciones y estado
  observaciones?: string | null;
  lugar_celebracion?: string | null;
  estado?: string | null;
  fecha_rescision?: string | null;
  motivo_rescision?: string | null;
  contrato_origen_id?: number | null;
  // Relaciones
  archivos?: ContratoArchivo[];
  created_at?: string | null;
  updated_at?: string | null;
};

// ── Form values ──────────────────────────────────────────────────────────────

const optionalString = z.string().nullable().optional();
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().nullable().optional(),
);

export const contratoSchema = z.object({
  propiedad_id: z.coerce.number().nullable().optional(),
  tipo_contrato_id: z.coerce.number().nullable().optional(),
  tipo_actualizacion_id: z.coerce.number().nullable().optional(),
  fecha_inicio: optionalString,
  fecha_vencimiento: optionalString,
  fecha_renovacion: optionalString,
  duracion_meses: optionalNumber,
  valor_alquiler: optionalNumber,
  expensas: optionalNumber,
  deposito_garantia: optionalNumber,
  moneda: z.string().default("ARS"),
  inquilino_nombre: optionalString,
  inquilino_apellido: optionalString,
  inquilino_dni: optionalString,
  inquilino_cuit: optionalString,
  inquilino_email: optionalString,
  inquilino_telefono: optionalString,
  inquilino_domicilio: optionalString,
  garante1_nombre: optionalString,
  garante1_apellido: optionalString,
  garante1_dni: optionalString,
  garante1_cuit: optionalString,
  garante1_email: optionalString,
  garante1_telefono: optionalString,
  garante1_domicilio: optionalString,
  garante2_nombre: optionalString,
  garante2_apellido: optionalString,
  garante2_dni: optionalString,
  garante2_cuit: optionalString,
  garante2_email: optionalString,
  garante2_telefono: optionalString,
  garante2_domicilio: optionalString,
  observaciones: optionalString,
  lugar_celebracion: optionalString,
});

export type ContratoFormValues = z.infer<typeof contratoSchema>;

export const CONTRATO_DEFAULT: Partial<ContratoFormValues> = {
  moneda: "ARS",
  lugar_celebracion: "",
};

export const MONEDA_OPCIONES = [
  { id: "ARS", nombre: "ARS — Pesos" },
  { id: "USD", nombre: "USD — Dólares" },
  { id: "EUR", nombre: "EUR — Euros" },
];
