"use client";

import { useEffect, useMemo, type MouseEvent } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import {
  type Identifier,
  useCreatePath,
  useDataProvider,
  useRecordContext,
  useResourceContext,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { useConfirmDelete, useIdentityId } from "@/components/forms/form_order";
import {
  computePoInvoiceSubtotal,
  computePoInvoiceTaxesImporte,
  type PoInvoiceFormValues,
} from "./model";

// === Tipos ===
export type PoInvoiceRecord = PoInvoiceFormValues & {
  id?: Identifier;
  invoice_status?: {
    id?: number | null;
    nombre?: string | null;
  } | null;
};

// === Defaults iniciales ===
// Resuelve defaults del formulario en base a identidad y fecha actual.
export const usePoInvoiceFormDefaults = () => {
  const record = useRecordContext<PoInvoiceFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { identityId, isIdentityLoading } = useIdentityId();

  const defaultValues = useMemo(() => {
    if (!isCreate) return undefined;
    return {
      ...(identityId != null ? { usuario_responsable_id: identityId } : {}),
      fecha_emision: today,
      subtotal: 0,
      total_impuestos: 0,
      total: 0,
    };
  }, [isCreate, identityId, today]);

  return {
    defaultValues,
    isLoadingDefaults: isCreate && isIdentityLoading && identityId == null,
  };
};

// === Defaults del dominio ===
// Define defaults para estado y tipo de comprobante segun proveedor.
export const usePoInvoiceDefaults = () => {
  const dataProvider = useDataProvider();
  const { setValue, control, getValues } = useFormContext<PoInvoiceFormValues>();
  const { dirtyFields } = useFormState({ control });
  const invoiceStatusId = useWatch({ name: "invoice_status_id", control }) as
    | number
    | undefined;
  const proveedorId = useWatch({ name: "proveedor_id", control }) as
    | number
    | undefined;

  useEffect(() => {
    if (invoiceStatusId || dirtyFields?.invoice_status_id) return;
    let active = true;
    (async () => {
      try {
        const { data } = await dataProvider.getList("po-invoice-status", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "orden", order: "ASC" },
          filter: { nombre: "Borrador" },
        });
        if (!active) return;
        const status = data?.[0];
        if (status?.id) {
          setValue("invoice_status_id", status.id, { shouldDirty: false });
          return;
        }
      } catch {
        // ignore and fallback
      }
      if (active) {
        setValue("invoice_status_id", 1, { shouldDirty: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [invoiceStatusId, dirtyFields?.invoice_status_id, dataProvider, setValue]);

  useEffect(() => {
    if (!proveedorId) return;
    let active = true;
    (async () => {
      const { data: proveedor } = await dataProvider.getOne("proveedores", {
        id: proveedorId,
      });
      if (!active) return;

      const defaults = proveedor as
        | {
            default_tipo_comprobante_id?: number | null;
            tipo_comprobante_id?: number | null;
          }
        | undefined;

      const isEmpty = (value: unknown) =>
        value == null ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && value <= 0);

      const defaultTipoComprobante =
        defaults?.tipo_comprobante_id ?? defaults?.default_tipo_comprobante_id;
      if (defaultTipoComprobante != null) {
        const currentComprobante = getValues("id_tipocomprobante");
        if (isEmpty(currentComprobante) || !dirtyFields?.id_tipocomprobante) {
          setValue("id_tipocomprobante", Number(defaultTipoComprobante), {
            shouldDirty: true,
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    proveedorId,
    dataProvider,
    getValues,
    setValue,
    dirtyFields?.id_tipocomprobante,
  ]);
};

// === Totales ===
// Calcula subtotal, impuestos y total a partir de detalles.
export const usePoInvoiceTotals = () => {
  const { control, setValue } = useFormContext<PoInvoiceFormValues>();
  const detalles = useWatch({ name: "detalles", control }) as
    | Array<{
        importe?: unknown;
        cantidad?: unknown;
        precio_unitario?: unknown;
      }>
    | undefined;
  const taxes = useWatch({ name: "taxes", control }) as
    | Array<{ importe?: unknown }>
    | undefined;

  const subtotal = useMemo(
    () => computePoInvoiceSubtotal(detalles ?? []),
    [detalles],
  );
  const impuestosExtra = useMemo(
    () => computePoInvoiceTaxesImporte(taxes ?? []),
    [taxes],
  );
  const totalImpuestos = useMemo(() => impuestosExtra, [impuestosExtra]);
  const total = useMemo(
    () => subtotal + totalImpuestos,
    [subtotal, totalImpuestos],
  );

  useEffect(() => {
    setValue("subtotal", subtotal, { shouldDirty: true, shouldValidate: true });
    setValue("total_impuestos", totalImpuestos, { shouldDirty: true, shouldValidate: true });
    setValue("total", total, { shouldDirty: true, shouldValidate: true });
  }, [subtotal, totalImpuestos, total, setValue]);
};

// === Acciones de cabecera ===
// Expone acciones de preview y delete para la cabecera.
export const useAccionesCabeceraFactura = () => {
  const record = useRecordContext<PoInvoiceRecord>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const { confirmDelete, setConfirmDelete, deleting, handleDelete } =
    useConfirmDelete({ record, resource });

  const hasRecord = Boolean(record?.id && resource);

  const onPreview = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!record?.id || !resource) return;
    navigate(createPath({ resource, type: "show", id: record.id }));
  };

  return {
    canPreview: hasRecord,
    canDelete: hasRecord,
    onPreview,
    onRequestDelete: () => setConfirmDelete(true),
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
  };
};
