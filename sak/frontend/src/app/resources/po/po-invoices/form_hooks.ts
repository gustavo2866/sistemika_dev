"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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

const resolveNumericId = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(maybeId);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
};

// === Tipos ===
export type PoInvoiceRecord = PoInvoiceFormValues & {
  id?: Identifier;
  invoice_status?: {
    id?: number | null;
    nombre?: string | null;
    orden?: number | null;
  } | null;
};

export const isPoInvoiceEditableByOrden = (orden?: number | null) => {
  if (orden == null) return false;
  return [1, 2].includes(Number(orden));
};

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

export const usePoInvoiceReadOnly = () => {
  const record = useRecordContext<PoInvoiceRecord>();
  const isCreate = !record?.id;
  if (isCreate) return false;
  const { control } = useFormContext<PoInvoiceFormValues>();
  const formStatusId = useWatch({ name: "invoice_status_id", control }) as
    | number
    | undefined;
  const orden =
    record?.invoice_status?.orden ??
    record?.invoice_status?.id ??
    formStatusId;
  if (orden != null) {
    return !isPoInvoiceEditableByOrden(orden);
  }
  const statusKey = normalizeStatusName(record?.invoice_status?.nombre);
  if (statusKey) {
    return !["borrador", "confirmada", "confirmado"].includes(statusKey);
  }
  return true;
};

export const useResponsableCentroCostoSync = () => {
  const dataProvider = useDataProvider();
  const { setValue, getValues } = useFormContext<PoInvoiceFormValues>();
  const responsableId = useWatch({ name: "usuario_responsable_id" }) as unknown;
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as unknown;
  const prevResponsableId = useRef<number | undefined>(undefined);

  const syncFromResponsable = useCallback(
    async (nextId: number, forceDirty: boolean) => {
      const currentOportunidad =
        resolveNumericId(getValues("oportunidad_id")) ??
        resolveNumericId(oportunidadId);
      if (currentOportunidad) return;

      try {
        const { data: usuario } = await dataProvider.getOne("users", {
          id: nextId,
        });

        const deptoId = resolveNumericId(usuario?.departamento_id);
        if (deptoId) {
          // setValue("departamento_id", deptoId, { shouldDirty: forceDirty });
        } else {
          // setValue("departamento_id", null, { shouldDirty: forceDirty });
          setValue("centro_costo_id", undefined, { shouldDirty: forceDirty });
          return;
        }

        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: deptoId,
        });
        const centroId = resolveNumericId(depto?.centro_costo_id);
        if (centroId) {
          setValue("centro_costo_id", centroId, { shouldDirty: forceDirty });
        } else {
          setValue("centro_costo_id", undefined, { shouldDirty: forceDirty });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [dataProvider, getValues, oportunidadId, setValue],
  );

  const handleResponsableChange = useCallback(
    async (choice: { id?: unknown; value?: unknown } | null) => {
      const nextId = resolveNumericId(choice?.id ?? choice?.value ?? choice);
      if (!nextId) return;
      if (prevResponsableId.current === nextId) return;
      prevResponsableId.current = nextId;
      await syncFromResponsable(nextId, true);
    },
    [syncFromResponsable],
  );

  useEffect(() => {
    const resolvedId = resolveNumericId(responsableId);
    if (!resolvedId) return;
    if (prevResponsableId.current == null) {
      prevResponsableId.current = resolvedId;
      const currentCentro = resolveNumericId(getValues("centro_costo_id"));
      if (!currentCentro) {
        void syncFromResponsable(resolvedId, false);
      }
    }
  }, [responsableId, getValues, syncFromResponsable]);

  return { handleResponsableChange };
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
  const invoiceStatusFinId = useWatch({ name: "invoice_status_fin_id", control }) as
    | number
    | undefined;
  const metodoPagoId = useWatch({ name: "metodo_pago_id", control }) as
    | number
    | undefined;
  const fechaEmision = useWatch({ name: "fecha_emision", control }) as
    | string
    | undefined;
  const proveedorId = useWatch({ name: "proveedor_id", control }) as
    | number
    | undefined;
  const [diasVencimientoProveedor, setDiasVencimientoProveedor] = useState<number | null>(
    null,
  );

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
    if (invoiceStatusFinId || dirtyFields?.invoice_status_fin_id) return;
    setValue("invoice_status_fin_id", 1, { shouldDirty: false });
  }, [invoiceStatusFinId, dirtyFields?.invoice_status_fin_id, setValue]);

  useEffect(() => {
    if (metodoPagoId || dirtyFields?.metodo_pago_id) return;
    setValue("metodo_pago_id", 1, { shouldDirty: false });
  }, [metodoPagoId, dirtyFields?.metodo_pago_id, setValue]);

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
            default_metodo_pago_id?: number | null;
            default_tipo_comprobante_id?: number | null;
            tipo_comprobante_id?: number | null;
            dias_vencimiento?: number | null;
          }
        | undefined;

      const isEmpty = (value: unknown) =>
        value == null ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && value <= 0);

      const defaultMetodo = defaults?.default_metodo_pago_id;
      if (defaultMetodo) {
        const currentMetodo = getValues("metodo_pago_id");
        if (isEmpty(currentMetodo) || !dirtyFields?.metodo_pago_id) {
          setValue("metodo_pago_id", Number(defaultMetodo), {
            shouldDirty: true,
          });
        }
      }

      const diasVencimiento = defaults?.dias_vencimiento ?? null;
      setDiasVencimientoProveedor(diasVencimiento);

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
    dirtyFields?.metodo_pago_id,
  ]);

  useEffect(() => {
    if (diasVencimientoProveedor == null) return;
    const currentVencimiento = getValues("fecha_vencimiento");
    const isEmpty = (value: unknown) =>
      value == null ||
      (typeof value === "string" && value.trim() === "") ||
      (typeof value === "number" && value <= 0);
    if (!isEmpty(currentVencimiento) && dirtyFields?.fecha_vencimiento) return;

    const baseDate = isEmpty(fechaEmision)
      ? new Date()
      : new Date(String(fechaEmision));
    if (Number.isNaN(baseDate.getTime())) return;
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + Number(diasVencimientoProveedor));
    const iso = nextDate.toISOString().slice(0, 10);
    setValue("fecha_vencimiento", iso, { shouldDirty: false });
  }, [
    diasVencimientoProveedor,
    fechaEmision,
    dirtyFields?.fecha_vencimiento,
    getValues,
    setValue,
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
