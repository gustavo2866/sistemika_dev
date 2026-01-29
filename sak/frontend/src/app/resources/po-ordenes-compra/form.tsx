"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { required, useDataProvider, useGetIdentity, useGetOne } from "ra-core";
import { useFormContext, useWatch, type UseFormReturn } from "react-hook-form";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { CompactOportunidadSelector } from "../crm-oportunidades";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DetalleFormValues,
  type PoOrdenCompra,
  type PoOrdenCompraDetalle,
  ARTICULOS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  ESTADO_CHOICES,
  getArticuloFilterByTipo,
  METODOS_PAGO_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPO_COMPRA_CHOICES,
  TIPOS_SOLICITUD_REFERENCE,
  UNIDAD_MEDIDA_CHOICES,
  USERS_REFERENCE,
  VALIDATION_RULES,
  poOrdenCompraCabeceraSchema,
  poOrdenCompraDetalleSchema,
} from "./model";
import type { TipoSolicitud } from "../tipos-solicitud/model";
import { create_wizard_2 as CreateWizard, type CreateWizard2Payload } from "./create_wizard_2";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  emitida: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  recibida: "bg-amber-100 text-amber-800",
  cerrada: "bg-indigo-100 text-indigo-800",
  anulada: "bg-slate-200 text-slate-600",
};

const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const emptyToNull = (value: unknown) => (value === "" ? null : value);

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

const PoOrdenCompraDetalleCard = ({
  item,
  onDelete,
}: {
  item: PoOrdenCompraDetalle;
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
      className="space-y-0.5"
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
        <div className="flex flex-col gap-0">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <span className="truncate text-[10px] leading-none sm:text-[11px]">
              Cantidad: {cantidad} | Precio: {precio}
            </span>
            <span className="rounded bg-muted/60 px-1.5 py-0.5 text-right text-[10px] font-semibold sm:text-[11px]">
              {totalLinea}
            </span>
          </div>
          {centroCostoLabel ? (
            <span className="text-[8px] leading-none text-muted-foreground sm:rounded sm:bg-muted/60 sm:px-1.5 sm:py-0.5 sm:text-[9px]">
              {centroCostoLabel}
            </span>
          ) : null}
        </div>
      }
    >
      <div className="text-[9px] leading-none text-muted-foreground sm:text-[10px]">
        {descripcion || "Sin descripcion"}
      </div>
    </FormDetailCardCompact>
  );
};

type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter_id"
>;

type PoOrdenCompraDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilterId?: number;
  hasTipoSolicitud?: boolean;
  defaultCentroCostoId?: number | null;
};

const PoOrdenCompraDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
  articuloFilterId,
  hasTipoSolicitud,
  defaultCentroCostoId,
}: PoOrdenCompraDetalleDialogContentProps) => {
  const { resolveAction, items } = useFormDetailSectionContext<
    DetalleFormValues,
    PoOrdenCompraDetalle
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
    const currentOrden = normalizeNumber((detalleForm.getValues as any)("orden"));
    if (currentOrden > 0) {
      return;
    }
    (detalleForm.setValue as any)("orden", items.length + 1, {
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

      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 sm:gap-3">
          <CompactFormField
            label="Centro de costo"
            labelClassName="text-[9px] sm:text-[10px]"
            className="space-y-0"
          >
            <CompactComboboxQuery
              {...CENTROS_COSTO_REFERENCE}
              value={detalleForm.watch("centro_costo_id") ?? ""}
              onChange={(value: string) => {
                detalleForm.setValue("centro_costo_id", value, {
                  shouldValidate: true,
                });
                if (value) {
                  detalleForm.setValue("oportunidad_id", "", {
                    shouldValidate: true,
                  });
                }
              }}
              placeholder="Centro"
              clearable
              filter={CENTROS_COSTO_REFERENCE.filter}
              className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
              popoverClassName="w-72 max-w-sm text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
              clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
              clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
            />
          </CompactFormField>

          <CompactFormField
            label="Oportunidad"
            labelClassName="text-[9px] sm:text-[10px]"
            className="space-y-0"
          >
            <CompactOportunidadSelector
              value={detalleForm.watch("oportunidad_id") ?? ""}
              onChange={(value: string) => {
                detalleForm.setValue("oportunidad_id", value, {
                  shouldValidate: true,
                });
                if (value) {
                  detalleForm.setValue("centro_costo_id", "", {
                    shouldValidate: true,
                  });
                }
              }}
              placeholder="Selecciona una oportunidad"
              className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
              popoverClassName="w-64 max-w-xs text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
              clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
              clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
              clearable
              showWideDropdown={false}
            />
          </CompactFormField>
        </div>
      </div>
    </>
  );
};

const PoOrdenCompraDetalleForm = ({
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
        <PoOrdenCompraDetalleDialogContent
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

const PoOrdenCompraDetalleContent = ({
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
      <FormDetailCardList<PoOrdenCompraDetalle>
        emptyMessage="Todavia no agregaste articulos."
        showEditAction={false}
        showDeleteAction={false}
        contentClassName="px-2 py-2 sm:px-3"
        gridClassName="grid-cols-[minmax(0,1fr)] items-start gap-2"
        listClassName="mt-1 space-y-1"
        variant="row"
      >
        {(item, index) => (
          <PoOrdenCompraDetalleCard
            item={item}
            onDelete={() => handleDeleteBySortedIndex(index)}
          />
        )}
      </FormDetailCardList>
      <FormDetailSectionMinItems itemName="articulo" />
      <PoOrdenCompraDetalleForm
        articuloFilterId={articuloFilterId}
        hasTipoSolicitud={hasTipoSolicitud}
        defaultCentroCostoId={defaultCentroCostoId}
      />
    </>
  );
};

const CabeceraContent = ({
  tipoSolicitudBloqueado,
  showFechaEstado,
}: {
  tipoSolicitudBloqueado?: boolean;
  showFechaEstado?: boolean;
}) => {
  const form = useFormContext<PoOrdenCompra>();
  return (
    <CompactFormGrid columns="two">
      <div className="min-w-0 md:col-span-2">
        <CompactTextInput
          source="titulo"
          label="Titulo"
          className="w-full"
          validate={required()}
          maxLength={50}
        />
      </div>

      <div className="min-w-0">
        <CompactTextInput
          source="fecha"
          label="Fecha"
          type="date"
          className="w-full"
        />
      </div>

      {showFechaEstado ? (
        <div className="min-w-0">
          <CompactTextInput
            source="fecha_estado"
            label="Fecha estado"
            type="date"
            className="w-full"
            inputClassName="bg-muted/50"
            readOnly
            disabled
            format={(value) =>
              typeof value === "string" ? value.slice(0, 10) : value
            }
          />
        </div>
      ) : (
        <input type="hidden" {...form.register("fecha_estado")} />
      )}

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
  );
};

const ImputacionContent = () => {
  const form = useFormContext<PoOrdenCompra>();
  const { control } = form;
  const centroCostoValue = useWatch({ control, name: "centro_costo_id" });
  const oportunidadValue = useWatch({ control, name: "oportunidad_id" });
  const prevCentroRef = useRef<unknown>(centroCostoValue);
  const prevOportunidadRef = useRef<unknown>(oportunidadValue);

  useEffect(() => {
    const isEmpty = (value: unknown) =>
      value === null || value === undefined || value === "";

    const centroChanged = prevCentroRef.current !== centroCostoValue;
    const oportunidadChanged = prevOportunidadRef.current !== oportunidadValue;

    if (centroChanged && !isEmpty(centroCostoValue) && !isEmpty(oportunidadValue)) {
      form.setValue("oportunidad_id", null, { shouldDirty: true });
    }

    if (oportunidadChanged && !isEmpty(oportunidadValue) && !isEmpty(centroCostoValue)) {
      form.setValue("centro_costo_id", null, { shouldDirty: true });
    }

    prevCentroRef.current = centroCostoValue;
    prevOportunidadRef.current = oportunidadValue;
  }, [centroCostoValue, form, oportunidadValue]);

  return (
    <CompactFormGrid columns="two">
      <CompactFormField label="Centro de costo" className="min-w-0 w-full">
        <CompactComboboxQuery
          {...CENTROS_COSTO_REFERENCE}
          source="centro_costo_id"
          placeholder="Centro"
          clearable
          filter={CENTROS_COSTO_REFERENCE.filter}
          className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
          popoverClassName="w-72 max-w-sm text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
          clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
          clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
        />
      </CompactFormField>

      <CompactFormField label="Oportunidad" className="min-w-0 w-full">
        <CompactOportunidadSelector
          source="oportunidad_id"
          placeholder="Selecciona una oportunidad"
          className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
          popoverClassName="w-64 max-w-xs text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
          clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
          clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
          clearable
          showWideDropdown={false}
        />
      </CompactFormField>

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

      <CompactFormField label="Observaciones" className="md:col-span-2">
        <Textarea
          rows={3}
          className="min-h-10 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
          {...form.register("observaciones")}
        />
      </CompactFormField>
    </CompactFormGrid>
  );
};

const TotalesContent = () => {
  const { control } = useFormContext<PoOrdenCompra>();
  const subtotal = useWatch({ control, name: "subtotal" }) ?? 0;
  const impuestos = useWatch({ control, name: "total_impuestos" }) ?? 0;
  const total = useWatch({ control, name: "total" }) ?? 0;

  return (
    <CompactFormGrid columns="three">
      <CompactFormField label="Subtotal">
        <Input
          type="text"
          value={CURRENCY_FORMATTER.format(Number(subtotal))}
          readOnly
          className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm font-semibold"
        />
      </CompactFormField>

      <CompactFormField label="Total impuestos">
        <Input
          type="text"
          value={CURRENCY_FORMATTER.format(Number(impuestos))}
          readOnly
          className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm font-semibold"
        />
      </CompactFormField>

      <CompactFormField label="Total">
        <Input
          type="text"
          value={CURRENCY_FORMATTER.format(Number(total))}
          readOnly
          className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm font-bold text-primary"
        />
      </CompactFormField>
    </CompactFormGrid>
  );
};

const PoOrdenCompraFormFields = ({
  wizardOpen,
  setWizardOpen,
}: {
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider();
  const form = useFormContext<PoOrdenCompra>();
  const { data: identity } = useGetIdentity();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const estadoValue = useWatch({ control, name: "estado" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const centroCostoValue = useWatch({ control, name: "centro_costo_id" });
  const fechaEstadoValue = useWatch({ control, name: "fecha_estado" });
  const detallesValue = useWatch({ control, name: "detalles" });

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

  const { data: tiposArticuloData } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["tipos-articulo", "catalog"],
    queryFn: async () => {
      const { data } = await dataProvider.getList("tipos-articulo", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "nombre", order: "ASC" },
        filter: { activo: true },
      });
      return data as { id: number; nombre: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const tiposSolicitudCatalog = useMemo(
    () => tiposSolicitudData ?? [],
    [tiposSolicitudData]
  );
  const tiposArticuloCatalog = useMemo(
    () => tiposArticuloData ?? [],
    [tiposArticuloData]
  );

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

  useAutoInitializeField("usuario_responsable_id", "id", !idValue);

  useEffect(() => {
    if (idValue) return;
    if (fechaEstadoValue) return;
    form.setValue("fecha_estado", new Date().toISOString(), { shouldDirty: false });
  }, [fechaEstadoValue, form, idValue]);

  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
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
  }, [detallesValue, form]);

  const handleApplyWizard = (payload: CreateWizard2Payload) => {
    if (payload.titulo) {
      form.setValue("titulo", payload.titulo, { shouldDirty: true });
    }
    if (payload.fecha) {
      form.setValue("fecha", payload.fecha, { shouldDirty: true });
    }
    if (payload.proveedorId != null) {
      form.setValue("proveedor_id", payload.proveedorId, { shouldDirty: true });
    }
    if (payload.tipoSolicitudId != null) {
      form.setValue("tipo_solicitud_id", payload.tipoSolicitudId, {
        shouldDirty: true,
      });
    }
    if (payload.oportunidadId != null) {
      form.setValue("oportunidad_id", payload.oportunidadId, {
        shouldDirty: true,
      });
    }
    if (payload.responsableId != null) {
      form.setValue("usuario_responsable_id", payload.responsableId, {
        shouldDirty: true,
      });
    } else if (identity?.id != null) {
      form.setValue("usuario_responsable_id", Number(identity.id), {
        shouldDirty: true,
      });
    }
    if (payload.detalles?.length) {
      form.setValue("detalles", payload.detalles, { shouldDirty: true });
    }
  };

  return (
    <>
      <CreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onApply={handleApplyWizard}
      />
      <FormLayout
        sections={[
        {
          id: "cabecera",
          title: "Cabecera",
          defaultOpen: false,
          headerContent: <PoOrdenCompraHeaderInline />,
          headerContentPosition: "inline",
          headerContentBelow: <PoOrdenCompraHeaderSummary />,
            contentPadding: "none",
            contentClassName: "space-y-2 px-4 py-2",
            children: (
              <CompactFormSection>
                <CabeceraContent
                  tipoSolicitudBloqueado={tipoSolicitudBloqueado}
                  showFechaEstado={Boolean(idValue)}
                />
              </CompactFormSection>
            ),
          },
          {
            id: "imputacion",
            title: "Imputacion",
            defaultOpen: false,
            headerContentBelow: <PoOrdenCompraImputacionSummary />,
            children: (
              <CompactFormSection>
                <ImputacionContent />
              </CompactFormSection>
            ),
          },
          {
            id: "detalle",
            title: "Detalle",
            defaultOpen: false,
            contentPadding: "none",
            contentClassName: "space-y-2 px-1 sm:px-1",
            headerContent: <PoOrdenCompraTotalsInline />,
            headerContentPosition: "inline",
            children: (
              <FormDetailSection
                name="detalles"
                schema={poOrdenCompraDetalleSchema}
                minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
                dynamicFilters={dynamicReferenceFilters}
              >
                <PoOrdenCompraDetalleContent
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
        ]}
      />
    </>
  );
};

const PoOrdenCompraTotalsInline = () => {
  const { control } = useFormContext<PoOrdenCompra>();
  const subtotal = useWatch({ control, name: "subtotal" }) ?? 0;

  return (
    <div className="flex w-full items-center justify-end gap-3 text-[10px] leading-none text-muted-foreground sm:text-[11px]">
      <span>
        Subtotal:{" "}
        <strong className="text-foreground">
          {CURRENCY_FORMATTER.format(Number(subtotal) || 0)}
        </strong>
      </span>
    </div>
  );
};

const PoOrdenCompraHeaderInline = () => {
  const { control } = useFormContext<PoOrdenCompra>();
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

const PoOrdenCompraHeaderSummary = () => {
  const { control } = useFormContext<PoOrdenCompra>();
  const tituloValue = useWatch({ control, name: "titulo" });
  const proveedorValue = useWatch({ control, name: "proveedor_id" });
  const proveedorId = Number(proveedorValue);
  const proveedorIdValid = Number.isFinite(proveedorId) && proveedorId > 0;
  const { data: proveedor } = useGetOne(
    "proveedores",
    { id: proveedorIdValid ? proveedorId : 0 },
    { enabled: proveedorIdValid }
  );
  const proveedorNombre = (proveedor as { nombre?: string } | undefined)?.nombre;
  const titulo = tituloValue && String(tituloValue).trim().length > 0
    ? String(tituloValue)
    : "Sin titulo";
  const proveedorLabel = proveedorNombre && proveedorNombre.trim().length > 0
    ? proveedorNombre
    : "Sin proveedor";

  return (
    <div className="flex w-full items-center gap-2 text-[10px] text-muted-foreground sm:text-xs">
      <span className="min-w-0 max-w-[60%] truncate">{titulo}</span>
      <span className="text-[10px] text-muted-foreground sm:text-xs">-</span>
      <span className="min-w-0 max-w-[40%] truncate">{proveedorLabel}</span>
    </div>
  );
};

const PoOrdenCompraImputacionSummary = () => {
  const { control } = useFormContext<PoOrdenCompra>();
  const centroCostoValue = useWatch({ control, name: "centro_costo_id" });
  const oportunidadValue = useWatch({ control, name: "oportunidad_id" });
  const centroCostoId = Number(centroCostoValue);
  const oportunidadId = Number(oportunidadValue);
  const centroCostoIdValid = Number.isFinite(centroCostoId) && centroCostoId > 0;
  const oportunidadIdValid = Number.isFinite(oportunidadId) && oportunidadId > 0;

  const { data: centroCosto } = useGetOne(
    CENTROS_COSTO_REFERENCE.resource,
    { id: centroCostoIdValid ? centroCostoId : 0 },
    { enabled: centroCostoIdValid }
  );
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadIdValid ? oportunidadId : 0 },
    { enabled: oportunidadIdValid }
  );

  const centroCostoNombre = (centroCosto as { nombre?: string } | undefined)?.nombre;
  const oportunidadTitulo =
    (oportunidad as { titulo?: string; descripcion_estado?: string } | undefined)?.titulo ||
    (oportunidad as { descripcion_estado?: string } | undefined)?.descripcion_estado;

  const label = centroCostoNombre && centroCostoNombre.trim().length > 0
    ? centroCostoNombre
    : oportunidadTitulo && oportunidadTitulo.trim().length > 0
      ? oportunidadTitulo
      : "Sin imputacion";

  return (
    <div className="flex w-full items-center gap-2 text-[10px] text-muted-foreground sm:text-xs">
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
};

const FormFooter = () => <FormToolbar />;

export const PoOrdenCompraForm = ({
  wizardOpen,
  setWizardOpen,
}: {
  wizardOpen?: boolean;
  setWizardOpen?: (open: boolean) => void;
}) => {
  const [localWizardOpen, setLocalWizardOpen] = useState(false);
  const resolvedWizardOpen = wizardOpen ?? localWizardOpen;
  const resolvedSetWizardOpen = setWizardOpen ?? setLocalWizardOpen;
  const cabeceraDefaults = useMemo(
    () => poOrdenCompraCabeceraSchema.defaults(),
    []
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

    return {
      ...cabeceraDefaults,
      fecha: cabeceraDefaults.fecha || today,
      proveedor_id: proveedorDefault,
      usuario_responsable_id: usuarioDefault,
      metodo_pago_id: metodoPagoDefault,
      centro_costo_id: centroCostoDefault,
      tipo_solicitud_id: tipoSolicitudDefault,
      subtotal: 0,
      total_impuestos: 0,
      total: 0,
      detalles: [] as PoOrdenCompraDetalle[],
    };
  }, [cabeceraDefaults, today]);

  return (
    <SimpleForm defaultValues={defaultValues} toolbar={<FormFooter />}>
      <PoOrdenCompraFormFields
        wizardOpen={resolvedWizardOpen}
        setWizardOpen={resolvedSetWizardOpen}
      />
    </SimpleForm>
  );
};
