import { DataProvider, Identifier, RaRecord } from "ra-core";

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

export const normalizeSolicitudMbValues = (values: SolicitudMbFormValues) => {
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

  return { header, detalles: detailPayloads };
};

export const createSolicitudMbDetalles = async (
  dataProvider: DataProvider,
  solicitudId: Identifier,
  detalles: SolicitudMbDetailPayload[],
) => {
  if (!detalles.length) {
    return;
  }

  await Promise.all(
    detalles.map((detalle) =>
      dataProvider.create("solicitud-detalles", {
        data: {
          ...detalle,
          solicitud_id: solicitudId,
        },
      }),
    ),
  );
};

export const syncSolicitudMbDetalles = async (
  dataProvider: DataProvider,
  solicitudId: Identifier,
  detalles: SolicitudMbDetailPayload[],
) => {
  const { data: current } = await dataProvider.getList<RaRecord>(
    "solicitud-detalles",
    {
      filter: { solicitud_id: solicitudId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const currentIds = current.map((item) => item.id).filter(Boolean) as number[];
  const incomingById = new Map<number, SolicitudMbDetailPayload>();

  detalles.forEach((detalle) => {
    if (detalle.id != null) {
      incomingById.set(detalle.id, detalle);
    }
  });

  const idsToDelete = currentIds.filter((id) => !incomingById.has(id));
  if (idsToDelete.length) {
    await dataProvider.deleteMany("solicitud-detalles", { ids: idsToDelete });
  }

  const updates = detalles.filter((detalle) => detalle.id != null);
  const creations = detalles.filter((detalle) => detalle.id == null);

  await Promise.all(
    updates.map((detalle) =>
      dataProvider.update("solicitud-detalles", {
        id: detalle.id as Identifier,
        data: {
          ...detalle,
          solicitud_id: solicitudId,
        },
        previousData: current.find((item) => item.id === detalle.id) ?? {},
      }),
    ),
  );

  await createSolicitudMbDetalles(dataProvider, solicitudId, creations);
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
