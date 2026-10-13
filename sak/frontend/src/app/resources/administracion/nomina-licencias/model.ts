"use client";

import { z } from "zod";

import { apiUrl } from "@/lib/dataProvider";

export const TIPO_NOVEDAD_CHOICES = [
  { id: "ACC", name: "Accidente" },
  { id: "ENF", name: "Enfermedad" },
  { id: "VAC", name: "Vacaciones" },
];

export const VALIDATION_RULES = {
  COMENTARIO: { MAX_LENGTH: 2000 },
  DOCUMENTOS: { MAX_ITEMS: 20 },
} as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const requiredId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive(),
);

const documentosFromInput = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
};

export type NominaLicencia = {
  id: number;
  nomina_id: number;
  tipo_novedad: string;
  fecha_desde: string;
  fecha_hasta?: string | null;
  comentario?: string | null;
  documentos?: string[] | null;
  nomina?: {
    id?: number;
    nombre?: string | null;
    apellido?: string | null;
    nro_legajo?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
};

export type NominaLicenciaDocumento = {
  url: string;
  nombre: string;
  content_type?: string | null;
  size?: number | null;
};

export const parseNominaLicenciaDocumento = (
  value: unknown,
): NominaLicenciaDocumento | null => {
  if (!value) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const url = String(record.url ?? record.archivo_url ?? "").trim();
    if (!url) return null;
    return {
      url,
      nombre:
        String(record.nombre ?? "").trim() ||
        url.split("/").pop() ||
        "Documento",
      content_type: record.content_type
        ? String(record.content_type)
        : null,
      size: Number.isFinite(Number(record.size)) ? Number(record.size) : null,
    };
  }

  const text = String(value).trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      return parseNominaLicenciaDocumento(JSON.parse(text));
    } catch {
      // Compatibilidad con documentos antiguos guardados como URL simple.
    }
  }
  return {
    url: text,
    nombre: text.split("/").pop() || "Documento",
  };
};

export const nominaLicenciaSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    nomina_id: requiredId,
    tipo_novedad: z.preprocess(
      emptyToUndefined,
      z.string().min(1).max(10),
    ),
    fecha_desde: z.string().min(1, "La fecha desde es obligatoria"),
    fecha_hasta: z.preprocess(
      emptyToUndefined,
      z.string().optional(),
    ),
    comentario: z.preprocess(
      emptyToUndefined,
      z.string().max(VALIDATION_RULES.COMENTARIO.MAX_LENGTH).optional(),
    ),
    documentos: z.preprocess(
      documentosFromInput,
      z
        .array(z.string())
        .max(VALIDATION_RULES.DOCUMENTOS.MAX_ITEMS),
    ),
  })
  .refine(
    (values) =>
      !values.fecha_desde ||
      !values.fecha_hasta ||
      values.fecha_hasta >= values.fecha_desde,
    {
      path: ["fecha_hasta"],
      message: "La fecha hasta no puede ser anterior a la fecha desde",
    },
  );

export type NominaLicenciaFormValues = z.infer<typeof nominaLicenciaSchema>;

export const NOMINA_LICENCIA_DEFAULT: NominaLicenciaFormValues = {
  nomina_id: undefined as unknown as number,
  tipo_novedad: "",
  fecha_desde: "",
  fecha_hasta: "",
  comentario: "",
  documentos: [],
};

export const normalizeNominaLicenciaPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  payload.nomina_id = Number(payload.nomina_id);
  payload.tipo_novedad = String(payload.tipo_novedad ?? "")
    .trim()
    .toUpperCase();
  payload.comentario = String(payload.comentario ?? "").trim() || null;
  payload.fecha_hasta = String(payload.fecha_hasta ?? "").trim() || null;
  payload.documentos = documentosFromInput(payload.documentos);

  return payload;
};

export type CoberturaNovedadConflictiva = {
  fecha: string;
  parte_diario_id: number;
  descripcion?: string | null;
};

export type ImpactoLicencia = {
  accion:
    | "agregar"
    | "actualizar"
    | "actualizar_tipo"
    | "actualizar_periodo"
    | "eliminar"
    | "reemplazar"
    | "sin_cambios";
  fecha: string;
  parte_diario_id: number;
  novedad_anterior?: string | null;
  novedad_nueva?: string | null;
  descripcion_anterior?: string | null;
  descripcion_nueva?: string | null;
};

export type TarjaCerradaLicencia = {
  tarja_id: number;
  fecha_desde: string;
  fecha_hasta: string;
};

export type CoberturaLicenciaResponse = {
  estado: "habilitada" | "bloqueada" | "requiere_confirmacion";
  mensaje: string;
  tarjas_cerradas: TarjaCerradaLicencia[];
  novedades_conflictivas: CoberturaNovedadConflictiva[];
  impacto: ImpactoLicencia[];
};

const coberturaAuthHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const validateNominaLicenciaPayload = async (data: unknown) => {
  const payload = normalizeNominaLicenciaPayload(data) as Record<string, unknown>;
  const response = await fetch(`${apiUrl}/nomina-licencias/validar-cobertura`, {
    method: "POST",
    headers: coberturaAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as
    | CoberturaLicenciaResponse
    | { detail?: string };
  if (!response.ok) {
    throw new Error(
      "detail" in result && result.detail
        ? result.detail
        : "No se pudo validar la cobertura de la licencia",
    );
  }

  const validacion = result as CoberturaLicenciaResponse;
  return { payload, validacion };
};

export const validateNominaLicenciaDelete = async (id: number) => {
  const response = await fetch(
    `${apiUrl}/nomina-licencias/${id}/validar-eliminacion`,
    {
      method: "POST",
      headers: coberturaAuthHeaders(),
    },
  );
  const result = (await response.json().catch(() => ({}))) as
    | CoberturaLicenciaResponse
    | { detail?: string };
  if (!response.ok) {
    throw new Error(
      "detail" in result && result.detail
        ? result.detail
        : "No se pudo validar la eliminacion de la licencia",
    );
  }
  const validacion = result as CoberturaLicenciaResponse;
  return validacion;
};
