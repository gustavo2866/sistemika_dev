"use client";

import { roundCurrency } from "@/lib/formatters";
import {
  calculateImporte,
  normalizeId,
  normalizeOptionalNumber,
} from "../shared/po-utils";
import type { PoOrdenCompraPayload, WizardCreatePayload } from "./model";

// Limites para truncar texto en la UI
export const TEXT_LIMITS = {
  ARTICLE_NAME: 30,
  DESCRIPTION: 90,
} as const;

// Trunca texto a un limite especifico.
export function truncateText(value: string, limit: number): string {
  if (!value) return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

// Resuelve el tipo de compra segun la presencia de proveedor.
export const resolveTipoCompra = (proveedorId: number | null) =>
  proveedorId ? "directa" : "normal";

// Arma subtitulo de cabecera combinando titulo y proveedor.
export const buildPoOrdenCompraCabeceraSubtitle = ({
  titulo,
  tipoSolicitudNombre,
}: {
  titulo?: string | null;
  tipoSolicitudNombre?: string | null;
}) => {
  const safeTitulo = titulo?.trim() ? titulo.trim() : "Sin titulo";
  const safeTipo = tipoSolicitudNombre?.trim()
    ? tipoSolicitudNombre.trim()
    : "Sin tipo";
  return `Titulo: ${safeTitulo} (${safeTipo})`;
};

export const buildPoOrdenCompraImputacionSubtitle = ({
  oportunidadTitulo,
  centroCostoNombre,
}: {
  oportunidadTitulo?: string | null;
  centroCostoNombre?: string | null;
}) => {
  const safeOportunidad = oportunidadTitulo?.trim();
  if (safeOportunidad) return `Oportunidad: ${safeOportunidad}`;
  const safeCentro = centroCostoNombre?.trim();
  if (safeCentro) return `Centro costo: ${safeCentro}`;
  return "Sin imputacion";
};

type NormalizedDetallePayload = {
  id?: number;
  articulo_id: number;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total_linea: number;
  centro_costo_id: number | null;
  oportunidad_id: number | null;
  solicitud_detalle_id: number | null;
};

export const buildPoOrdenCompraPayload = (
  payload?: PoOrdenCompraPayload
): WizardCreatePayload => {
  const safePayload = payload ?? ({} as PoOrdenCompraPayload);
  const normalizeIdValue = (value: number | string | null | undefined) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value === 0) return null;
      return value;
    }
    const normalized = normalizeId(value ?? null);
    return normalized && normalized !== 0 ? normalized : null;
  };

  const normalizedProveedorId = normalizeIdValue(safePayload.proveedor_id);
  const normalizedResponsableId = normalizeIdValue(safePayload.usuario_responsable_id);
  const normalizedMetodoPagoId = normalizeIdValue(safePayload.metodo_pago_id);
  const normalizedTipoSolicitudId = normalizeIdValue(safePayload.tipo_solicitud_id);
  const normalizedDepartamentoId = normalizeIdValue(safePayload.departamento_id);
  const normalizedCentroCostoId = normalizeIdValue(safePayload.centro_costo_id);
  const normalizedOportunidadId = normalizeIdValue(safePayload.oportunidad_id);

  const hasTipoCompra =
    safePayload.tipo_compra && String(safePayload.tipo_compra).trim().length > 0;
  const resolvedTipoCompra =
    normalizedProveedorId != null
      ? resolveTipoCompra(normalizedProveedorId)
      : hasTipoCompra
        ? safePayload.tipo_compra
        : resolveTipoCompra(normalizedProveedorId);

  const resolvedFecha =
    safePayload.fecha && String(safePayload.fecha).trim().length > 0
      ? safePayload.fecha
      : null;

  const detalles = (safePayload.detalles ?? [])
    .map((detalle) => {
      const normalizedDetalleId = normalizeIdValue((detalle as { id?: number | string | null }).id);
      const normalizedArticuloId = normalizeIdValue(detalle.articulo_id);
      if (normalizedArticuloId == null) {
        return null;
      }
      const cantidad = normalizeOptionalNumber(detalle.cantidad ?? null);
      const precioUnitario = normalizeOptionalNumber(detalle.precio_unitario ?? null);
      const subtotal =
        cantidad != null && precioUnitario != null
          ? calculateImporte(cantidad, precioUnitario)
          : normalizeOptionalNumber(detalle.subtotal ?? null) ?? 0;
      const totalLinea = normalizeOptionalNumber(detalle.total_linea ?? null) ?? subtotal;

      return {
        ...(normalizedDetalleId != null ? { id: normalizedDetalleId } : {}),
        articulo_id: normalizedArticuloId,
        descripcion: detalle.descripcion ?? "",
        unidad_medida: detalle.unidad_medida ?? "UN",
        cantidad: cantidad ?? 0,
        precio_unitario: precioUnitario ?? 0,
        subtotal,
        total_linea: totalLinea,
        centro_costo_id: normalizeIdValue(detalle.centro_costo_id) ?? null,
        oportunidad_id: normalizeIdValue(detalle.oportunidad_id) ?? null,
        solicitud_detalle_id: normalizeIdValue(detalle.solicitud_detalle_id) ?? null,
      };
    })
    .filter((detalle): detalle is NormalizedDetallePayload => Boolean(detalle));

  const subtotal = roundCurrency(
    detalles.reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0)
  );
  const total = roundCurrency(
    detalles.reduce((acc, item) => acc + Number(item.total_linea ?? 0), 0)
  );

  const normalizedEstado =
    typeof safePayload.estado === "string" && safePayload.estado.trim().length > 0
      ? safePayload.estado
      : undefined;

  return {
    titulo: safePayload.titulo ?? "",
    tipo_solicitud_id: normalizedTipoSolicitudId,
    departamento_id: normalizedDepartamentoId,
    centro_costo_id: normalizedCentroCostoId,
    tipo_compra: resolvedTipoCompra,
    ...(normalizedEstado ? { estado: normalizedEstado } : {}),
    proveedor_id: normalizedProveedorId,
    usuario_responsable_id: normalizedResponsableId,
    metodo_pago_id: normalizedMetodoPagoId,
    oportunidad_id: normalizedOportunidadId,
    fecha: resolvedFecha,
    observaciones: safePayload.observaciones ?? "",
    subtotal,
    total_impuestos: 0,
    total,
    detalles,
  };
};
