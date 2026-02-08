"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  required,
  useInput,
  useSimpleFormIterator,
  useSimpleFormIteratorItem,
  useWrappedSource,
} from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { SelectInput } from "@/components/select-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { NumberField } from "@/components/number-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, PlusCircle, Trash, XCircle } from "lucide-react";
import { Confirm } from "@/components/confirm";

import {
  computeDetalleImporte,
  computePoOrderTotal,
  poOrderSchema,
} from "./model";
import type { PoOrderFormValues } from "./model";
import { usePoOrderDefaults, useTipoSolicitudChangeGuard } from "./form_hooks";

const unidadMedidaChoices = [
  { id: "UN", name: "Unidad" },
  { id: "KG", name: "Kilogramo" },
  { id: "LT", name: "Litro" },
] as const;

const HiddenInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return <input type="hidden" {...field} />;
};

export const PoOrderForm = () => (
  <SimpleForm<PoOrderFormValues>
    className="w-full max-w-3xl"
    // ra-core FormProps types resolver as Resolver<FieldValues>
    resolver={zodResolver(poOrderSchema) as any}
    toolbar={<FormOrderToolbar />}
  >
    <PoOrderFormFields />
  </SimpleForm>
);

const PoOrderFormFields = () => {
  usePoOrderDefaults();
  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =
    useTipoSolicitudChangeGuard();
  const [showOptional, setShowOptional] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showDetalle, setShowDetalle] = useState(true);

  return (
    <>

      <Card className="border border-border w-full pt-2 pb-2">
        <CardContent className="px-3 pt-0 pb-0">
          <div
            className="flex items-center justify-between cursor-pointer group hover:text-primary"
            onClick={() => setShowHeader((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowHeader((v) => !v);
              }
            }}
          >
            <div className="text-sm font-bold text-foreground group-hover:text-primary mb-2">
              Cabecera
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setShowHeader((v) => !v);
              }}
              aria-label={showHeader ? "Ocultar cabecera" : "Mostrar cabecera"}
              title={showHeader ? "Ocultar cabecera" : "Mostrar cabecera"}
            >
              {showHeader ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {showHeader ? (
            <>
              <div className="flex flex-col gap-1 md:flex-row md:items-end text-[11px] [&_[data-slot=form-item]]:gap-0 [&_[data-slot=form-item]]:sm:gap-0 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:mb-0 [&_label]:leading-none [&_label+*]:mt-0 [&_input]:text-[11px] [&_input]:h-6 [&_[role=combobox]]:h-6">
            <div className="w-full md:w-[220px]">
              <TextInput source="titulo" label="Titulo" validate={required()} />
            </div>
            <div className="w-full md:w-[200px]">
              <ReferenceInput source="solicitante_id" reference="users">
                <AutocompleteInput
                  optionText="nombre"
                  label="Solicitante"
                  validate={required()}
                  className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
                />
              </ReferenceInput>
            </div>
            <div className="w-full md:w-[200px]">
              <ReferenceInput source="tipo_solicitud_id" reference="tipos-solicitud">
                <AutocompleteInput
                  optionText="nombre"
                  label="Tipo solicitud"
                  validate={required()}
                  className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
                />
              </ReferenceInput>
            </div>
            <div className="relative w-full md:w-[200px]">
              <ReferenceInput source="proveedor_id" reference="proveedores">
                <AutocompleteInput
                  optionText="nombre"
                  label="Proveedor"
                  className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
                />
              </ReferenceInput>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-auto p-0 text-[10px] text-muted-foreground md:absolute md:right-0 md:top-full md:mt-1"
                onClick={() => setShowOptional((v) => !v)}
                aria-label={showOptional ? "Ocultar campos" : "Mostrar campos"}
                title={showOptional ? "Ocultar campos" : "Mostrar campos"}
              >
                {showOptional ? "menos datos" : "mas datos..."}
              </Button>
            </div>
            <div className="md:pb-1" />
            <div className="flex flex-col gap-1 md:pb-1" />
          </div>

              {/* Always compute total for validation/payload, but only display it inside the toggle */}
              <TotalCompute />
              <HiddenInput source="total" />

              <OptionalHeaderFields showOptional={showOptional} />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-border w-full pt-2">
        <CardContent className="px-3 pt-0 pb-2">
          <div
            className="flex items-center justify-between cursor-pointer group hover:text-primary"
            onClick={() => setShowDetalle((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowDetalle((v) => !v);
              }
            }}
          >
            <div className="text-sm font-bold text-foreground group-hover:text-primary mb-0">
              Detalle
            </div>
            <DetalleHeaderActions
              showDetalle={showDetalle}
              setShowDetalle={setShowDetalle}
            />
          </div>
          {showDetalle ? <DetalleScrollable articuloFilter={articuloFilter} /> : null}
        </CardContent>
      </Card>

      <Confirm
        isOpen={confirmOpen}
        title="Cambiar tipo de solicitud"
        content="Esto limpiará los artículos seleccionados. ¿Deseas continuar?"
        onConfirm={confirmChange}
        onClose={cancelChange}
      />
    </>
  );
};

const OptionalHeaderFields = ({ showOptional }: { showOptional: boolean }) => {
  return (
    <div className="mt-6 space-y-1 text-[11px] [&_[data-slot=form-item]]:gap-0 [&_[data-slot=form-item]]:sm:gap-0 [&_label]:text-[11px] [&_label]:mb-0 [&_label]:leading-none [&_label+*]:mt-0 [&_input]:text-[11px] [&_input]:h-6 [&_[role=combobox]]:h-6">
      {showOptional ? (
        <div className="grid gap-2 grid-cols-2">
          <ReferenceInput
            source="departamento_id"
            reference="departamentos"
          >
            <AutocompleteInput
              optionText="nombre"
              label="Departamento"
              validate={required()}
              className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
            />
          </ReferenceInput>
          <TextInput
            source="fecha_necesidad"
            label="Fecha necesidad"
            type="date"
          />
          <ReferenceInput
            source="centro_costo_id"
            reference="centros-costo"
          >
            <AutocompleteInput
              optionText="nombre"
              label="Centro de costo"
              className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
            />
          </ReferenceInput>
          <ReferenceInput
            source="oportunidad_id"
            reference="crm/oportunidades"
          >
            <AutocompleteInput
              optionText="titulo"
              label="Oportunidad"
              className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
            />
          </ReferenceInput>
          <TextInput
            source="comentario"
            label="Comentario"
            multiline
            className="col-span-2 [&_textarea]:min-h-[64px]"
          />
        </div>
      ) : null}
    </div>
  );
};

const DetalleScrollable = ({
  articuloFilter,
}: {
  articuloFilter?: Record<string, unknown>;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;
  const prevLengthRef = useRef<number>(detalles?.length ?? 0);

  useEffect(() => {
    const length = detalles?.length ?? 0;
    if (length > prevLengthRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      const container = containerRef.current;
      window.setTimeout(() => {
        const fields = container.querySelectorAll('[data-articulo-field="true"]');
        const last = fields[fields.length - 1];
        const focusTarget =
          (last?.querySelector('[role="combobox"]') as HTMLElement | null) ??
          (last?.querySelector("input") as HTMLElement | null) ??
          (last as HTMLElement | null);
        focusTarget?.focus();
      }, 0);
    }
    prevLengthRef.current = length;
  }, [detalles?.length]);

  return (
      <div className="mt-1 space-y-0 w-full">
      <div className="hidden sm:grid grid-cols-[220px_150px_64px_84px_84px_28px] gap-2 text-[10px] font-semibold text-foreground [&>div]:pl-3 pb-0">
        <div>Artículo</div>
        <div>Descripción</div>
        <div>Cantidad</div>
        <div>Precio</div>
        <div>Importe</div>
        <div />
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-80 md:overflow-y-auto text-[9px] sm:text-[10px] [&_label]:text-[9px] sm:[&_label]:text-[10px] [&_input]:text-[9px] sm:[&_input]:text-[10px] [&_input]:h-5 sm:[&_input]:h-5 [&_[role=combobox]]:h-5 sm:[&_[role=combobox]]:h-5 [&_textarea]:text-[9px] sm:[&_textarea]:text-[10px] [&_textarea]:min-h-[20px] sm:[&_textarea]:min-h-[22px]"
      >
        <ArrayInput source="detalles" label={false}>
          <SimpleFormIterator
            inline
            addButton={<DetalleFooterButtons />}
            disableClear
            disableReordering
            disableRemove
            className="gap-0 [&_ul]:gap-2 sm:[&_ul]:gap-0 [&_li]:pb-0 [&_li]:gap-0 [&_li]:border-b-0 [&_li]:border-transparent [&_li]:relative [&_li]:flex-col sm:[&_li]:flex-row [&_li]:items-stretch sm:[&_li]:items-center [&_.simple-form-iterator-item-actions]:!pt-0 [&_.simple-form-iterator-item-actions]:items-center [&_.simple-form-iterator-item-actions]:self-center [&_.simple-form-iterator-item-actions]:gap-0 [&_.simple-form-iterator-item-actions]:mt-0 [&_.simple-form-iterator-item-actions]:h-6 [&_.simple-form-iterator-item-actions]:-translate-y-[1px] [&_.simple-form-iterator-item-actions]:-ml-1 [&_.simple-form-iterator-item-actions>*]:-ml-3 [&_.simple-form-iterator-item-actions]:absolute [&_.simple-form-iterator-item-actions]:top-2 [&_.simple-form-iterator-item-actions]:right-2 sm:[&_.simple-form-iterator-item-actions]:static"
          >
            <DetalleRow articuloFilter={articuloFilter} />
          </SimpleFormIterator>
        </ArrayInput>
      </div>
    </div>
  );
};

const DetalleFooterButtons = () => {
  const { add } = useSimpleFormIterator();

  return (
    <>
      <div className="mt-1 hidden sm:flex w-full items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-1 text-[10px] w-full sm:w-[220px] h-6"
          onClick={() => add({ unidad_medida: "UN" })}
        >
          <PlusCircle className="h-4 w-4" />
          Agregar
        </Button>
        <div className="hidden sm:block ml-auto w-[28px]" />
        <div className="hidden sm:block w-[28px]" />
      </div>
      <div className="sm:hidden fixed bottom-2 left-[42%] -translate-x-1/2 z-30">
        <Button
          type="button"
          variant="default"
          size="icon"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={() => add({ unidad_medida: "UN" })}
          aria-label="Agregar linea"
          title="Agregar linea"
        >
          <PlusCircle className="h-3 w-3" />
        </Button>
      </div>
    </>
  );
};

const DetalleHeaderActions = ({
  showDetalle,
  setShowDetalle,
}: {
  showDetalle: boolean;
  setShowDetalle: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { getValues, setValue } = useFormContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;
  const hasDetalles = (detalles ?? []).length > 0;

  const handleClear = () => {
    setValue("detalles", [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const handleAdd = () => {
    const current = (getValues("detalles") as unknown[]) ?? [];
    setValue("detalles", [...current, {}], { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 text-[9px] text-primary h-6 px-2"
        onClick={handleAdd}
        tabIndex={-1}
      >
        <PlusCircle className="h-3 w-3" />
        Agregar
      </Button>
      {hasDetalles ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-[9px] text-destructive h-6 px-2"
          onClick={() => setConfirmOpen(true)}
          tabIndex={-1}
        >
          <Trash className="h-3 w-3" />
          Limpiar
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={() => setShowDetalle((v) => !v)}
        aria-label={showDetalle ? "Ocultar detalle" : "Mostrar detalle"}
        title={showDetalle ? "Ocultar detalle" : "Mostrar detalle"}
        tabIndex={-1}
      >
        {showDetalle ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      <Confirm
        isOpen={confirmOpen}
        title="Limpiar detalle"
        content="Se eliminaran todos los items. Deseas continuar?"
        onConfirm={handleClear}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
};

const DetalleRow = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const [showOptional, setShowOptional] = useState(false);
  const { remove } = useSimpleFormIteratorItem();

  return (
    <div className="flex w-full flex-col gap-1 rounded-md border border-border p-1 pb-0.5 pr-1 sm:pr-0 sm:gap-2 sm:border-0 sm:p-0">
      <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-2">
        <HiddenInput source="id" />
        <div
          className="col-span-1 w-full sm:col-auto sm:w-[220px] shrink-0"
          data-articulo-field="true"
        >
          <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
            Articulo
          </div>
          <div className="grid grid-cols-[1fr_20px] items-center gap-1 sm:block">
            <div className="flex-1">
              <ReferenceInput
                source="articulo_id"
                reference="articulos"
                filter={articuloFilter}
              >
                <AutocompleteInput
                  optionText="nombre"
                  label={false}
                  className="w-full text-[9px] sm:text-[11px] [&_[role=combobox]]:h-5 sm:[&_[role=combobox]]:h-5 [&_[role=combobox]]:text-[9px] sm:[&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[9px] sm:[&_[role=combobox]_span]:text-[11px]"
                />
              </ReferenceInput>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:hidden h-6 w-6 -mr-1"
              onClick={() => remove()}
              aria-label="Eliminar linea"
              title="Eliminar linea"
              tabIndex={-1}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <TextInput
          source="descripcion"
          label={false}
          className="w-full sm:w-[130px] shrink-0 [&_input]:text-[9px] sm:[&_input]:text-[10px] hidden sm:block"
        />
        <div className="col-span-1 grid grid-cols-[1fr_20px] gap-1 sm:contents">
          <div className="grid grid-cols-[44px_70px_80px] gap-1 sm:flex sm:items-center sm:gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Cant.
              </div>
              <NumberInput
                source="cantidad"
                label={false}
                inputMode="decimal"
                step="0.001"
                className="w-[44px] sm:w-[80px] shrink-0 [&_input]:text-[7px] sm:[&_input]:text-[7px]"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Precio
              </div>
          <NumberInput
            source="precio"
            label={false}
            inputMode="decimal"
            step="0.01"
              className="w-[70px] sm:w-[84px] shrink-0 [&_input]:text-[7px] sm:[&_input]:text-[7px]"
          />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Importe
              </div>
              <CalculatedImporte />
              <HiddenInput source="importe" />
            </div>
          </div>
          <div className="flex items-end justify-end sm:hidden -mr-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowOptional((v) => !v)}
              aria-label={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
              title={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
              tabIndex={-1}
            >
              {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowOptional((v) => !v)}
            aria-label={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
            title={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
            tabIndex={-1}
          >
            {showOptional ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => remove()}
            aria-label="Eliminar linea"
            title="Eliminar linea"
            tabIndex={-1}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <DetalleOptionalFields showOptional={showOptional} />
      <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
    </div>
  );
};

const DetalleOptionalFields = ({ showOptional }: { showOptional: boolean }) => {
  return (
    <div className="w-full">
      {showOptional ? (
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <TextInput
            source="descripcion"
            label="Descripcion"
            className="sm:hidden"
          />
          <SelectInput
            source="unidad_medida"
            label="Unidad"
            choices={unidadMedidaChoices as any}
          />
        </div>
      ) : null}
    </div>
  );
};

const CalculatedImporte = () => {
  const { setValue } = useFormContext();
  const cantidadSource = useWrappedSource("cantidad");
  const precioSource = useWrappedSource("precio");
  const importeSource = useWrappedSource("importe");

  const cantidad = useWatch({ name: cantidadSource }) as number | undefined;
  const precio = useWatch({ name: precioSource }) as number | undefined;

  const importe = useMemo(
    () => computeDetalleImporte({ cantidad, precio }),
    [cantidad, precio],
  );

  useEffect(() => {
    setValue(importeSource, importe, { shouldDirty: true, shouldValidate: true });
  }, [importeSource, importe, setValue]);

  return (
    <div className="flex flex-col w-[80px] sm:w-[84px] shrink-0">
      <div className="flex h-5 sm:h-5 items-center justify-end rounded-md border border-border bg-muted/30 px-2 text-[9px] sm:text-[9px] font-medium text-right">
        <NumberField
          source="importe"
          record={{ importe }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        />
      </div>
    </div>
  );
};

const TotalCompute = () => {
  const { setValue } = useFormContext();
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ importe?: unknown }>
    | undefined;
  const total = useMemo(() => computePoOrderTotal(detalles ?? []), [detalles]);

  useEffect(() => {
    setValue("total", total, { shouldDirty: true, shouldValidate: true });
  }, [total, setValue]);

  return null;
};

