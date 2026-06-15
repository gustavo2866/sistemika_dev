"use client";

import { z } from "zod";

export const PEDIDO_ESTADO_CHOICES = [
  { id: "borrador", name: "Borrador" },
  { id: "cerrado", name: "Cerrado" },
  { id: "emitido", name: "Emitido" },
  { id: "cancelado", name: "Cancelado" },
];

export const PEDIDO_ORIGEN_CHOICES = [
  { id: "agente", name: "Agente" },
  { id: "manual", name: "Manual" },
];

export const PEDIDO_DETALLE_ESTADO_CHOICES = [
  { id: "activa", name: "Activa" },
  { id: "cancelada", name: "Cancelada" },
];

export const PEDIDO_DETALLE_ORIGEN_CHOICES = [
  { id: "agente", name: "Agente" },
  { id: "manual", name: "Manual" },
];

export const PEDIDO_ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-amber-100 text-amber-800",
  cerrado: "bg-emerald-100 text-emerald-800",
  emitido: "bg-sky-100 text-sky-800",
  cancelado: "bg-zinc-100 text-zinc-800",
};

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const requiredId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive(),
);

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

export type ConstructoraPedidoDetalle = {
  id?: number | string;
  pedido_id?: number | string;
  articulo_id?: number | string | null;
  tipo_solicitud_id?: number | string | null;
  descripcion_original?: string | null;
  descripcion?: string | null;
  unidad_medida?: string | null;
  estado?: string | null;
  origen?: string | null;
  cantidad?: number | string | null;
  cantidad_original?: number | string | null;
  centro_costo_id?: number | string | null;
  po_order_id?: number | string | null;
  po_order_detail_id?: number | string | null;
  orden?: number | string | null;
};

export type ConstructoraPedidoRecord = {
  id: number | string;
  oportunidad_id?: number | string | null;
  contacto_id?: number | string | null;
  mensaje_origen_id?: number | string | null;
  estado?: string | null;
  origen?: string | null;
  titulo?: string | null;
  observaciones?: string | null;
  solicitante_id?: number | string | null;
  responsable_revision_id?: number | string | null;
  fecha_confirmacion_agente?: string | null;
  fecha_revision?: string | null;
  fecha_generacion_po?: string | null;
  created_at?: string | null;
  contacto?: {
    id?: number | string | null;
    nombre_completo?: string | null;
  } | null;
  detalles?: ConstructoraPedidoDetalle[];
};

export const pedidoDetalleSchema = z.object({
  id: optionalId,
  articulo_id: optionalId,
  tipo_solicitud_id: optionalId,
  descripcion_original: optionalString.pipe(z.string().max(500).optional()),
  descripcion: optionalString.pipe(z.string().max(500).optional()),
  unidad_medida: optionalString.pipe(z.string().max(50).optional()),
  estado: z.enum(["activa", "cancelada"]).default("activa"),
  origen: z.enum(["agente", "manual"]).default("manual"),
  cantidad: z.coerce.number().min(0),
  cantidad_original: z.coerce.number().min(0).optional(),
  centro_costo_id: optionalId,
  po_order_id: optionalId,
  po_order_detail_id: optionalId,
  orden: z.coerce.number().int().optional(),
});

export const pedidoSchema = z.object({
  oportunidad_id: requiredId,
  contacto_id: optionalId,
  mensaje_origen_id: optionalId,
  estado: z.enum(["borrador", "cerrado", "emitido", "cancelado"]).default("borrador"),
  origen: z.enum(["agente", "manual"]).default("manual"),
  titulo: z.string().min(1).max(300),
  observaciones: optionalString,
  solicitante_id: optionalId,
  responsable_revision_id: optionalId,
  detalles: z.array(pedidoDetalleSchema),
});

export type PedidoFormValues = z.infer<typeof pedidoSchema>;

export const getPedidoDetalleDefaults = () => ({
  articulo_id: "",
  tipo_solicitud_id: "",
  descripcion_original: "",
  descripcion: "",
  unidad_medida: "",
  estado: "activa",
  origen: "manual",
  cantidad: 1,
  cantidad_original: 1,
  centro_costo_id: "",
  orden: 0,
});

export const PEDIDO_DEFAULTS: PedidoFormValues = {
  oportunidad_id: undefined as unknown as number,
  estado: "borrador",
  origen: "manual",
  titulo: "",
  observaciones: "",
  detalles: [getPedidoDetalleDefaults()],
} as unknown as PedidoFormValues;

export const getPedidoEstadoBadgeClass = (estado?: string | null) =>
  PEDIDO_ESTADO_BADGES[String(estado ?? "").trim().toLowerCase()] ?? "bg-slate-100 text-slate-800";

export const isPedidoReadOnly = (estado?: string | null) =>
  ["emitido", "cancelado"].includes(String(estado ?? "").trim().toLowerCase());

export const normalizePedidoPayload = (data: Partial<PedidoFormValues>) => ({
  ...data,
  estado: data.estado ?? "borrador",
  origen: data.origen ?? "manual",
  titulo: String(data.titulo ?? "").trim(),
  observaciones: String(data.observaciones ?? "").trim() || null,
  detalles: (data.detalles ?? []).map((detalle, index) => ({
    ...detalle,
    descripcion_original: detalle.descripcion_original || null,
    descripcion: String(detalle.descripcion ?? "").trim() || null,
    unidad_medida: String(detalle.unidad_medida ?? "").trim() || null,
    estado: detalle.estado ?? "activa",
    origen: detalle.origen ?? "manual",
    cantidad: Number(detalle.cantidad),
    cantidad_original: Number(detalle.cantidad_original ?? detalle.cantidad ?? 0),
    orden: Number(detalle.orden ?? index),
  })),
});

export const pedidoTieneDatosRevisionCompletos = (record?: ConstructoraPedidoRecord | null) => {
  const detalles = Array.isArray(record?.detalles) ? record.detalles : [];
  return (
    detalles.length > 0 &&
    detalles.every((detalle) => {
      const cantidad = Number(detalle.cantidad ?? 0);
      return Boolean(detalle.articulo_id) && Boolean(detalle.tipo_solicitud_id) && cantidad >= 0;
    })
  );
};
