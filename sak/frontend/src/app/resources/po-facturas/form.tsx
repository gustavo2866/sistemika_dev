
"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { required, useDataProvider } from "ra-core";
import { useFormContext, useWatch, type UseFormReturn } from "react-hook-form";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload } from "lucide-react";
import {
  AddItemButton,
  CompactComboboxQuery,
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormDetailCardCompact,
  FormDetailCardList,
  FormDetailClearAllButton,
  FormDetailFormDialog,
  FormDetailSection,
  FormDetailSectionMinItems,
  FormLayout,
  useAutoInitializeField,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  type DetalleFormValues,
  type TotalFormValues,
  type PoFactura,
  type PoFacturaDetalle,
  type PoFacturaTotal,
  ARTICULOS_REFERENCE,
  ADM_CONCEPTOS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  ESTADO_CHOICES,
  getArticuloFilterByTipo,
  METODOS_PAGO_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPO_COMPRA_CHOICES,
  TIPOS_COMPROBANTE_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  UNIDAD_MEDIDA_CHOICES,
  USERS_REFERENCE,
  VALIDATION_RULES,
  poFacturaCabeceraSchema,
  poFacturaDetalleSchema,
  poFacturaTotalSchema,
} from "./model";
import type { TipoSolicitud } from "../tipos-solicitud/model";

const GENERAL_SUBTITLE_SNIPPET = 25;

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const ESTADO_BADGES: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-800",
  procesada: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  pagada: "bg-amber-100 text-amber-800",
  anulada: "bg-slate-200 text-slate-600",
};

const buildGeneralSubtitle = (observaciones: string | undefined) => {
  const snippet = observaciones
    ? observaciones.slice(0, GENERAL_SUBTITLE_SNIPPET)
    : "";
  return snippet || "";
};

const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const emptyToNull = (value: unknown) => (value === "" ? null : value);

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeCentroCostoId = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const computeLineAmounts = (values: {
  cantidad?: number | null;
  precio_unitario?: number | null;
  porcentaje_descuento?: number | null;
  porcentaje_iva?: number | null;
}) => {
  const cantidad = normalizeNumber(values.cantidad);
  const precio = normalizeNumber(values.precio_unitario);
  const descuento = normalizeNumber(values.porcentaje_descuento);
  const iva = normalizeNumber(values.porcentaje_iva);

  const subtotal = roundCurrency(cantidad * precio);
  const importeDescuento = roundCurrency(subtotal * (descuento / 100));
  const neto = roundCurrency(subtotal - importeDescuento);
  const importeIva = roundCurrency(neto * (iva / 100));
  const totalLinea = roundCurrency(neto + importeIva);

  return {
    subtotal,
    importeDescuento,
    importeIva,
    totalLinea,
  };
};

const PoFacturaDetalleCard = ({
  item,
  onDelete,
}: {
  item: PoFacturaDetalle;
  onDelete: () => void;
}) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const centroCostoLabel = item.centro_costo_id
    ? getReferenceLabel("centro_costo_id", item.centro_costo_id)
    : undefined;
  const articuloLabel = item.articulo_id
    ? getReferenceLabel("articulo_id", item.articulo_id)
    : undefined;
  const descripcion = (item.descripcion || "").trim();
  const totalLinea = CURRENCY_FORMATTER.format(
    Number(item.total_linea ?? 0)
  );
  const cantidad = Number(item.cantidad ?? 0);
  const precio = CURRENCY_FORMATTER.format(Number(item.precio_unitario ?? 0));

  return (
    <FormDetailCardCompact
      title={
        <div className="flex w-full items-center gap-2">
          <span className="truncate text-[12px] font-semibold sm:text-[13px]">
            {articuloLabel || "Articulo sin nombre"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-4 w-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label="Eliminar"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2">
          <span className="truncate text-[10px] sm:text-[11px]">
            Cantidad: {cantidad} | Precio: {precio}
          </span>
          {centroCostoLabel ? (
            <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {centroCostoLabel}
            </span>
          ) : null}
          <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 text-right text-[10px] font-semibold sm:text-[11px]">
            {totalLinea}
          </span>
        </div>
      }
    >
      <div className="text-[11px] text-muted-foreground">
        {descripcion || "Sin descripcion"}
      </div>
    </FormDetailCardCompact>
  );
};

type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter_id"
>;

type PoFacturaDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilterId?: number;
  hasTipoSolicitud?: boolean;
  defaultCentroCostoId?: number | null;
};
const PoFacturaDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
  articuloFilterId,
  hasTipoSolicitud,
  defaultCentroCostoId,
}: PoFacturaDetalleDialogContentProps) => {
  const { resolveAction, items } = useFormDetailSectionContext<
    DetalleFormValues,
    PoFacturaDetalle
  >();

  const cantidadValue = detalleForm.watch("cantidad");
  const precioValue = detalleForm.watch("precio_unitario");
  const descuentoValue = detalleForm.watch("porcentaje_descuento");
  const ivaValue = detalleForm.watch("porcentaje_iva");
  const subtotalValue = detalleForm.watch("subtotal");
  const descuentoImporteValue = detalleForm.watch("importe_descuento");
  const ivaImporteValue = detalleForm.watch("importe_iva");
  const totalLineaValue = detalleForm.watch("total_linea");

  const computedDisplay = useMemo(() => {
    const { subtotal, importeDescuento, importeIva, totalLinea } =
      computeLineAmounts({
        cantidad: cantidadValue,
        precio_unitario: precioValue,
        porcentaje_descuento: descuentoValue,
        porcentaje_iva: ivaValue,
      });
    return {
      subtotal: subtotal.toFixed(2),
      importeDescuento: importeDescuento.toFixed(2),
      importeIva: importeIva.toFixed(2),
      totalLinea: totalLinea.toFixed(2),
    };
  }, [cantidadValue, precioValue, descuentoValue, ivaValue]);

  useEffect(() => {
    const { subtotal, importeDescuento, importeIva, totalLinea } =
      computeLineAmounts({
        cantidad: cantidadValue,
        precio_unitario: precioValue,
        porcentaje_descuento: descuentoValue,
        porcentaje_iva: ivaValue,
      });

    if (roundCurrency(normalizeNumber(subtotalValue)) !== subtotal) {
      detalleForm.setValue("subtotal", subtotal, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (roundCurrency(normalizeNumber(descuentoImporteValue)) !== importeDescuento) {
      detalleForm.setValue("importe_descuento", importeDescuento, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (roundCurrency(normalizeNumber(ivaImporteValue)) !== importeIva) {
      detalleForm.setValue("importe_iva", importeIva, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (roundCurrency(normalizeNumber(totalLineaValue)) !== totalLinea) {
      detalleForm.setValue("total_linea", totalLinea, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    cantidadValue,
    precioValue,
    descuentoValue,
    ivaValue,
    subtotalValue,
    descuentoImporteValue,
    ivaImporteValue,
    totalLineaValue,
    detalleForm,
  ]);

  useEffect(() => {
    if (resolveAction() !== "create") {
      return;
    }
    const currentOrden = normalizeNumber(detalleForm.getValues("orden"));
    if (currentOrden > 0) {
      return;
    }
    detalleForm.setValue("orden", items.length + 1, {
      shouldDirty: true,
    });
  }, [detalleForm, items.length, resolveAction]);

  useEffect(() => {
    if (resolveAction() !== "create") {
      return;
    }
    if (defaultCentroCostoId == null) {
      return;
    }
    const currentCentroCosto = detalleForm.getValues("centro_costo_id");
    if (currentCentroCosto !== undefined && currentCentroCosto !== "") {
      return;
    }
    detalleForm.setValue("centro_costo_id", String(defaultCentroCostoId), {
      shouldDirty: true,
    });
  }, [defaultCentroCostoId, detalleForm, resolveAction]);

  return (
    <>
      <CompactFormGrid columns="one">
        <CompactFormField
          label="Articulo"
          error={detalleForm.formState.errors.articulo_id}
          required
        >
          <CompactComboboxQuery
            {...ARTICULOS_REFERENCE}
            value={detalleForm.watch("articulo_id")}
            onChange={(value: string) =>
              detalleForm.setValue("articulo_id", value, {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona un articulo"
            className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
            filter={articuloFilterQuery}
            dependsOn={articuloFilterId ? String(articuloFilterId) : "all"}
            disabled={!hasTipoSolicitud}
          />
        </CompactFormField>
      </CompactFormGrid>

      <CompactFormField
        label="Descripcion"
        error={detalleForm.formState.errors.descripcion}
        required
      >
        <Textarea
          rows={3}
          className="min-h-9 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
          {...detalleForm.register("descripcion")}
        />
      </CompactFormField>

      <div className="flex flex-nowrap items-baseline gap-2 w-full">
        <div className="flex-1 min-w-0">
          <CompactFormField
            label="Cantidad"
            error={detalleForm.formState.errors.cantidad}
            required
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              className="!h-7 px-2 text-[11px] sm:!h-8 sm:px-3 sm:text-sm w-full"
              {...detalleForm.register("cantidad", { valueAsNumber: true })}
            />
          </CompactFormField>
        </div>

        <div className="w-[7ch] sm:w-[8ch] shrink-0">
          <CompactFormField
            label="Unidad"
            error={detalleForm.formState.errors.unidad_medida}
            required
          >
            <Select
              value={detalleForm.watch("unidad_medida") ?? ""}
              onValueChange={(value) =>
                detalleForm.setValue("unidad_medida", value, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger 
                className="!h-7 px-2 text-[11px] sm:!h-8 sm:px-3 sm:text-sm w-full"
                tabIndex={-1}
              >
                <SelectValue placeholder="Unidad" />
              </SelectTrigger>
              <SelectContent>
                {UNIDAD_MEDIDA_CHOICES.map((choice) => (
                  <SelectItem key={String(choice.id)} value={String(choice.id)}>
                    {choice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CompactFormField>
        </div>
      </div>

      <CompactFormGrid columns="one">
        <CompactFormField
          label="Precio unitario"
          error={detalleForm.formState.errors.precio_unitario}
          required
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
            {...detalleForm.register("precio_unitario", {
              valueAsNumber: true,
              min: 0,
            })}
          />
        </CompactFormField>

      </CompactFormGrid>
      <input
        type="hidden"
        {...detalleForm.register("porcentaje_descuento", { valueAsNumber: true })}
      />
      <input
        type="hidden"
        {...detalleForm.register("porcentaje_iva", { valueAsNumber: true })}
      />
      <input
        type="hidden"
        {...detalleForm.register("importe_descuento", { valueAsNumber: true })}
      />
      <input
        type="hidden"
        {...detalleForm.register("importe_iva", { valueAsNumber: true })}
      />

      <input
        type="hidden"
        {...detalleForm.register("subtotal", { valueAsNumber: true })}
      />

      <CompactFormGrid columns="two">
        <CompactFormField label="Total linea">
          <Input
            type="text"
            value={computedDisplay.totalLinea}
            readOnly
            className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          />
          <input
            type="hidden"
            {...detalleForm.register("total_linea", { valueAsNumber: true })}
          />
        </CompactFormField>
      </CompactFormGrid>

      <CompactFormGrid columns="one">
        <CompactFormField label="Centro de costo">
          <CompactComboboxQuery
            {...CENTROS_COSTO_REFERENCE}
            value={detalleForm.watch("centro_costo_id") ?? ""}
            onChange={(value: string) =>
              detalleForm.setValue("centro_costo_id", value, {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona centro"
            clearable
            filter={CENTROS_COSTO_REFERENCE.filter}
          />
        </CompactFormField>
      </CompactFormGrid>
    </>
  );
};

const PoFacturaDetalleForm = ({
  articuloFilterId,
  hasTipoSolicitud,
  defaultCentroCostoId,
}: {
  articuloFilterId?: number;
  hasTipoSolicitud?: boolean;
  defaultCentroCostoId?: number | null;
}) => {
  const articuloFilterQuery = useMemo(
    () => (articuloFilterId ? { tipo_articulo_id: articuloFilterId } : undefined),
    [articuloFilterId]
  );

  return (
    <FormDetailFormDialog
      title={({ action }) =>
        action === "create" ? "Agregar articulo" : "Editar articulo"
      }
      description="Completa los datos del articulo."
    >
      {(detalleForm) => (
        <PoFacturaDetalleDialogContent
          detalleForm={detalleForm as unknown as UseFormReturn<DetalleFormValues>}
          articuloFilterQuery={articuloFilterQuery}
          articuloFilterId={articuloFilterId}
          hasTipoSolicitud={hasTipoSolicitud}
          defaultCentroCostoId={defaultCentroCostoId}
        />
      )}
    </FormDetailFormDialog>
  );
};

const PoFacturaDetalleContent = ({
  articuloFilterId,
  hasTipoSolicitud,
  defaultCentroCostoId,
}: {
  articuloFilterId?: number;
  hasTipoSolicitud?: boolean;
  defaultCentroCostoId?: number | null;
}) => {
  const { handleStartCreate, handleDeleteBySortedIndex } =
    useFormDetailSectionContext();

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 -mt-4 pb-0 pt-0">
        <FormDetailClearAllButton
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
          confirmMessage="Seguro que deseas eliminar todos los articulos? Esto tambien desbloqueara el tipo de solicitud."
        />
        <AddItemButton
          label="Agregar articulo"
          onClick={handleStartCreate}
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
        />
      </div>
      <FormDetailCardList<PoFacturaDetalle>
        emptyMessage="Todavia no agregaste articulos."
        showEditAction={false}
        showDeleteAction={false}
        contentClassName="px-2 py-2 sm:px-3"
        gridClassName="grid-cols-[minmax(0,1fr)] items-start gap-2"
        listClassName="mt-1 space-y-1"
        variant="row"
      >
        {(item, index) => (
          <PoFacturaDetalleCard
            item={item}
            onDelete={() => handleDeleteBySortedIndex(index)}
          />
        )}
      </FormDetailCardList>
      <FormDetailSectionMinItems itemName="articulo" />
      <PoFacturaDetalleForm
        articuloFilterId={articuloFilterId}
        hasTipoSolicitud={hasTipoSolicitud}
        defaultCentroCostoId={defaultCentroCostoId}
      />
    </>
  );
};

type PoFacturaSubtotalDisplay = {
  concepto_id: number;
  centro_costo_id?: number | null;
  concepto_label: string;
  centro_costo_label?: string;
  importe: number;
};

const PoFacturaSubtotalCard = ({
  item,
}: {
  item: PoFacturaSubtotalDisplay;
}) => {
  const importe = CURRENCY_FORMATTER.format(Number(item.importe ?? 0));

  return (
    <FormDetailCardCompact
      title={
        <div className="flex w-full items-center gap-2">
          <span className="truncate text-[12px] font-semibold sm:text-[13px]">
            {item.concepto_label || ""}
          </span>
          {item.centro_costo_label ? (
            <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {item.centro_costo_label}
            </span>
          ) : null}
          <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 text-right text-[10px] font-semibold sm:text-[11px]">
            {importe}
          </span>
        </div>
      }
    >
    </FormDetailCardCompact>
  );
};

const PoFacturaTotalCard = ({
  item,
  onDelete,
  resolveCentroCostoLabel,
}: {
  item: PoFacturaTotal;
  onDelete: () => void;
  resolveCentroCostoLabel?: (
    value: number | string | null | undefined
  ) => string | undefined;
}) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const conceptoLabel = getReferenceLabel("concepto_id", item.concepto_id);
  const centroCostoLabel =
    resolveCentroCostoLabel?.(item.centro_costo_id) ??
    (item.centro_costo_id
      ? getReferenceLabel("centro_costo_id", item.centro_costo_id)
      : undefined);
  const descripcion = (item.descripcion || "").trim();
  const importe = CURRENCY_FORMATTER.format(Number(item.importe ?? 0));

  return (
    <FormDetailCardCompact
      title={
        <div className="flex w-full items-center gap-2">
          <span className="truncate text-[12px] font-semibold sm:text-[13px]">
            {conceptoLabel || ""}
          </span>
          {centroCostoLabel ? (
            <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {centroCostoLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-4 w-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label="Eliminar"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2">
          <span className="truncate text-[10px] sm:text-[11px]">
            {descripcion || "Sin descripcion"}
          </span>
          <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 text-right text-[10px] font-semibold sm:text-[11px]">
            {importe}
          </span>
        </div>
      }
    >
    </FormDetailCardCompact>
  );
};

const PoFacturaTotalDialogContent = ({
  totalForm,
}: {
  totalForm: UseFormReturn<TotalFormValues>;
}) => (
  <>
    <CompactFormGrid columns="two">
      <ReferenceInput
        source="concepto_id"
        reference={ADM_CONCEPTOS_REFERENCE.resource}
        label="Concepto"
      >
        <CompactSelectInput
          optionText={ADM_CONCEPTOS_REFERENCE.labelField}
          className="w-full"
          validate={required()}
        />
      </ReferenceInput>

      <ReferenceInput
        source="centro_costo_id"
        reference={CENTROS_COSTO_REFERENCE.resource}
        label="Centro de costo"
        filter={CENTROS_COSTO_REFERENCE.filter}
      >
        <CompactSelectInput
          optionText={CENTROS_COSTO_REFERENCE.labelField}
          className="w-full"
          parse={emptyToNull}
        />
      </ReferenceInput>
    </CompactFormGrid>

    <CompactFormGrid columns="two">
      <CompactFormField
        label="Descripcion"
        error={totalForm.formState.errors.descripcion}
      >
        <Input
          className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          {...totalForm.register("descripcion")}
        />
      </CompactFormField>

      <CompactFormField
        label="Importe"
        error={totalForm.formState.errors.importe}
        required
      >
        <Input
          type="number"
          step="0.01"
          min="0"
          className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          {...totalForm.register("importe", { valueAsNumber: true })}
        />
      </CompactFormField>
    </CompactFormGrid>
  </>
);

const PoFacturaTotalForm = () => (
  <FormDetailFormDialog
    title={({ action }) =>
      action === "create" ? "Agregar impuesto" : "Editar impuesto"
    }
    description="Completa los datos del impuesto."
  >
    {(totalForm) => (
      <PoFacturaTotalDialogContent
        totalForm={totalForm as unknown as UseFormReturn<TotalFormValues>}
      />
    )}
  </FormDetailFormDialog>
);

const PoFacturaTotalesContent = ({
  subtotalItems,
  centrosCostoById,
}: {
  subtotalItems: PoFacturaSubtotalDisplay[];
  centrosCostoById: Map<number, string>;
}) => {
  const { handleStartCreate, handleDeleteByOriginalIndex, sortedEntries, getReferenceLabel } =
    useFormDetailSectionContext();

  const impuestoEntries = useMemo(() => {
    return [...sortedEntries]
      .map((entry) => ({
        ...entry,
        conceptoLabel: getReferenceLabel("concepto_id", (entry.item as any)?.concepto_id) ?? "",
      }))
      .sort((a, b) => a.conceptoLabel.localeCompare(b.conceptoLabel));
  }, [sortedEntries, getReferenceLabel]);

  const resolveCentroCostoLabel = (value: number | string | null | undefined) => {
    const normalized = normalizeCentroCostoId(value);
    if (normalized == null) return undefined;
    return (
      getReferenceLabel("centro_costo_id", normalized) ??
      centrosCostoById.get(normalized)
    );
  };

  return (
    <>
      <div className="space-y-2 px-2 pt-1">
        <div className="text-[10px] font-semibold text-muted-foreground sm:text-[11px]">
          Subtotales calculados
        </div>
        {subtotalItems.length === 0 ? (
          <div className="text-[10px] text-muted-foreground sm:text-[11px]">
            No hay subtotales calculados.
          </div>
        ) : (
          <div className="space-y-1">
            {subtotalItems.map((item) => (
              <PoFacturaSubtotalCard
                key={`${item.concepto_id}-${item.centro_costo_id ?? "none"}`}
                item={item}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-b border-border/60 pb-0 pt-0">
        <FormDetailClearAllButton
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
          confirmMessage="Seguro que deseas eliminar todos los impuestos?"
        />
        <AddItemButton
          label="Agregar impuesto"
          onClick={handleStartCreate}
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
        />
      </div>
      <div className="px-2 py-2 sm:px-3">
        {impuestoEntries.length === 0 ? (
          <div className="text-[10px] text-muted-foreground sm:text-[11px]">
            Todavia no agregaste impuestos.
          </div>
        ) : (
          <div className="space-y-1">
            {impuestoEntries.map((entry) => (
              <PoFacturaTotalCard
                key={(entry.item as any).id ?? (entry.item as any).tempId ?? entry.originalIndex}
                item={entry.item as PoFacturaTotal}
                onDelete={() => handleDeleteByOriginalIndex(entry.originalIndex)}
                resolveCentroCostoLabel={resolveCentroCostoLabel}
              />
            ))}
          </div>
        )}
      </div>
      <PoFacturaTotalForm />
    </>
  );
};
const CabeceraContent = ({
  tipoSolicitudBloqueado,
}: {
  tipoSolicitudBloqueado?: boolean;
}) => {
  const form = useFormContext<PoFactura>();

  return (
    <>
      {/* Primera fila: Proveedor y Tipo de comprobante */}
      <CompactFormGrid columns="two">
        <div className="min-w-0">
          <ReferenceInput
            source="proveedor_id"
            reference={PROVEEDORES_REFERENCE.resource}
            label="Proveedor"
          >
            <CompactSelectInput
              optionText={PROVEEDORES_REFERENCE.labelField}
              className="w-full"
              validate={required()}
            />
          </ReferenceInput>
        </div>

        <div className="min-w-0">
          <ReferenceInput
            source="id_tipocomprobante"
            reference={TIPOS_COMPROBANTE_REFERENCE.resource}
          >
            <CompactSelectInput
              optionText={TIPOS_COMPROBANTE_REFERENCE.labelField}
              label="Comprobante"
              className="w-full"
              validate={required()}
            />
          </ReferenceInput>
        </div>
      </CompactFormGrid>

      {/* Segunda fila: Punto, Numero y Fecha emision */}
      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto">
        <div className="shrink-0 w-[7ch]">
          <CompactTextInput
            source="punto_venta"
            label="Punto"
            className="w-[7ch] min-w-[7ch]"
            validate={required()}
            maxLength={10}
          />
        </div>

        <div className="shrink-0 w-[7ch] sm:w-[9ch] md:w-[10ch]">
          <CompactTextInput
            source="numero"
            label="Numero"
            className="w-[7ch] sm:w-[9ch] md:w-[10ch] min-w-[7ch]"
            validate={required()}
            maxLength={50}
          />
        </div>

        <div className="shrink-0 w-[8ch] sm:w-[12ch] md:w-[14ch]">
          <CompactTextInput
            source="fecha_emision"
            label="Fecha emision"
            className="w-[8ch] sm:w-[12ch] md:w-[14ch] min-w-[8ch]"
            type="date"
            validate={required()}
          />
        </div>

        <div className="shrink-0 flex items-end pb-[0.125rem]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 sm:h-8 sm:w-8"
            title="Subir archivo"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CompactFormGrid columns="two">
        <div className="min-w-0">
          <CompactTextInput
            source="fecha_vencimiento"
            label="Fecha vencimiento"
            className="w-full"
            type="date"
          />
        </div>

        <div className="min-w-0">
          <ReferenceInput
            source="metodo_pago_id"
            reference={METODOS_PAGO_REFERENCE.resource}
            label="Metodo de pago"
          >
            <CompactSelectInput
              optionText={METODOS_PAGO_REFERENCE.labelField}
              className="w-full"
              validate={required()}
            />
          </ReferenceInput>
        </div>
      </CompactFormGrid>

      <CompactFormGrid columns="two">
        <div className="min-w-0">
          <ReferenceInput
            source="tipo_solicitud_id"
            reference={TIPOS_SOLICITUD_REFERENCE.resource}
            label="Tipo de solicitud"
          >
            <CompactSelectInput
              optionText={TIPOS_SOLICITUD_REFERENCE.labelField}
              className="w-full"
              triggerProps={{ disabled: tipoSolicitudBloqueado }}
              parse={emptyToNull}
            />
          </ReferenceInput>
        </div>

        <div className="min-w-0">
          <CompactFormField label="Tipo de compra">
            <CompactSelectInput
              source="tipo_compra"
              choices={TIPO_COMPRA_CHOICES}
              label={false}
              className="w-full"
              validate={required()}
            />
          </CompactFormField>
        </div>

        <div className="min-w-0">
          <ReferenceInput
            source="departamento_id"
            reference={DEPARTAMENTOS_REFERENCE.resource}
            label="Departamento"
          >
            <CompactSelectInput
              optionText={DEPARTAMENTOS_REFERENCE.labelField}
              className="w-full"
              parse={emptyToNull}
            />
          </ReferenceInput>
        </div>

        <div className="min-w-0">
          <ReferenceInput
            source="usuario_responsable_id"
            reference={USERS_REFERENCE.resource}
            label="Responsable"
          >
            <CompactSelectInput
              optionText={USERS_REFERENCE.labelField}
              className="w-full"
              validate={required()}
            />
          </ReferenceInput>
        </div>
      </CompactFormGrid>

      <div className="min-w-0">
        <ReferenceInput
          source="centro_costo_id"
          reference={CENTROS_COSTO_REFERENCE.resource}
          label="Centro de costo"
          filter={CENTROS_COSTO_REFERENCE.filter}
        >
          <CompactSelectInput
            optionText={CENTROS_COSTO_REFERENCE.labelField}
            className="w-full"
            triggerProps={{ className: "w-full truncate text-left" }}
            parse={emptyToNull}
          />
        </ReferenceInput>
      </div>

      <CompactFormField label="Observaciones">
        <Textarea
          rows={3}
          className="min-h-10 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
          {...form.register("observaciones")}
        />
      </CompactFormField>
    </>
  );
};

const PoFacturaFormFields = () => {
  const dataProvider = useDataProvider();
  const form = useFormContext<PoFactura>();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const observacionesValue = useWatch({ control, name: "observaciones" }) || "";
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const centroCostoValue = useWatch({ control, name: "centro_costo_id" });
  const detallesValue = useWatch({ control, name: "detalles" });
  const totalesValue = useWatch({ control, name: "totales" });

  const { data: tiposSolicitudData } = useQuery<TipoSolicitudCatalog[]>({
    queryKey: ["tipos-solicitud", "defaults"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        TIPOS_SOLICITUD_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: TIPOS_SOLICITUD_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
        }
      );
      return data as TipoSolicitudCatalog[];
    },
    staleTime: TIPOS_SOLICITUD_REFERENCE.staleTime,
  });

  const { data: tiposArticuloData } = useQuery<
    { id: number; nombre: string; adm_concepto_id?: number | null }[]
  >({
    queryKey: ["tipos-articulo", "catalog"],
    queryFn: async () => {
      const { data } = await dataProvider.getList("tipos-articulo", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "nombre", order: "ASC" },
        filter: { activo: true },
      });
      return data as { id: number; nombre: string; adm_concepto_id?: number | null }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const articuloIds = useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const ids = detalles
      .map((detalle) => Number(detalle?.articulo_id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);
    return Array.from(new Set(ids));
  }, [detallesValue]);

  const { data: articulosData } = useQuery<
    { id: number; tipo_articulo_id?: number | null }[]
  >({
    queryKey: ["articulos", "map", articuloIds],
    queryFn: async () => {
      if (articuloIds.length === 0) return [];
      const { data } = await dataProvider.getMany("articulos", { ids: articuloIds });
      return data as { id: number; tipo_articulo_id?: number | null }[];
    },
    enabled: articuloIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: conceptosData } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["adm-conceptos", "catalog"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        ADM_CONCEPTOS_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: ADM_CONCEPTOS_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
        }
      );
      return data as { id: number; nombre: string }[];
    },
    staleTime: ADM_CONCEPTOS_REFERENCE.staleTime,
  });

  const { data: centrosCostoData } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["centros-costo", "catalog"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        CENTROS_COSTO_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: CENTROS_COSTO_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: CENTROS_COSTO_REFERENCE.filter ?? {},
        }
      );
      return data as { id: number; nombre: string }[];
    },
    staleTime: CENTROS_COSTO_REFERENCE.staleTime,
  });

  const tiposSolicitudCatalog = useMemo(
    () => tiposSolicitudData ?? [],
    [tiposSolicitudData]
  );
  const tiposArticuloCatalog = useMemo(
    () => tiposArticuloData ?? [],
    [tiposArticuloData]
  );
  const articulosCatalog = useMemo(() => articulosData ?? [], [articulosData]);
  const conceptosCatalog = useMemo(() => conceptosData ?? [], [conceptosData]);
  const centrosCostoCatalog = useMemo(
    () => centrosCostoData ?? [],
    [centrosCostoData]
  );

  const conceptosById = useMemo(() => {
    const map = new Map<number, string>();
    conceptosCatalog.forEach((item) => {
      map.set(item.id, item.nombre);
    });
    return map;
  }, [conceptosCatalog]);

  const centrosCostoById = useMemo(() => {
    const map = new Map<number, string>();
    centrosCostoCatalog.forEach((item) => {
      map.set(item.id, item.nombre);
    });
    return map;
  }, [centrosCostoCatalog]);

  const articulosById = useMemo(() => {
    const map = new Map<number, { id: number; tipo_articulo_id?: number | null }>();
    articulosCatalog.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [articulosCatalog]);

  const tiposArticuloById = useMemo(() => {
    const map = new Map<number, { adm_concepto_id?: number | null }>();
    tiposArticuloCatalog.forEach((item) => {
      map.set(item.id, { adm_concepto_id: item.adm_concepto_id ?? null });
    });
    return map;
  }, [tiposArticuloCatalog]);

  const articuloFilterId = useMemo(() => {
    return getArticuloFilterByTipo(
      tipoSolicitudValue ? String(tipoSolicitudValue) : undefined,
      tiposSolicitudCatalog,
      tiposArticuloCatalog
    );
  }, [tipoSolicitudValue, tiposSolicitudCatalog, tiposArticuloCatalog]);

  const dynamicReferenceFilters = useMemo((): Record<string, Record<string, any>> => {
    if (!articuloFilterId) return {};
    return {
      articulo_id: {
        tipo_articulo_id: articuloFilterId,
      },
    };
  }, [articuloFilterId]);

  const tipoSolicitudBloqueado = useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return detalles.length > 0;
  }, [detallesValue]);

  const subtotalItems = useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const grouped = new Map<
      string,
      { concepto_id: number; centro_costo_id?: number | null; importe: number }
    >();

    detalles.forEach((detalle) => {
      if (!detalle) return;
      const articuloId = Number(detalle.articulo_id ?? 0);
      if (!Number.isFinite(articuloId) || articuloId <= 0) return;
      const articulo = articulosById.get(articuloId);
      const tipoArticuloId = Number(articulo?.tipo_articulo_id ?? 0);
      if (!Number.isFinite(tipoArticuloId) || tipoArticuloId <= 0) return;
      const conceptoId = tiposArticuloById.get(tipoArticuloId)?.adm_concepto_id;
      if (!conceptoId) return;

      const centroCostoId =
        normalizeCentroCostoId(detalle.centro_costo_id) ??
        normalizeCentroCostoId(centroCostoValue);

      const subtotal = normalizeNumber(detalle.subtotal);
      const descuento = normalizeNumber(detalle.importe_descuento);
      const neto = roundCurrency(subtotal - descuento);

      const key = `${conceptoId}:${centroCostoId ?? "none"}`;
      const current = grouped.get(key);
      if (current) {
        current.importe = roundCurrency(current.importe + neto);
      } else {
        grouped.set(key, {
          concepto_id: conceptoId,
          centro_costo_id: Number.isFinite(centroCostoId as number)
            ? (centroCostoId as number)
            : null,
          importe: neto,
        });
      }
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        concepto_label: conceptosById.get(item.concepto_id) || "",
        centro_costo_label: item.centro_costo_id
          ? centrosCostoById.get(item.centro_costo_id)
          : undefined,
      }))
      .sort((a, b) => a.concepto_label.localeCompare(b.concepto_label));
  }, [
    detallesValue,
    articulosById,
    tiposArticuloById,
    conceptosById,
    centrosCostoById,
    centroCostoValue,
  ]);

  useAutoInitializeField("usuario_responsable_id", "id", !idValue);

  useEffect(() => {
    const totales = Array.isArray(totalesValue) ? totalesValue : [];
    const filtered = totales.filter((item) => item?.tipo !== "subtotal");
    if (filtered.length !== totales.length) {
      form.setValue("totales", filtered, { shouldDirty: false });
    }
  }, [totalesValue, form]);

  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const impuestos = Array.isArray(totalesValue)
      ? totalesValue.filter((item) => item?.tipo === "impuesto")
      : [];

    const totals = detalles.reduce(
      (acc, detalle) => {
        if (!detalle) return acc;
        const subtotal = normalizeNumber(detalle.subtotal);
        const descuento = normalizeNumber(detalle.importe_descuento);
        const neto = roundCurrency(subtotal - descuento);
        const iva = normalizeNumber(detalle.importe_iva);
        const totalLinea = normalizeNumber(detalle.total_linea);

        acc.subtotal += neto;
        acc.total_impuestos += iva;
        acc.total += totalLinea || neto + iva;
        return acc;
      },
      { subtotal: 0, total_impuestos: 0, total: 0 }
    );

    const impuestosTotal = impuestos.reduce((acc, total) => {
      if (!total) return acc;
      return acc + normalizeNumber(total.importe);
    }, 0);

    totals.total_impuestos = roundCurrency(
      normalizeNumber(totals.total_impuestos) + impuestosTotal
    );
    totals.total = roundCurrency(normalizeNumber(totals.total) + impuestosTotal);

    const normalizedSubtotal = roundCurrency(totals.subtotal);
    const normalizedImpuestos = roundCurrency(totals.total_impuestos);
    const normalizedTotal = roundCurrency(totals.total);

    if (roundCurrency(normalizeNumber(form.getValues("subtotal"))) !== normalizedSubtotal) {
      form.setValue("subtotal", normalizedSubtotal, { shouldDirty: true });
    }
    if (
      roundCurrency(normalizeNumber(form.getValues("total_impuestos"))) !==
      normalizedImpuestos
    ) {
      form.setValue("total_impuestos", normalizedImpuestos, { shouldDirty: true });
    }
    if (roundCurrency(normalizeNumber(form.getValues("total"))) !== normalizedTotal) {
      form.setValue("total", normalizedTotal, { shouldDirty: true });
    }
  }, [detallesValue, totalesValue, form]);

  const generalSubtitle = useMemo(
    () => buildGeneralSubtitle(observacionesValue),
    [observacionesValue]
  );

  return (
    <FormLayout
      sections={[
        {
          id: "cabecera",
          title: "Cabecera",
          defaultOpen: !idValue,
          headerContent: <PoFacturaHeaderInline />,
          headerContentPosition: "inline",
          contentPadding: "none",
          contentClassName: "space-y-2 px-4 py-2",
          children: (
            <CompactFormSection>
              <CabeceraContent tipoSolicitudBloqueado={tipoSolicitudBloqueado} />
            </CompactFormSection>
          ),
        },
        {
          id: "detalle",
          title: "Detalle",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-2 px-1 sm:px-1",
          headerContent: <PoFacturaSubtotalInline />,
          headerContentPosition: "inline",
          children: (
            <FormDetailSection
              name="detalles"
              schema={poFacturaDetalleSchema}
              minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
              dynamicFilters={dynamicReferenceFilters}
            >
              <PoFacturaDetalleContent
                articuloFilterId={articuloFilterId}
                hasTipoSolicitud={Boolean(tipoSolicitudValue)}
                defaultCentroCostoId={
                  typeof centroCostoValue === "number"
                    ? centroCostoValue
                    : centroCostoValue
                      ? Number(centroCostoValue)
                      : null
                }
              />
            </FormDetailSection>
          ),
        },
        {
          id: "totales",
          title: "Totales",
          defaultOpen: false,
          contentPadding: "none",
          contentClassName: "space-y-2 px-1 sm:px-1",
          headerContent: <PoFacturaTotalesInline />,
          headerContentPosition: "inline",
          children: (
            <FormDetailSection
              name="totales"
              schema={poFacturaTotalSchema}
            >
              <PoFacturaTotalesContent
                subtotalItems={subtotalItems}
                centrosCostoById={centrosCostoById}
              />
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};
const PoFacturaSubtotalInline = () => {
  const { control } = useFormContext<PoFactura>();
  const subtotal = useWatch({ control, name: "subtotal" }) ?? 0;

  return (
    <div className="flex w-full items-center justify-end text-[9px] leading-none text-muted-foreground sm:text-[11px]">
      <span>Subtotal:&nbsp;</span>
      <strong className="text-foreground">
        {CURRENCY_FORMATTER.format(Number(subtotal) || 0)}
      </strong>
    </div>
  );
};

const PoFacturaTotalesInline = () => {
  const { control } = useFormContext<PoFactura>();
  const totalImpuestos = useWatch({ control, name: "total_impuestos" }) ?? 0;
  const total = useWatch({ control, name: "total" }) ?? 0;

  return (
    <div className="flex w-full items-center justify-end gap-3 text-[9px] leading-none text-muted-foreground sm:text-[11px]">
      <span>
        Impuestos:&nbsp;
        <strong className="text-foreground">
          {CURRENCY_FORMATTER.format(Number(totalImpuestos) || 0)}
        </strong>
      </span>
      <span>
        Total:&nbsp;
        <strong className="text-foreground">
          {CURRENCY_FORMATTER.format(Number(total) || 0)}
        </strong>
      </span>
    </div>
  );
};

const PoFacturaHeaderInline = () => {
  const { control } = useFormContext<PoFactura>();
  const estadoValue = useWatch({ control, name: "estado" });
  if (!estadoValue) {
    return null;
  }
  const estadoKey = String(estadoValue);
  const estadoLabel =
    ESTADO_CHOICES.find((choice) => choice.id === estadoKey)?.name ||
    estadoKey;
  const badgeClass = ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800";
  return (
    <div className="flex w-full items-center justify-end">
      <Badge className={`${badgeClass} text-[10px] sm:text-xs`}>
        {estadoLabel}
      </Badge>
    </div>
  );
};

const FormFooter = () => <FormToolbar />;

export const PoFacturaForm = () => {
  const cabeceraDefaults = useMemo(() => poFacturaCabeceraSchema.defaults(), []);

  const defaultValues = useMemo(() => {
    const metodoPagoParsed =
      cabeceraDefaults.metodo_pago_id &&
      cabeceraDefaults.metodo_pago_id.trim().length > 0
        ? Number(cabeceraDefaults.metodo_pago_id)
        : 1;
    const metodoPagoDefault = Number.isFinite(metodoPagoParsed)
      ? metodoPagoParsed
      : 1;
    const centroCostoParsed =
      cabeceraDefaults.centro_costo_id &&
      cabeceraDefaults.centro_costo_id.trim().length > 0
        ? Number(cabeceraDefaults.centro_costo_id)
        : undefined;
    const centroCostoDefault = Number.isFinite(centroCostoParsed)
      ? centroCostoParsed
      : undefined;
    const tipoSolicitudParsed =
      cabeceraDefaults.tipo_solicitud_id &&
      cabeceraDefaults.tipo_solicitud_id.trim().length > 0
        ? Number(cabeceraDefaults.tipo_solicitud_id)
        : undefined;
    const tipoSolicitudDefault = Number.isFinite(tipoSolicitudParsed)
      ? tipoSolicitudParsed
      : undefined;
    const proveedorParsed =
      cabeceraDefaults.proveedor_id &&
      cabeceraDefaults.proveedor_id.trim().length > 0
        ? Number(cabeceraDefaults.proveedor_id)
        : undefined;
    const proveedorDefault = Number.isFinite(proveedorParsed)
      ? proveedorParsed
      : undefined;
    const usuarioParsed =
      cabeceraDefaults.usuario_responsable_id &&
      cabeceraDefaults.usuario_responsable_id.trim().length > 0
        ? Number(cabeceraDefaults.usuario_responsable_id)
        : undefined;
    const usuarioDefault = Number.isFinite(usuarioParsed)
      ? usuarioParsed
      : undefined;
    const tipoComprobanteParsed =
      cabeceraDefaults.id_tipocomprobante &&
      cabeceraDefaults.id_tipocomprobante.trim().length > 0
        ? Number(cabeceraDefaults.id_tipocomprobante)
        : undefined;
    const tipoComprobanteDefault = Number.isFinite(tipoComprobanteParsed)
      ? tipoComprobanteParsed
      : undefined;
    const comprobanteParsed =
      cabeceraDefaults.comprobante_id &&
      cabeceraDefaults.comprobante_id.trim().length > 0
        ? Number(cabeceraDefaults.comprobante_id)
        : undefined;
    const comprobanteDefault = Number.isFinite(comprobanteParsed)
      ? comprobanteParsed
      : undefined;

    return {
      ...cabeceraDefaults,
      proveedor_id: proveedorDefault,
      usuario_responsable_id: usuarioDefault,
      metodo_pago_id: metodoPagoDefault,
      centro_costo_id: centroCostoDefault,
      tipo_solicitud_id: tipoSolicitudDefault,
      id_tipocomprobante: tipoComprobanteDefault,
      comprobante_id: comprobanteDefault,
      subtotal: 0,
      total_impuestos: 0,
      total: 0,
      detalles: [] as PoFacturaDetalle[],
      totales: [] as PoFacturaTotal[],
    };
  }, [cabeceraDefaults]);

  return (
    <SimpleForm defaultValues={defaultValues} toolbar={<FormFooter />}>
      <PoFacturaFormFields />
    </SimpleForm>
  );
};
