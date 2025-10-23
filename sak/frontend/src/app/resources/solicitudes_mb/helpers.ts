import type {
  SolicitudMbDetalleFormValue,
  SolicitudMbFormValues,
} from "./types";

export type SolicitudMbHeaderPayload = {
  tipo: string;
  fecha_necesidad: string;
  solicitante_id: number;
  comentario: string | null;
  version?: number;
};

export type SolicitudMbDetailPayload = {
  id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string | null;
  cantidad: number;
};

export type SolicitudMbPayload = SolicitudMbHeaderPayload & {
  detalles: SolicitudMbDetailPayload[];
};

export const normalizeSolicitudMbValues = (
  values: SolicitudMbFormValues,
): SolicitudMbPayload => {
  const detalles = Array.isArray(values.detalles) ? values.detalles : [];

  const header: SolicitudMbHeaderPayload = {
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
    .filter((detalle): detalle is SolicitudMbDetailPayload => detalle !== null);

  return {
    ...header,
    detalles: detailPayloads,
  };
};

const normalizeDetalle = (
  detalle: SolicitudMbDetalleFormValue,
): SolicitudMbDetailPayload | null => {
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

export const getSolicitudMbErrorMessage = (error: unknown, fallback: string) => {
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
