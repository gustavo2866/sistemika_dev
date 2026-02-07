"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { required, useInput, useSimpleFormIterator, useWrappedSource } from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
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
import { ChevronDown, ChevronUp, PlusCircle, Trash } from "lucide-react";
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
  >
    <PoOrderFormFields />
  </SimpleForm>
);

const PoOrderFormFields = () => {
  usePoOrderDefaults();
  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =
    useTipoSolicitudChangeGuard();
  const [showOptional, setShowOptional] = useState(false);

  return (
    <>

      <Card className="border border-border w-full">
        <CardContent className="px-3 pt-0 pb-0">
          <div className="text-sm font-bold text-foreground">Cabecera</div>
          <div className="flex flex-col gap-1 md:flex-row md:items-end text-[11px] [&_label]:text-[11px] [&_label]:mb-0 [&_label]:leading-none [&_input]:text-[11px] [&_input]:h-6 [&_[role=combobox]]:h-6">
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
            <div className="w-full md:w-[200px]">
              <ReferenceInput source="proveedor_id" reference="proveedores">
                <AutocompleteInput
                  optionText="nombre"
                  label="Proveedor"
                  className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
                />
              </ReferenceInput>
            </div>
            <div className="md:pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowOptional((v) => !v)}
                aria-label={showOptional ? "Ocultar campos" : "Mostrar campos"}
                title={showOptional ? "Ocultar campos" : "Mostrar campos"}
              >
                {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-col gap-1 md:pb-1" />
          </div>

          {/* Always compute total for validation/payload, but only display it inside the toggle */}
          <TotalCompute />
          <HiddenInput source="total" />

          <OptionalHeaderFields showOptional={showOptional} />
        </CardContent>
      </Card>

      <Card className="border border-border w-full">
        <CardContent className="px-3 pt-0 pb-2">
          <div className="text-sm font-bold text-foreground">Detalle</div>
          <DetalleScrollable articuloFilter={articuloFilter} />
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
    <div className="mt-2 space-y-1 text-[11px] [&_label]:text-[11px] [&_label]:mb-0 [&_label]:leading-none [&_input]:text-[11px] [&_input]:h-6 [&_[role=combobox]]:h-6">
      {showOptional ? (
        <div className="grid gap-2 grid-cols-3">
          <ReferenceInput source="departamento_id" reference="departamentos">
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
          <ReferenceInput source="centro_costo_id" reference="centros-costo">
            <AutocompleteInput
              optionText="nombre"
              label="Centro de costo"
              className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
            />
          </ReferenceInput>
          <ReferenceInput source="oportunidad_id" reference="crm/oportunidades">
            <AutocompleteInput
              optionText="titulo"
              label="Oportunidad"
              className="text-[11px] [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
            />
          </ReferenceInput>
          <TextInput source="comentario" label="Comentario" multiline />
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
    }
    prevLengthRef.current = length;
  }, [detalles?.length]);

  return (
    <div className="mt-4 space-y-0 w-full">
      <div className="hidden sm:grid grid-cols-[240px_180px_64px_80px_90px_28px] gap-2 text-[11px] font-semibold text-foreground [&>div]:pl-3 [&>div:nth-child(3)]:pl-0 [&>div:nth-child(3)]:-ml-3 [&>div:nth-child(4)]:pl-0 [&>div:nth-child(4)]:-ml-3 [&>div:nth-child(5)]:pl-0 [&>div:nth-child(5)]:-ml-3 pb-0">
        <div>Artículo</div>
        <div>Descripción</div>
        <div>Cantidad</div>
        <div>Precio</div>
        <div>Importe</div>
        <div />
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-80 md:overflow-y-auto text-[11px] [&_label]:text-[11px] [&_input]:text-[11px] [&_input]:h-6 [&_[role=combobox]]:h-6 [&_textarea]:text-[11px] [&_textarea]:min-h-[24px]"
      >
        <ArrayInput source="detalles" label={false}>
          <SimpleFormIterator
            inline
            addButton={<DetalleFooterButtons />}
            disableClear
            disableReordering
            className="gap-0 [&_ul]:gap-0 [&_li]:pb-0 [&_li]:items-center [&_li]:gap-1 [&_.simple-form-iterator-item-actions]:!pt-0 [&_.simple-form-iterator-item-actions]:items-center [&_.simple-form-iterator-item-actions]:self-center [&_.simple-form-iterator-item-actions]:gap-0 [&_.simple-form-iterator-item-actions]:mt-0 [&_.simple-form-iterator-item-actions]:h-6 [&_.simple-form-iterator-item-actions]:-translate-y-[1px] [&_.simple-form-iterator-item-actions]:-ml-1 [&_.simple-form-iterator-item-actions>*]:-ml-2"
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
  const { setValue } = useFormContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;
  const hasDetalles = (detalles ?? []).length > 0;

  const handleClear = () => {
    setValue("detalles", [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="mt-1 flex w-full items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-[11px]"
          onClick={() => add()}
        >
          <PlusCircle className="h-4 w-4" />
          Agregar
        </Button>
        {hasDetalles ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-[11px] text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash className="h-4 w-4" />
            Limpiar
          </Button>
        ) : null}
        <div className="hidden sm:block ml-auto w-[28px]" />
        <div className="hidden sm:block w-[28px]" />
      </div>
      <Confirm
        isOpen={confirmOpen}
        title="Limpiar detalle"
        content="Se eliminarán todos los ítems. ¿Deseas continuar?"
        onConfirm={handleClear}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
};

const DetalleRow = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const [showOptional, setShowOptional] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <HiddenInput source="id" />
        <ReferenceInput
          source="articulo_id"
          reference="articulos"
          filter={articuloFilter}
        >
          <AutocompleteInput
            optionText="nombre"
            label={false}
            className="w-[240px] shrink-0 text-[11px] [&_[role=combobox]]:h-6 [&_[role=combobox]]:text-[11px] [&_[role=combobox]_span]:text-[11px]"
          />
        </ReferenceInput>
        <TextInput
          source="descripcion"
          label={false}
          className="w-[150px] shrink-0"
        />
      <NumberInput
        source="cantidad"
        label={false}
        inputMode="decimal"
        step="0.001"
        className="w-[56px] shrink-0 [&_input]:text-[9px]"
      />
      <NumberInput
        source="precio"
        label={false}
        inputMode="decimal"
        step="0.01"
        className="w-[72px] shrink-0 [&_input]:text-[9px]"
      />
        <CalculatedImporte />
        <HiddenInput source="importe" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 self-center"
          onClick={() => setShowOptional((v) => !v)}
          aria-label={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
          title={showOptional ? "Ocultar detalle" : "Mostrar detalle"}
        >
          {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      <DetalleOptionalFields showOptional={showOptional} />
    </div>
  );
};

const DetalleOptionalFields = ({ showOptional }: { showOptional: boolean }) => {
  return (
    <div className="w-full">
      {showOptional ? (
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
    <div className="flex flex-col w-[90px] shrink-0">
      <div className="flex h-6 items-center rounded-md border border-border bg-muted/30 px-2 text-[11px] font-medium">
        <NumberField
          source="importe"
          record={{ importe }}
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

