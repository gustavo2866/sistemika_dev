"use client";

import type { RaRecord } from "ra-core";

// --- Constantes --------------------------------------------------------------
export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
] as const;

// --- Tipos -------------------------------------------------------------------
export type DetalleItem = {
  id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
};

export type SolicitudFormValues = {
  id?: number;
  tipo: string;
  fecha_necesidad: string;
  solicitante_id: number;
  comentario: string;
  detalles: DetalleItem[];
};

export type SolicitudRecord = RaRecord & Partial<SolicitudFormValues>;

// --- Helpers -----------------------------------------------------------------
/**
 * Trunca un texto largo para mostrarlo en la lista
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima (por defecto 100)
 * @returns Texto truncado con "..." al final si excede el máximo
 */
export const truncateDescripcion = (
  text: string | null,
  maxLength = 100
): string => {
  if (!text) return "Sin descripción";
  return text.length > maxLength
    ? `${text.substring(0, maxLength)}...`
    : text;
};

/**
 * Obtiene el mensaje de error apropiado para una solicitud
 * @param error - Error capturado
 * @returns Mensaje de error legible para el usuario
 */
export const getSolicitudErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Ocurrió un error al procesar la solicitud";
};
