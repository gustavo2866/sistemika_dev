"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  type Identifier,
  required,
  useCreatePath,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useResourceContext,
  useSimpleFormIteratorItem,
  useWrappedSource,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { Loading } from "@/components/loading";
import { NumberField } from "@/components/number-field";
import {
  DetailFooterButtons,
  DetailIterator,
  DetailRowActions,
  DetailRowProvider,
  FORM_FIELD_READONLY_CLASS,
  FORM_VALUE_READONLY_CLASS,
  ResponsiveDetailRow,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailTemplate,
  useDetailSectionContext,
} from "@/components/forms/form_order";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { Confirm } from "@/components/confirm";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import {
  computeDetalleImporte,
  computePoInvoiceSubtotal,
  computePoInvoiceTaxesImporte,
  poInvoiceSchema,
} from "./model";
import type { PoInvoiceFormValues } from "./model";
import {
  useDetalleCentroCostoOportunidadExclusion,
} from "./form_hooks";

export const PoInvoiceForm = () => {
  const record = useRecordContext<PoInvoiceFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const identityResponse = useGetIdentity();
  const identity =
    (identityResponse as { data?: any; identity?: any }).data ??
    (identityResponse as { identity?: any }).identity;
  const identityId = useMemo(() => {
    const raw = identity?.id;
    if (raw == null || raw === "") return undefined;
    const parsed = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [identity?.id]);

  const isIdentityLoading = Boolean(
    (identityResponse as { isLoading?: boolean }).isLoading,
  );

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

  if (isCreate && isIdentityLoading && identityId == null) {
    return <Loading delay={200} />;
  }

  return (
    <SimpleForm<PoInvoiceFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(poInvoiceSchema) as any}
      toolbar={<PoInvoiceFormToolbar />}
      defaultValues={defaultValues}
    >
      <PoInvoiceFormFields />
    </SimpleForm>
  );
};

const PoInvoiceFormToolbar = () => {
  return (
    <div className="flex w-full items-center justify-end gap-2">
      <FormOrderCancelButton />
      <FormOrderSaveButton variant="secondary" />
    </div>
  );
};

const PoInvoiceFormFields = () => {
  usePoInvoiceDefaults();
  usePoInvoiceTotals();
  useDetalleCentroCostoOportunidadExclusion();

  return (
    <>
      <FormErrorSummary />

      <HeaderSection />

      <DetailSection />

      <TaxesSection />

      <TotalsSummaryRow />
    </>
  );
};

const usePoInvoiceDefaults = () => {
  const dataProvider = useDataProvider();
  const { setValue, control, getValues } = useFormContext();
  const { dirtyFields } = useFormState({ control });
  const invoiceStatusId = useWatch({ name: "invoice_status_id", control }) as
    | number
    | undefined;
  const proveedorId = useWatch({ name: "proveedor_id", control }) as
    | number
    | undefined;
  const tipoComprobanteId = useWatch({
    name: "id_tipocomprobante",
    control,
  }) as number | undefined;

  useEffect(() => {
    if (invoiceStatusId || (dirtyFields as any)?.invoice_status_id) return;
    // Default to "Borrador" status id; falls back to 1 when status lookup isn't available.
    setValue("invoice_status_id", 1, { shouldDirty: false });
  }, [invoiceStatusId, dirtyFields, setValue]);

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
        if (isEmpty(currentComprobante) || !(dirtyFields as any)?.id_tipocomprobante) {
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
    (dirtyFields as any)?.id_tipocomprobante,
    tipoComprobanteId,
  ]);
};

const usePoInvoiceTotals = () => {
  const { control, setValue } = useFormContext();
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

const HeaderSection = () => {
  const record = useRecordContext<PoInvoiceFormValues & { id?: Identifier }>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasRecord = Boolean(record?.id);

  const handlePreview = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!record?.id || !resource) return;
    navigate(createPath({ resource, type: "show", id: record.id }));
  };

  const handleDelete = async () => {
    if (!record || !record.id || !resource || deleting) return;
    setDeleting(true);
    try {
      const previousData = record as PoInvoiceFormValues & { id: Identifier };
      await dataProvider.delete(resource, {
        id: record.id,
        previousData,
      });
      notify("Registro eliminado", { type: "info" });
      navigate(createPath({ resource, type: "list" }));
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar", { type: "warning" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const headerActions = hasRecord ? (
    <>
      <DropdownMenuItem
        onClick={handlePreview}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Eye className="h-3 w-3" />
        Preview
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => setConfirmDelete(true)}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
        variant="destructive"
      >
        <Trash2 className="h-3 w-3" />
        Eliminar
      </DropdownMenuItem>
    </>
  ) : null;

  return (
    <>
      <SectionBaseTemplate
        title="Cabecera"
        main={
          <>
            <HeaderMainFields />
            <HiddenInput source="total" />
            <HiddenInput source="subtotal" />
            <HiddenInput source="total_impuestos" />
            <HiddenInput source="invoice_status_id" />
          </>
        }
        actions={headerActions}
        optional={<HeaderOptionalFields />}
      />
      <Confirm
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar registro"
        content="Seguro que deseas eliminar este registro?"
        confirmColor="warning"
        loading={deleting}
      />
    </>
  );
};

const FormErrorSummary = () => {
  const { errors, submitCount } = useFormState();
  const firstError = useMemo(
    () => (submitCount > 0 ? getFirstError(errors) : undefined),
    [errors, submitCount],
  );

  if (!firstError) return null;

  const pathLabel = firstError.path.length
    ? `${firstError.path.join(".")}: `
    : "";

  return (
    <div className="text-[10px] text-destructive">
      {pathLabel}
      {firstError.message}
    </div>
  );
};

const getFirstError = (
  errors: unknown,
  path: string[] = [],
): { path: string[]; message: string } | undefined => {
  if (!errors || typeof errors !== "object") return undefined;
  const errorAny = errors as {
    message?: unknown;
    root?: { message?: unknown };
    [key: string]: unknown;
  };
  if (typeof errorAny.message === "string" && errorAny.message.trim()) {
    return { path, message: errorAny.message };
  }
  if (typeof errorAny.root?.message === "string" && errorAny.root.message.trim()) {
    return { path, message: errorAny.root.message };
  }
  for (const key of Object.keys(errorAny)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    const child = errorAny[key];
    const nested = getFirstError(child, [...path, key]);
    if (nested) return nested;
  }
  return undefined;
};

const HeaderMainFields = () => {
  const record = useRecordContext<PoInvoiceFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="relative w-full md:w-[200px]">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "proveedor_id",
              reference: "proveedores",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Proveedor",
              validate: required(),
            }}
            widthClass="w-full"
          />
        </div>
        <ReferenceInput source="id_tipocomprobante" reference="tipos-comprobante">
          <FormSelect
            optionText="name"
            label="Tipo comprobante"
            widthClass="w-full md:w-[200px]"
            validate={required()}
          />
        </ReferenceInput>
        <FormText
          source="numero"
          label="Numero"
          validate={required()}
          widthClass="w-full md:w-[140px]"
        />
        <FormDate
          source="fecha_emision"
          label="Fecha emision"
          widthClass="w-full md:w-[150px]"
        />
        <FormText
          source="titulo"
          label="Titulo"
          validate={required()}
          autoFocus={isCreate}
          widthClass="w-full md:w-[220px]"
        />
      </div>
    </div>
  );
};

const HeaderOptionalFields = () => {
  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-4">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "usuario_responsable_id",
              reference: "users",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Responsable",
              validate: required(),
            }}
            widthClass="w-full"
          />
          <FormDate
            source="fecha_vencimiento"
            label="Fecha vencimiento"
            widthClass="w-full"
          />
          <FormTextarea
            source="observaciones"
            label="Observaciones"
            widthClass="w-full"
            className="md:col-span-4 [&_textarea]:min-h-[64px]"
          />
        </div>
      </div>
    </div>
  );
};

const DetailSection = () => {
  const detailDefaults = useMemo(
    () => ({
      articulo_id: "",
      descripcion: "",
      centro_costo_id: "",
      oportunidad_id: "",
      cantidad: 1,
      precio_unitario: 0,
      importe: 0,
      poOrderDetail_id: "",
    }),
    [],
  );

  const columns = [
    { label: "Articulo" },
    { label: "Descripcion" },
    { label: "Cantidad", className: "-ml-[15px]" },
    { label: "Precio", className: "ml-[0px]" },
    { label: "Importe", className: "ml-[30px]" },
    { label: "" },
  ];

  return (
    <SectionDetailTemplate
      title="Detalle"
      columns={columns}
      columnsClassName="grid-cols-[220px_150px_64px_84px_84px_28px]"
      defaultDetailValues={detailDefaults}
      list={<DetailList defaultDetailValues={detailDefaults} />}
    />
  );
};

const DetailList = ({
  defaultDetailValues,
}: {
  defaultDetailValues?: Record<string, unknown>;
}) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("DetailList must be used within SectionDetailTemplate");
  }
  const { containerRef, activeIndex, onContainerClick, onRowClick, setActiveIndex } =
    detailContext;

  return (
    <div className="mt-1 space-y-0 w-full" onClick={onContainerClick}>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-64 md:overflow-y-auto"
      >
        <ArrayInput source="detalles" label={false}>
          <DetailIterator
            addButton={<DetailFooterButtons defaultValues={defaultDetailValues} />}
          >
            <DetailItemRow
              activeIndex={activeIndex}
              onRowClick={onRowClick}
              setActiveIndex={setActiveIndex}
            />
          </DetailIterator>
        </ArrayInput>
      </div>
    </div>
  );
};

const DetailItemRow = ({
  activeIndex,
  onRowClick,
  setActiveIndex,
}: {
  activeIndex: number | null;
  onRowClick: (index: number) => (event: MouseEvent) => void;
  setActiveIndex: (index: number | null) => void;
}) => {
  const [showOptional, setShowOptional] = useState(false);
  const { remove, index } = useSimpleFormIteratorItem();
  const isActive = activeIndex === index;
  const handleCollapse = () => {
    setShowOptional(false);
    setActiveIndex(null);
  };
  const toggleOptional = () => setShowOptional((prev) => !prev);
  useEffect(() => {
    if (!isActive && showOptional) {
      setShowOptional(false);
    }
  }, [isActive, showOptional]);

  const rowClassName = cn(
    isActive
      ? "border-primary/30 bg-primary/5 sm:border sm:border-primary/30 sm:bg-primary/5 sm:rounded-md sm:p-2"
      : "sm:border-transparent",
  );

  return (
    <DetailRowProvider
      value={{
        isActive,
        showOptional,
        toggleOptional,
        collapse: handleCollapse,
        remove,
      }}
    >
      <ResponsiveDetailRow
        className={rowClassName}
        onClick={onRowClick(index)}
        onFocusCapture={() => setActiveIndex(index)}
      >
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-2">
          <HiddenInput source="id" />
          <div
            className="col-span-1 w-full sm:col-auto sm:w-[220px] shrink-0"
            data-focus-field="true"
          >
            <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
              Articulo
            </div>
            <div className="grid grid-cols-[1fr_16px] items-center gap-0.5 sm:block">
              <div className="flex-1">
                <FormReferenceAutocomplete
                  referenceProps={{
                    source: "articulo_id",
                    reference: "articulos",
                  }}
                  inputProps={{
                    optionText: "nombre",
                    label: false,
                  }}
                  widthClass="w-full"
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
            </div>
          </div>
          <FormText
            source="descripcion"
            label={false}
            widthClass="w-full sm:w-[130px] shrink-0"
            readOnly={!isActive}
            className={cn("hidden sm:block", !isActive && FORM_FIELD_READONLY_CLASS)}
          />
          <div className="col-span-1 grid grid-cols-[1fr_auto] gap-1 sm:contents">
            <div className="grid grid-cols-[36px_58px_64px] gap-1 sm:flex sm:items-center sm:gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Cant.
                </div>
                <FormNumber
                  source="cantidad"
                  label={false}
                  inputMode="decimal"
                  step="0.001"
                  widthClass="w-[36px] sm:w-[80px] shrink-0"
                  readOnly={!isActive}
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Precio
                </div>
                <FormNumber
                  source="precio_unitario"
                  label={false}
                  inputMode="decimal"
                  step="0.01"
                  widthClass="w-[58px] sm:w-[84px] shrink-0"
                  readOnly={!isActive}
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Importe
                </div>
                <CalculatedSubtotal
                  widthClass="w-[64px] sm:w-[84px] shrink-0"
                  valueClassName={!isActive ? FORM_VALUE_READONLY_CLASS : undefined}
                />
                <HiddenInput source="importe" />
              </div>
            </div>
            <DetailRowActions />
          </div>
        </div>
        <DetailOptionalFields showOptional={showOptional} isActive={isActive} />
        <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
      </ResponsiveDetailRow>
    </DetailRowProvider>
  );
};

const DetailOptionalFields = ({
  showOptional,
  isActive,
}: {
  showOptional: boolean;
  isActive: boolean;
}) => {
  return (
    <div className="w-full">
      {showOptional ? (
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 md:grid-cols-3 md:justify-start">
            <FormText
              source="descripcion"
              label="Descripcion"
              widthClass="w-full"
              readOnly={!isActive}
              className={cn("sm:hidden", !isActive && FORM_FIELD_READONLY_CLASS)}
            />
            <ReferenceInput source="centro_costo_id" reference="centros-costo">
              <FormSelect
                optionText="nombre"
                label="Centro de costo"
                widthClass="w-full"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
            <ReferenceInput source="oportunidad_id" reference="crm/oportunidades">
              <FormSelect
                optionText="titulo"
                label="Oportunidad"
                widthClass="w-full"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CalculatedSubtotal = ({
  className,
  widthClass,
  valueClassName,
}: {
  className?: string;
  widthClass?: string;
  valueClassName?: string;
}) => {
  const { setValue } = useFormContext();
  const cantidadSource = useWrappedSource("cantidad");
  const precioSource = useWrappedSource("precio_unitario");
  const importeSource = useWrappedSource("importe");

  const cantidad = useWatch({ name: cantidadSource }) as number | undefined;
  const precio = useWatch({ name: precioSource }) as number | undefined;

  const importe = useMemo(
    () => computeDetalleImporte({ cantidad, precio_unitario: precio }),
    [cantidad, precio],
  );

  useEffect(() => {
    setValue(importeSource, importe, { shouldDirty: true, shouldValidate: true });
  }, [importeSource, importe, setValue]);

  return (
    <FormValue
      label={false}
      className={className}
      widthClass={widthClass ?? "w-[80px] sm:w-[84px] shrink-0"}
      valueClassName={valueClassName}
    >
      <NumberField
        source="importe"
        record={{ importe }}
        options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      />
    </FormValue>
  );
};

const TaxesSection = () => {
  const taxDefaults = useMemo(
    () => ({
      concepto_id: "",
      descripcion: "",
      importe: 0,
    }),
    [],
  );

  const columns = [
    { label: "Concepto" },
    { label: "Descripcion" },
    { label: "Importe", className: "text-right" },
    { label: "" },
  ];

  return (
    <SectionDetailTemplate
      title="Impuestos"
      detailsSource="taxes"
      defaultOpen={false}
      columns={columns}
      columnsClassName="grid-cols-[180px_200px_84px_28px]"
      defaultDetailValues={taxDefaults}
      list={<TaxesList defaultDetailValues={taxDefaults} />}
    />
  );
};

const TotalsSummaryRow = () => {
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ importe?: unknown; cantidad?: unknown; precio_unitario?: unknown }>
    | undefined;
  const taxes = useWatch({ name: "taxes" }) as
    | Array<{ importe?: unknown }>
    | undefined;

  const subtotalValue = useMemo(
    () => computePoInvoiceSubtotal(detalles ?? []),
    [detalles],
  );
  const impuestosValue = useMemo(
    () => computePoInvoiceTaxesImporte(taxes ?? []),
    [taxes],
  );
  const totalValue = useMemo(
    () => subtotalValue + impuestosValue,
    [subtotalValue, impuestosValue],
  );

  return (
    <div className="flex flex-row flex-nowrap items-center justify-start gap-2 rounded-md border border-muted/60 bg-muted/30 px-2 py-1 text-[8px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]">
      <span className="flex items-center gap-1 whitespace-nowrap">
        SubTotal:
        <NumberField
          source="subtotal"
          record={{ subtotal: subtotalValue }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        Impuestos:
        <NumberField
          source="total_impuestos"
          record={{ total_impuestos: impuestosValue }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-semibold text-background whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
        Total:
        <NumberField
          source="total"
          record={{ total: totalValue }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="tabular-nums"
        />
      </span>
    </div>
  );
};

const TaxesList = ({
  defaultDetailValues,
}: {
  defaultDetailValues?: Record<string, unknown>;
}) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("TaxesList must be used within SectionDetailTemplate");
  }
  const { containerRef, activeIndex, onContainerClick, onRowClick, setActiveIndex } =
    detailContext;

  return (
    <div className="mt-1 space-y-0 w-full" onClick={onContainerClick}>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-64 md:overflow-y-auto"
      >
        <ArrayInput source="taxes" label={false}>
          <DetailIterator
            addButton={<DetailFooterButtons defaultValues={defaultDetailValues} />}
          >
            <TaxItemRow
              activeIndex={activeIndex}
              onRowClick={onRowClick}
              setActiveIndex={setActiveIndex}
            />
          </DetailIterator>
        </ArrayInput>
      </div>
    </div>
  );
};

const TaxItemRow = ({
  activeIndex,
  onRowClick,
  setActiveIndex,
}: {
  activeIndex: number | null;
  onRowClick: (index: number) => (event: MouseEvent) => void;
  setActiveIndex: (index: number | null) => void;
}) => {
  const [showOptional, setShowOptional] = useState(false);
  const { remove, index } = useSimpleFormIteratorItem();
  const isActive = activeIndex === index;
  const handleCollapse = () => {
    setShowOptional(false);
    setActiveIndex(null);
  };
  const toggleOptional = () => setShowOptional((prev) => !prev);
  useEffect(() => {
    if (!isActive && showOptional) {
      setShowOptional(false);
    }
  }, [isActive, showOptional]);

  const rowClassName = cn(
    isActive
      ? "border-primary/30 bg-primary/5 sm:border sm:border-primary/30 sm:bg-primary/5 sm:rounded-md sm:p-2"
      : "sm:border-transparent",
  );

  return (
    <DetailRowProvider
      value={{
        isActive,
        showOptional,
        toggleOptional,
        collapse: handleCollapse,
        remove,
      }}
    >
      <ResponsiveDetailRow
        className={rowClassName}
        onClick={onRowClick(index)}
        onFocusCapture={() => setActiveIndex(index)}
      >
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-2">
          <HiddenInput source="id" />
          <div
            className="col-span-1 w-full sm:col-auto sm:w-[180px] shrink-0"
            data-focus-field="true"
          >
            <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
              Concepto
            </div>
            <ReferenceInput
              source="concepto_id"
              reference="api/v1/adm/conceptos"
              filter={{ es_impuesto: true }}
            >
              <FormSelect
                optionText="nombre"
                label={false}
                widthClass="w-full"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                emptyText="Sin concepto"
              />
            </ReferenceInput>
          </div>
          <FormText
            source="descripcion"
            label={false}
            widthClass="w-full sm:w-[200px] shrink-0"
            readOnly={!isActive}
            className={cn("hidden sm:block", !isActive && FORM_FIELD_READONLY_CLASS)}
          />
          <div className="col-span-1 grid grid-cols-[1fr_auto] gap-1 sm:contents">
            <FormNumber
              source="importe"
              label={false}
              inputMode="decimal"
              step="0.01"
              widthClass="w-[84px] sm:w-[84px] shrink-0"
              readOnly={!isActive}
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
            <DetailRowActions />
          </div>
        </div>
        {showOptional ? (
          <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
            <div className="grid gap-2 md:grid-cols-2">
              <FormNumber
                source="importe_base"
                label="Importe base"
                inputMode="decimal"
                step="0.01"
                widthClass="w-full"
                readOnly={!isActive}
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
              <FormNumber
                source="porcentaje"
                label="%"
                inputMode="decimal"
                step="0.01"
                widthClass="w-full"
                readOnly={!isActive}
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
      </ResponsiveDetailRow>
    </DetailRowProvider>
  );
};
