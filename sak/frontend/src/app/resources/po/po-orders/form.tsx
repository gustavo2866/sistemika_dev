"use client";

import { useEffect, useRef, useState } from "react";
import {
  required,
  useSimpleFormIteratorItem,
} from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  CalculatedImporte,
  DetalleDeleteButton,
  DetalleFooterButtons,
  DetalleHeaderActions,
  DetalleToggleButton,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionCard,
  TotalCompute,
} from "@/components/forms/form_order";
import { FormOrderToolbar } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";

import {
  computeDetalleImporte,
  computePoOrderTotal,
  poOrderSchema,
  TIPO_COMPRA_CHOICES,
} from "./model";
import type { PoOrderFormValues } from "./model";
import { usePoOrderDefaults, useTipoSolicitudChangeGuard } from "./form_hooks";

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

      <SectionCard
        title="Cabecera"
        isOpen={showHeader}
        onToggle={() => setShowHeader((v) => !v)}
        cardClassName="pt-2 pb-0"
        contentClassName="px-3 pt-0 pb-0"
        titleClassName="mb-2"
      >
        <div className="flex flex-col gap-0">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <FormText
              source="titulo"
              label="Titulo"
              validate={required()}
              widthClass="w-full md:w-[220px]"
            />
            <FormReferenceAutocomplete
              referenceProps={{ source: "solicitante_id", reference: "users" }}
              inputProps={{
                optionText: "nombre",
                label: "Solicitante",
                validate: required(),
              }}
              widthClass="w-full md:w-[200px]"
            />
            <div className="w-full md:w-[200px]">
              <ReferenceInput
                source="tipo_solicitud_id"
                reference="tipos-solicitud"
              >
                <FormSelect
                  optionText="nombre"
                  label="Tipo solicitud"
                  validate={required()}
                  widthClass="w-full"
                />
              </ReferenceInput>
            </div>
            <div className="relative w-full md:w-[200px]">
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "proveedor_id",
                  reference: "proveedores",
                }}
                inputProps={{
                  optionText: "nombre",
                  label: "Proveedor",
                }}
                widthClass="w-full"
              />
            </div>
          </div>
          <div className="w-full md:w-[220px] mb-0 pb-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-1 py-1 text-[9px] leading-none text-blue-600 hover:text-blue-700 -mb-1"
              onClick={() => setShowOptional((v) => !v)}
              aria-label={showOptional ? "Ocultar campos" : "Mostrar campos"}
              title={showOptional ? "Ocultar campos" : "Mostrar campos"}
            >
              {showOptional ? "menos datos" : "mas datos..."}
            </Button>
          </div>
        </div>

          {/* Always compute total for validation/payload, but only display it inside the toggle */}
          <TotalCompute computeTotal={computePoOrderTotal} />
          <HiddenInput source="total" />

          <OptionalHeaderFields showOptional={showOptional} />
      </SectionCard>

      <SectionCard
        title="Detalle"
        isOpen={showDetalle}
        onToggle={() => setShowDetalle((v) => !v)}
        cardClassName="pt-2"
        contentClassName="px-3 pt-0 pb-2"
        titleClassName="mb-0"
        headerActions={
          <DetalleHeaderActions
            showDetalle={showDetalle}
            setShowDetalle={setShowDetalle}
          />
        }
      >
        <DetalleScrollable articuloFilter={articuloFilter} />
      </SectionCard>

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
    <div className="mt-1 space-y-0">
      {showOptional ? (
        <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <FormDate
              source="fecha_necesidad"
              label="Fecha necesidad"
              widthClass="w-full"
            />
            <FormReferenceAutocomplete
              referenceProps={{
                source: "centro_costo_id",
                reference: "centros-costo",
              }}
              inputProps={{
                optionText: "nombre",
                label: "Centro de costo",
              }}
              widthClass="w-full"
            />
            <FormReferenceAutocomplete
              referenceProps={{
                source: "oportunidad_id",
                reference: "crm/oportunidades",
              }}
              inputProps={{
                optionText: "titulo",
                label: "Oportunidad",
              }}
              widthClass="w-full"
            />
            <ReferenceInput
              source="metodo_pago_id"
              reference="metodos-pago"
            >
              <FormSelect
                optionText="nombre"
                label="Metodo de pago"
                widthClass="w-full"
              />
            </ReferenceInput>
            <FormSelect
              source="tipo_compra"
              label="Tipo de compra"
              choices={TIPO_COMPRA_CHOICES as any}
              optionText="name"
              widthClass="w-full"
            />
            <FormTextarea
              source="comentario"
              label="Comentario"
              widthClass="w-full"
              className="sm:col-span-3 [&_textarea]:min-h-[64px]"
            />
          </div>
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
        className="w-full rounded-md border border-border p-2 md:max-h-80 md:overflow-y-auto"
      >
        <ArrayInput source="detalles" label={false}>
          <SimpleFormIterator
            inline
            addButton={<DetalleFooterButtonsWrapper />}
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

const DetalleRow = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const [showOptional, setShowOptional] = useState(false);
  const { remove } = useSimpleFormIteratorItem();

  return (
    <div className="flex w-full flex-col gap-0 rounded-md border border-border p-1 pb-0.5 pr-1 sm:pr-0 sm:border-0 sm:p-0">
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
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "articulo_id",
                  reference: "articulos",
                  filter: articuloFilter,
                }}
                inputProps={{
                  optionText: "nombre",
                  label: false,
                }}
                widthClass="w-full"
              />
            </div>
            <DetalleDeleteButton
              className="sm:hidden h-6 w-6 -mr-1"
              onClick={() => remove()}
            />
          </div>
        </div>
        <FormText
          source="descripcion"
          label={false}
          widthClass="w-full sm:w-[130px] shrink-0"
          className="hidden sm:block"
        />
        <div className="col-span-1 grid grid-cols-[1fr_20px] gap-1 sm:contents">
          <div className="grid grid-cols-[44px_70px_80px] gap-1 sm:flex sm:items-center sm:gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Cant.
              </div>
              <FormNumber
                source="cantidad"
                label={false}
                inputMode="decimal"
                step="0.001"
                widthClass="w-[44px] sm:w-[80px] shrink-0"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Precio
              </div>
              <FormNumber
                source="precio"
                label={false}
                inputMode="decimal"
                step="0.01"
                widthClass="w-[70px] sm:w-[84px] shrink-0"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                Importe
              </div>
              <CalculatedImporte
                computeImporte={computeDetalleImporte}
                widthClass="w-[80px] sm:w-[84px] shrink-0"
              />
              <HiddenInput source="importe" />
            </div>
          </div>
          <div className="flex items-end justify-end sm:hidden -mr-1">
          <DetalleToggleButton
            show={showOptional}
            onToggle={() => setShowOptional((v) => !v)}
            tabIndex={-1}
          />
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <DetalleToggleButton
            show={showOptional}
            onToggle={() => setShowOptional((v) => !v)}
            tabIndex={-1}
          />
          <DetalleDeleteButton
            onClick={() => remove()}
          />
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
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-3 md:grid-cols-2">
            <FormText
              source="descripcion"
              label="Descripcion"
              className="sm:hidden"
              widthClass="w-full"
            />
            <ReferenceInput
              source="centro_costo_id"
              reference="centros-costo"
            >
              <FormSelect
                optionText="nombre"
                label="Centro de costo"
                widthClass="w-full"
              />
            </ReferenceInput>
            <ReferenceInput
              source="oportunidad_id"
              reference="crm/oportunidades"
            >
              <FormSelect
                optionText="titulo"
                label="Oportunidad"
                widthClass="w-full"
              />
            </ReferenceInput>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DetalleFooterButtonsWrapper = () => (
  <DetalleFooterButtons />
);

