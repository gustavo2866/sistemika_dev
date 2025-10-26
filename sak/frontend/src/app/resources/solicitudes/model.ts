"use client";

import type { RaRecord } from "ra-core";

export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
] as const;

export type SolicitudDetalleFormValue = {
  id?: number;
  articulo_id?: number | null;
  descripcion?: string;
  unidad_medida?: string | null;
  cantidad?: number | string | null;
};

export type SolicitudFormValues = {
  id?: number;
  version?: number;
  tipo?: "normal" | "directa";
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number | string;
  detalles?: SolicitudDetalleFormValue[];
};

export type SolicitudRecord = RaRecord & {
  version?: number;
  detalles?: SolicitudDetalleFormValue[];
};

export type DetalleEditorValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: string;
};

export type EditorState =
  | { mode: "create" }
  | { mode: "edit"; index: number; existingId?: number };

export const emptyDetalle: DetalleEditorValues = {
  articulo_id: "",
  descripcion: "",
  unidad_medida: "UN",
  cantidad: "",
};

export const mapDetalleRecords = (
  detalles: SolicitudDetalleFormValue[] = [],
) =>
  detalles.map((detalle) => ({
    id: detalle.id,
    articulo_id: detalle.articulo_id ?? undefined,
    descripcion: detalle.descripcion ?? "",
    unidad_medida: detalle.unidad_medida ?? "",
    cantidad: detalle.cantidad ?? 0,
  }));

export type SolicitudHeaderPayload = {
  tipo: string;
  fecha_necesidad: string;
  solicitante_id: number;
  comentario: string | null;
  version?: number;
};

export type SolicitudDetailPayload = {
  id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string | null;
  cantidad: number;
};

export type SolicitudPayload = SolicitudHeaderPayload & {
  detalles: SolicitudDetailPayload[];
};

export const normalizeSolicitudValues = (
  values: SolicitudFormValues,
): SolicitudPayload => {
  const detalles = Array.isArray(values.detalles) ? values.detalles : [];

  const header: SolicitudHeaderPayload = {
    tipo: (values.tipo ?? "normal").toString(),
    fecha_necesidad: values.fecha_necesidad ?? "",
    solicitante_id: toNumber(values.solicitante_id) ?? 0,
    comentario: sanitizeText(values.comentario) ?? null,
  };

  if (values.version != null) {
    header.version = values.version;
  }

  const detailPayloads = detalles
    .map(normalizeDetalle)
    .filter((detalle): detalle is SolicitudDetailPayload => detalle !== null);

  return {
    ...header,
    detalles: detailPayloads,
  };
};

const normalizeDetalle = (
  detalle: SolicitudDetalleFormValue,
): SolicitudDetailPayload | null => {
  const cantidad = toNumber(detalle.cantidad);
  const descripcion = sanitizeText(detalle.descripcion);
  const unidad = sanitizeText(detalle.unidad_medida) ?? null;
  const articuloId = toNumber(detalle.articulo_id);

  if (
    descripcion == null &&
    articuloId == null &&
    (cantidad == null || Number.isNaN(cantidad))
  ) {
    return null;
  }

  return {
    id: detalle.id,
    articulo_id: articuloId ?? null,
    descripcion: descripcion ?? "",
    unidad_medida: unidad,
    cantidad: cantidad ?? 0,
  };
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const sanitizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getSolicitudErrorMessage = (error: unknown, fallback: string) => {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

export const truncateDescripcion = (value: string | null | undefined) => {
  if (!value) {
    return "Sin descripcion";
  }
  return value.length > 35 ? `${value.substring(0, 35).trimEnd()}...` : value;
};

export const formatSolicitudSummary = (params: {
  tipo?: string | null;
  comentario?: string | null;
  fechaNecesidad?: string | null;
}) => {
  const tipoText = params.tipo === "directa" ? "Compra Directa" : "Normal";
  const comentarioText = params.comentario
    ? params.comentario.length > 50
      ? `${params.comentario.substring(0, 50)}...`
      : params.comentario
    : "Sin comentario";
  const fechaText = params.fechaNecesidad || "Sin fecha";

  return `${tipoText} • ${comentarioText} • ${fechaText}`;
};

