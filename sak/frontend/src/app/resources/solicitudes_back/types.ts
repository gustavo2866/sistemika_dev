/**
 * Solicitudes Domain Model
 *
 * Domain-specific types and constants for the solicitudes resource.
 */

"use client";

import type { RaRecord } from "ra-core";

// --- Constantes Específicas --------------------------------------------------
export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
] as const;

// --- Tipos de Dominio --------------------------------------------------------
export type DetalleItem = {
  id?: number;
  articulo_id: number | null;
  articulo_nombre?: string; // Nombre del artículo para mostrar en la tarjeta
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

