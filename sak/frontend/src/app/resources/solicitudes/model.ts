"use client";

import type { RaRecord } from "ra-core";
import {
  ObjectSchema,
  FormValuesFromSchema,
  ModelValuesFromSchema,
  PayloadFromSchema,
  sanitizeText,
  toNumber,
  formatSolicitudSummary,
  getSolicitudErrorMessage,
  truncateDescripcion,
} from "@/components/form/helpers/detailHelpers";

export { getSolicitudErrorMessage, truncateDescripcion, formatSolicitudSummary };

// --- Constantes --------------------------------------------------------------
export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
] as const;

// --- Esquemas ---------------------------------------------------------------
export const SolicitudDetalleSchema: ObjectSchema = {
  fields: {
    id: {
      formDefault: "",
      toForm: (valor: unknown) => (valor != null ? String(valor) : ""),
      toModel: (valor: unknown) => {
        const numero = toNumber(valor);
        return numero ?? undefined;
      },
    },
    articulo_id: {
      formDefault: "",
      toForm: (valor: unknown) => (valor != null ? String(valor) : ""),
      toModel: (valor: unknown) => toNumber(valor) ?? null,
    },
    descripcion: {
      formDefault: "",
      toForm: (valor: unknown) => (valor as string | undefined) ?? "",
      toModel: (valor: unknown) => sanitizeText(valor) ?? "",
      validations: [
        {
          nombre: "requerido",
          mensaje: "La descripcion es obligatoria.",
          validar: (valor: string) => typeof valor === "string" && valor.trim().length > 0,
        },
      ],
    },
    unidad_medida: {
      formDefault: "UN",
      toForm: (valor: unknown) => (valor as string | undefined) ?? "UN",
      toModel: (valor: unknown) => sanitizeText(valor) ?? null,
    },
    cantidad: {
      formDefault: "",
      toForm: (valor: unknown) => (valor != null ? String(valor) : ""),
      toModel: (valor: unknown) => toNumber(valor) ?? 0,
    },
  },
};

export const SolicitudFormSchema: ObjectSchema = {
  fields: {
    tipo: {
      formDefault: "normal",
      toForm: (valor: unknown) => (valor ?? "normal").toString(),
      toModel: (valor: unknown) => {
        const texto = typeof valor === "string" ? valor.trim() : "";
        return texto.length > 0 ? texto : "normal";
      },
      validations: [
        {
          nombre: "requerido",
          mensaje: "El tipo es obligatorio.",
          validar: (valor: string) => typeof valor === "string" && valor.trim().length > 0,
        },
      ],
    },
    fecha_necesidad: {
      formDefault: "",
      toForm: (valor: unknown) => (valor as string | undefined) ?? "",
      toModel: (valor: unknown) => (typeof valor === "string" ? valor : ""),
    },
    comentario: {
      formDefault: "",
      toForm: (valor: unknown) => (valor as string | undefined) ?? "",
      toModel: (valor: unknown) => sanitizeText(valor) ?? null,
    },
    solicitante_id: {
      formDefault: "",
      toForm: (valor: unknown) => (valor != null ? String(valor) : ""),
      toModel: (valor: unknown) => toNumber(valor) ?? 0,
    },
    version: {
      formDefault: undefined,
      toForm: (valor: unknown) => valor ?? undefined,
      toModel: (valor: unknown) => valor,
    },
    resumen: {
      formDefault: "",
      includeInPayload: false,
      computed: {
        dependencies: ["tipo", "comentario", "fecha_necesidad"],
        compute: (formulario: Record<string, unknown>) =>
          formatSolicitudSummary({
            tipo: formulario.tipo as string,
            comentario: formulario.comentario as string,
            fechaNecesidad: formulario.fecha_necesidad as string,
          }),
      },
    },
    detalles: {
      type: "array",
      formDefault: () => [],
      item: SolicitudDetalleSchema,
    },
  },
};

// --- Tipos derivados --------------------------------------------------------
export type DetalleEditorValues = FormValuesFromSchema<typeof SolicitudDetalleSchema>;
export type SolicitudDetailPayload = PayloadFromSchema<typeof SolicitudDetalleSchema>;
export type SolicitudFormValues = FormValuesFromSchema<typeof SolicitudFormSchema>;
export type SolicitudPayload = PayloadFromSchema<typeof SolicitudFormSchema>;

export type SolicitudRecord = RaRecord &
  Partial<ModelValuesFromSchema<typeof SolicitudFormSchema>>;
