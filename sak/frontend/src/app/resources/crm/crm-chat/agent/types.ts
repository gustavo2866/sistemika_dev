"use client";

export type AIDeliveryResult = {
  sent?: boolean | null;
  status?: string | null;
  outbound_message_id?: number | null;
  meta_message_id?: string | null;
  error_message?: string | null;
};

export type MaterialRequestAnalysis = {
  status?: string | null;
  items?: unknown[];
  observaciones?: unknown[];
};

export type MaterialRequestSolicitud = {
  oportunidad_id?: number | null;
  activa?: boolean | null;
  estado_solicitud?: string | null;
  version?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  ultimo_mensaje_id?: number | null;
  items?: unknown[];
  observaciones?: unknown[];
};

export type MaterialRequestItem = {
  descripcion_original?: string | null;
  descripcion_actual?: string | null;
  descripcion_normalizada?: string | null;
  cantidad?: unknown;
  unidad?: string | null;
  familia?: string | null;
  familia_es_nueva?: boolean | null;
  familia_estado?: string | null;
  familia_sugerida?: MaterialFamily | null;
  atributos?: Record<string, unknown> | null;
  faltantes?: string[] | null;
  consulta?: string | null;
  consulta_atributo?: string | null;
};

export type MaterialFamilyAttribute = {
  nombre: string;
  descripcion?: string | null;
  default?: unknown;
  obligatorio?: boolean | null;
  tipo_dato?: "numero" | "enum" | null;
  valores_posibles?: string[] | null;
};

export type MaterialFamily = {
  codigo: string;
  nombre: string;
  estado?: "sugerida" | "confirmada" | null;
  descripcion?: string | null;
  tags: string[];
  atributos: MaterialFamilyAttribute[];
};

export type AIReplyResult = {
  type?: string;
  intent?: string | null;
  confidence?: number | null;
  respuesta?: string | null;
  reason?: string | null;
  skipped?: boolean;
  analysis?: MaterialRequestAnalysis | Record<string, unknown> | null;
  solicitud?: MaterialRequestSolicitud | null;
  delivery_mode?: string | null;
  delivery?: AIDeliveryResult | null;
  cached?: boolean;
  process_name?: string | null;
  execution?: Record<string, unknown> | null;
  debug_timings?: {
    prompt_ms?: number | null;
    llm_ms?: number | null;
    normalize_ms?: number | null;
  } | null;
  modelo?: string | null;
  warnings?: string[];
};

export const getMaterialRequestItems = (result: AIReplyResult | null): MaterialRequestItem[] => {
  const analysis = result?.analysis;
  if (!analysis || typeof analysis !== "object" || !("items" in analysis)) {
    return [];
  }
  const rawItems = Array.isArray(analysis.items) ? analysis.items : [];
  return rawItems.filter(
    (item): item is MaterialRequestItem => Boolean(item && typeof item === "object"),
  );
};
