/**
 * Modelo de dominio para Estados de Orden de Compra (PO)
 */

import { createEntitySchema, numberField, stringField } from "@/lib/form-detail-schema";

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 50,
  },
  DESCRIPCION: {
    MAX_LENGTH: 200,
  },
} as const;

export type PoOrderStatus = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  activo: boolean;
  es_inicial: boolean;
  es_final: boolean;
  created_at: string;
  updated_at: string;
};

export type PoOrderStatusFormValues = {
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
  es_inicial: boolean;
  es_final: boolean;
};

export const poOrderStatusSchema = createEntitySchema<
  PoOrderStatusFormValues,
  Omit<PoOrderStatus, "id" | "created_at" | "updated_at">
>({
  fields: {
    nombre: stringField({
      required: true,
      maxLength: VALIDATION_RULES.NOMBRE.MAX_LENGTH,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: VALIDATION_RULES.DESCRIPCION.MAX_LENGTH,
      defaultValue: "",
    }),
    orden: numberField({
      required: true,
      min: 1,
      defaultValue: 1,
    }),
  },
});

export const PO_ORDER_STATUS_DEFAULT: PoOrderStatusFormValues = {
  nombre: "",
  descripcion: "",
  orden: 1,
  activo: true,
  es_inicial: false,
  es_final: false,
};
