import { DataProvider, Identifier, RaRecord } from "ra-core";

import type { SolicitudDetalleFormValue, SolicitudFormValues } from "./form";

export type SolicitudHeaderPayload = {
  tipo: string;
  fecha_necesidad: string;
  comentario?: string | null;
  solicitante_id: number;
};

export type SolicitudDetailPayload = {
  id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string | null;
  cantidad: number;
};

export const normalizeSolicitudValues = (values: SolicitudFormValues) => {
  const detalles = Array.isArray(values.detalles) ? values.detalles : [];
  const header: SolicitudHeaderPayload = {
    tipo: (values.tipo ?? "normal").toString(),
    fecha_necesidad: values.fecha_necesidad ?? "",
    solicitante_id: toNumber(values.solicitante_id) ?? 0,
  };

  if (values.comentario !== undefined) {
    const comentario = sanitizeText(values.comentario);
    header.comentario = comentario ?? null;
  }

  const detailPayloads = detalles
    .map(normalizeDetalle)
    .filter((detail): detail is SolicitudDetailPayload => detail !== null);

  return { header, detalles: detailPayloads };
};

export const createSolicitudDetalles = async (
  dataProvider: DataProvider,
  solicitudId: Identifier,
  detalles: SolicitudDetailPayload[],
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

export const syncSolicitudDetalles = async (
  dataProvider: DataProvider,
  solicitudId: Identifier,
  detalles: SolicitudDetailPayload[],
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
  const incomingById = new Map<number, SolicitudDetailPayload>();
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

  await createSolicitudDetalles(dataProvider, solicitudId, creations);
};

export const getErrorMessage = (error: unknown, fallback: string) => {
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
