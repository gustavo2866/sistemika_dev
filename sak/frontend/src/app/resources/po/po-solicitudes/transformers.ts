"use client";

import { roundCurrency } from "@/lib/formatters";
import {
  calculateImporte,
  calculateTotal,
  normalizeId,
  normalizeOptionalNumber,
} from "../shared/po-utils";
import type { PoSolicitudPayload, WizardCreatePayload } from "./model";

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

// Resuelve el centro de costo segun reglas de negocio.
export const resolveCentroCostoId = ({
  oportunidadId,
  departamentoNombre,
  departamentoCentroCostoId,
  solicitanteCentroCostoId,
}: {
  oportunidadId: string | null;
  departamentoNombre: string | null;
  departamentoCentroCostoId: number | null;
  solicitanteCentroCostoId: number | null;
}): number | null => {
  if (oportunidadId) return null;
  const isDirector =
    typeof departamentoNombre === "string" &&
    departamentoNombre.toLowerCase().includes("director");
  const defaultCentroCostoId = Number(departamentoCentroCostoId ?? 0);
  const solicitanteCentroCosto = Number(solicitanteCentroCostoId ?? 0);
  if (isDirector) {
    return Number.isFinite(solicitanteCentroCosto) && solicitanteCentroCosto > 0
      ? solicitanteCentroCosto
      : null;
  }
  return Number.isFinite(defaultCentroCostoId) && defaultCentroCostoId > 0
    ? defaultCentroCostoId
    : null;
};

// Arma subtitulo de cabecera combinando titulo y proveedor.
export const buildPoSolicitudCabeceraSubtitle = ({
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

export const buildPoSolicitudImputacionSubtitle = ({
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
  articulo_id: number;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export const buildPoSolicitudPayload = (payload: PoSolicitudPayload): WizardCreatePayload => {
  const normalizeIdValue = (value: number | string | null | undefined) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    return normalizeId(value ?? null);
  };

  const normalizedProveedorId = normalizeIdValue(payload.proveedor_id);
  const normalizedSolicitanteId = normalizeIdValue(payload.solicitante_id);
  const normalizedTipoSolicitudId = normalizeIdValue(payload.tipo_solicitud_id);
  const normalizedDepartamentoId = normalizeIdValue(payload.departamento_id);
  const normalizedCentroCostoId = normalizeIdValue(payload.centro_costo_id);
  const normalizedOportunidadId = normalizeIdValue(payload.oportunidad_id);

  const hasTipoCompra =
    payload.tipo_compra && String(payload.tipo_compra).trim().length > 0;
  const resolvedTipoCompra =
    normalizedProveedorId != null
      ? resolveTipoCompra(normalizedProveedorId)
      : hasTipoCompra
        ? payload.tipo_compra
        : resolveTipoCompra(normalizedProveedorId);

  const resolvedFecha =
    payload.fecha_necesidad && String(payload.fecha_necesidad).trim().length > 0
      ? payload.fecha_necesidad
      : null;

  const detalles = (payload.detalles ?? [])
    .map((detalle) => {
      const normalizedArticuloId = normalizeIdValue(detalle.articulo_id);
      if (normalizedArticuloId == null) {
        return null;
      }
      const cantidad = normalizeOptionalNumber(detalle.cantidad ?? null);
      const precio = normalizeOptionalNumber(detalle.precio ?? null);
      const importe =
        cantidad != null && precio != null
          ? calculateImporte(cantidad, precio)
          : normalizeOptionalNumber(detalle.importe ?? null) ?? 0;

      return {
        articulo_id: normalizedArticuloId,
        descripcion: detalle.descripcion ?? "",
        unidad_medida: detalle.unidad_medida ?? "UN",
        cantidad: cantidad ?? 0,
        precio: precio ?? 0,
        importe,
      };
    })
    .filter((detalle): detalle is NormalizedDetallePayload => Boolean(detalle));

  const total = roundCurrency(calculateTotal(detalles));

  return {
    titulo: payload.titulo ?? "",
    tipo_solicitud_id: normalizedTipoSolicitudId,
    departamento_id: normalizedDepartamentoId,
    centro_costo_id: normalizedCentroCostoId,
    tipo_compra: resolvedTipoCompra,
    proveedor_id: normalizedProveedorId,
    solicitante_id: normalizedSolicitanteId,
    oportunidad_id: normalizedOportunidadId,
    fecha_necesidad: resolvedFecha,
    comentario: payload.comentario ?? "",
    total,
    detalles,
  };
};
