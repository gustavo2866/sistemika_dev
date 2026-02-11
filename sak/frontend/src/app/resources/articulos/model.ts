"use client";

import { z } from "zod";

export const ARTICULO_RULES = {
  NOMBRE: {
    MAX_LENGTH: 255,
  },
  UNIDAD_MEDIDA: {
    MAX_LENGTH: 50,
  },
  MARCA: {
    MAX_LENGTH: 100,
  },
  SKU: {
    MAX_LENGTH: 100,
  },
} as const;

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const articuloSchema = z.object({
  nombre: z.string().min(1).max(ARTICULO_RULES.NOMBRE.MAX_LENGTH),
  tipo_articulo_id: optionalId,
  unidad_medida: z.string().min(1).max(ARTICULO_RULES.UNIDAD_MEDIDA.MAX_LENGTH),
  marca: optionalString.pipe(z.string().max(ARTICULO_RULES.MARCA.MAX_LENGTH).optional()),
  sku: optionalString.pipe(z.string().max(ARTICULO_RULES.SKU.MAX_LENGTH).optional()),
  precio: z.coerce.number().min(0),
  proveedor_id: optionalId,
  activo: booleanFromInput,
  generico: booleanFromInput,
});

export type ArticuloFormValues = z.infer<typeof articuloSchema>;

export const ARTICULO_DEFAULTS = {
  nombre: "",
  unidad_medida: "",
  marca: "",
  sku: "",
  precio: 0,
  activo: true,
  generico: false,
} satisfies Partial<ArticuloFormValues>;

export enum TipoArticulo {
  Material = "Material",
  Ferreteria = "Ferreteria",
  Herramienta = "Herramienta",
  Sanitario = "Sanitario",
  Griferia = "Griferia",
  Perfileria = "Perfileria",
  Pintura = "Pintura",
  Sellador = "Sellador",
  Impermeabilizante = "Impermeabilizante",
}

export const TIPO_ARTICULO_CHOICES = Object.values(TipoArticulo).map((value) => ({
  id: value,
  name: value,
}));

export type TipoArticuloValue = `${TipoArticulo}`;
