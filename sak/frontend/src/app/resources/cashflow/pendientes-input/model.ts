"use client";

import { z } from "zod";

const optionalText = (maxLength?: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    (maxLength ? z.string().trim().max(maxLength) : z.string().trim()).optional(),
  );

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const ERP_CASH_PENDIENTES_INPUT_IMPORT_STATUS_CHOICES = [
  { id: "pending", name: "Pendiente" },
  { id: "processing", name: "Procesando" },
  { id: "imported", name: "Importado" },
  { id: "failed", name: "Fallido" },
];

export const ERP_CASH_PENDIENTES_INPUT_VALIDATION_STATUS_CHOICES = [
  { id: "pending", name: "Pendiente" },
  { id: "valid", name: "Válido" },
  { id: "invalid", name: "Inválido" },
];

export type ErpCashPendientesInput = {
  id: number | string;
  erp_empresa_id: number | string;
  cuenta_cash_id?: number | string | null;
  cuenta_cash?: {
    id: number | string;
    tipo?: string | null;
    descripcion?: string | null;
  } | null;
  uploaded_at: string;
  uploaded_by?: number | string | null;
  source_name: string;
  file_name: string;
  file_hash?: string | null;
  import_status: "pending" | "processing" | "imported" | "failed";
  validation_status: "pending" | "valid" | "invalid";
  row_number: number | string;
  tipcomp_raw?: string | null;
  nombre_raw?: string | null;
  sucursal_raw?: string | null;
  nrocomp_raw?: string | null;
  tipsub_raw?: string | null;
  nrosub_raw?: string | null;
  subs_descrip_raw?: string | null;
  fecvenc_raw?: string | null;
  fecpre_raw?: string | null;
  saldo_raw?: string | null;
  imp_ext_raw?: string | null;
  nrocta_raw?: string | null;
  descrip_raw?: string | null;
  is_valid: boolean;
  validation_errors?: string | null;
  raw_row?: string | null;
  version?: number | string | null;
};

export const erpCashPendientesInputSchema = z.object({
  erp_empresa_id: z.coerce.number().int().positive("La empresa es obligatoria"),
  uploaded_by: optionalId,
  source_name: z.string().trim().min(1, "El origen es obligatorio").max(100),
  file_name: z.string().trim().min(1, "El archivo es obligatorio").max(255),
  file_hash: optionalText(128),
  import_status: z.enum(["pending", "processing", "imported", "failed"]),
  validation_status: z.enum(["pending", "valid", "invalid"]),
  row_number: z.coerce.number().int().positive("La fila debe ser mayor a cero"),
  tipcomp_raw: optionalText(50),
  nombre_raw: optionalText(255),
  sucursal_raw: optionalText(50),
  nrocomp_raw: optionalText(50),
  tipsub_raw: optionalText(50),
  nrosub_raw: optionalText(50),
  subs_descrip_raw: optionalText(255),
  fecvenc_raw: optionalText(30),
  fecpre_raw: optionalText(30),
  saldo_raw: optionalText(100),
  imp_ext_raw: optionalText(100),
  nrocta_raw: optionalText(50),
  descrip_raw: optionalText(1000),
  is_valid: z.boolean(),
  validation_errors: optionalText(),
  raw_row: optionalText(),
  version: optionalId,
});

export type ErpCashPendientesInputFormValues = z.infer<
  typeof erpCashPendientesInputSchema
>;

export const ERP_CASH_PENDIENTES_INPUT_DEFAULT: Partial<ErpCashPendientesInputFormValues> = {
  source_name: "cash_pendientes",
  import_status: "pending",
  validation_status: "pending",
  is_valid: false,
};

const nullableText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const normalizeErpCashPendientesInputPayload = (
  data: Partial<ErpCashPendientesInputFormValues>,
) => {
  const payload: Record<string, unknown> = {
    erp_empresa_id: Number(data.erp_empresa_id),
    uploaded_by: data.uploaded_by == null ? null : Number(data.uploaded_by),
    source_name: String(data.source_name ?? "").trim(),
    file_name: String(data.file_name ?? "").trim(),
    file_hash: nullableText(data.file_hash),
    import_status: data.import_status,
    validation_status: data.validation_status,
    row_number: Number(data.row_number),
    tipcomp_raw: nullableText(data.tipcomp_raw),
    nombre_raw: nullableText(data.nombre_raw),
    sucursal_raw: nullableText(data.sucursal_raw),
    nrocomp_raw: nullableText(data.nrocomp_raw),
    tipsub_raw: nullableText(data.tipsub_raw),
    nrosub_raw: nullableText(data.nrosub_raw),
    subs_descrip_raw: nullableText(data.subs_descrip_raw),
    fecvenc_raw: nullableText(data.fecvenc_raw),
    fecpre_raw: nullableText(data.fecpre_raw),
    saldo_raw: nullableText(data.saldo_raw),
    imp_ext_raw: nullableText(data.imp_ext_raw),
    nrocta_raw: nullableText(data.nrocta_raw),
    descrip_raw: nullableText(data.descrip_raw),
    is_valid: Boolean(data.is_valid),
    validation_errors: nullableText(data.validation_errors),
    raw_row: nullableText(data.raw_row),
  };

  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
