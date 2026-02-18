"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  type Identifier,
  required,
  useRecordContext,
  useWrappedSource,
} from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { Loading } from "@/components/loading";
import { NumberField } from "@/components/number-field";
import {
  CalculatedImporte,
  DetailFieldCell,
  FormErrorSummary,
  FORM_VALUE_READONLY_CLASS,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  FormOrderHeaderMenuActions,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  TotalCompute,
} from "@/components/forms/form_order";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { Confirm } from "@/components/confirm";

import {
  computeDetalleImporte,
  computePoOrderTotal,
  getPoOrderDetalleDefaults,
  isPoOrderLocked,
  poOrderSchema,
} from "./model";
import type { PoOrderFormValues } from "./model";
import {
  type PoOrderRecord,
  useAccionesCabeceraOrden,
  usePoOrderFormDefaults,
  usePoOrderDefaults,
  useSolicitanteCentroCostoSync,
  usePoOrderReadOnly,
} from "./form_hooks";
import {
  useCentroCostoOportunidadExclusion,
  useDetalleCentroCostoOportunidadExclusion,
  useTipoSolicitudChangeGuard,
} from "../shared/po-hooks";
import { FormGenerar } from "./form_generar";

const PoOrderDetailEditContext = createContext<{
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
} | null>(null);

const usePoOrderDetailEdit = () => useContext(PoOrderDetailEditContext);

// === Formulario principal ===
// Renderiza el formulario principal de Orden de compra.
export const PoOrderForm = () => {
  const { defaultValues, isLoadingDefaults } = usePoOrderFormDefaults();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoadingDefaults) {
    return <Loading delay={200} />;
  }

  return (
    <PoOrderDetailEditContext.Provider value={{ isEditing, setIsEditing }}>
      <SimpleForm<PoOrderFormValues>
        className="w-full max-w-3xl"
        // ra-core FormProps types resolver as Resolver<FieldValues>
        resolver={zodResolver(poOrderSchema) as any}
        toolbar={<OrdenCompraToolbar />}
        defaultValues={defaultValues}
      >
        <OrdenCompraContenido />
      </SimpleForm>
    </PoOrderDetailEditContext.Provider>
  );
};

// Barra de acciones del formulario de Orden de compra.
const OrdenCompraToolbar = () => {
  const record = useRecordContext<PoOrderRecord>();
  const isLocked = isPoOrderLocked(record?.order_status?.nombre);
  const editContext = usePoOrderDetailEdit();
  const disableGenerar = editContext?.isEditing ?? false;
  const isReadOnly = usePoOrderReadOnly();

  return (
    <div className="flex w-full items-center justify-end gap-2">
      <FormOrderCancelButton />
      <FormOrderSaveButton variant="secondary" disabled={isLocked || isReadOnly} />
      {!isLocked ? <FormGenerar disabled={disableGenerar} /> : null}
    </div>
  );
};

// Contenido principal del formulario (cabecera, detalle y totales).
const OrdenCompraContenido = () => {
  usePoOrderDefaults();
  useCentroCostoOportunidadExclusion();
  useDetalleCentroCostoOportunidadExclusion();
  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =
    useTipoSolicitudChangeGuard();

  return (
    <>
      <FormErrorSummary />

      <CabeceraOrdenCompra />

      <DetalleOrdenCompra articuloFilter={articuloFilter} />

      <ResumenTotalesOrdenCompra />

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

// === Seccion cabecera ===
// Seccion de cabecera con campos principales y opcionales.
const CabeceraOrdenCompra = () => {
  const {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
    isLocked,
  } = useAccionesCabeceraOrden();
  const isReadOnly = usePoOrderReadOnly();
  const accionesMenu =
    canPreview || canDelete ? (
      <FormOrderHeaderMenuActions
        canPreview={canPreview}
        canDelete={canDelete}
        onPreview={onPreview}
        onDelete={onRequestDelete}
      />
    ) : null;

  return (
    <>
    <SectionBaseTemplate
      title="Cabecera"
      readOnly={isReadOnly}
      main={
        <>
          <CabeceraCamposPrincipales />
            {/* Always compute total for validation/payload */}
            <TotalCompute computeTotal={computePoOrderTotal} />
            <HiddenInput source="total" />
            <HiddenInput source="tipo_compra" />
            <HiddenInput source="order_status_id" />
            <HiddenInput source="departamento_id" />
          </>
        }
        actions={accionesMenu}
        optional={<CabeceraCamposOpcionales />}
      />
      {!isLocked ? (
        <Confirm
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Eliminar registro"
          content="Seguro que deseas eliminar este registro?"
          confirmColor="warning"
          loading={deleting}
        />
      ) : null}
    </>
  );
};

// Campos principales de la cabecera de Orden de compra.
const CabeceraCamposPrincipales = () => {
  const record = useRecordContext<PoOrderFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const { handleSolicitanteChange } = useSolicitanteCentroCostoSync();
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <FormText
          source="titulo"
          label="Titulo"
          validate={required()}
          autoFocus={isCreate}
          widthClass="w-full md:w-[220px]"
        />
        <FormReferenceAutocomplete
          referenceProps={{ source: "solicitante_id", reference: "users" }}
          inputProps={{
            optionText: "nombre",
            label: "Solicitante",
            validate: required(),
            onSelectionChange: handleSolicitanteChange,
          }}
          widthClass="w-full md:w-[200px]"
        />
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
      </div>
    </div>
  );
};

// Campos opcionales de la cabecera con panel secundario.
const CabeceraCamposOpcionales = () => {
  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-4">
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
          <FormDate
            source="fecha_necesidad"
            label="Fecha necesidad"
            widthClass="w-full"
          />
          <FormTextarea
            source="comentario"
            label="Comentario"
            widthClass="w-full"
            className="md:col-span-4 [&_textarea]:min-h-[64px]"
          />
        </div>
      </div>
    </div>
  );
};

// === Seccion detalle ===
// Seccion de detalle con lineas y campos opcionales.
const DetalleOrdenCompra = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const editContext = usePoOrderDetailEdit();
  const handleActiveRowChange = useMemo(
    () => (index: number | null) => {
      editContext?.setIsEditing(index != null);
    },
    [editContext],
  );
  const isReadOnly = usePoOrderReadOnly();

  const columns: SectionDetailColumn[] = [
    { label: "Articulo", width: "220px", mobileSpan: "full" },
    { label: "Descripcion", width: "150px" },
    { label: "Cantidad", width: "64px", className: "-ml-[15px]" },
    { label: "Precio", width: "84px", className: "ml-[0px]" },
    { label: "Importe", width: "84px", className: "ml-[30px]" },
    { label: "", width: "28px" },
  ];

  // Campos principales del detalle.
  const DetalleCamposPrincipales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => {
      const descripcionSource = useWrappedSource("descripcion");
      const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
      const hasDescripcion = Boolean(descripcion?.trim());

      return (
        <>
          <DetailFieldCell
            label="Articulo"
            data-articulo-field="true"
            data-focus-field="true"
          >
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
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </DetailFieldCell>
          <DetailFieldCell
            label="Descripcion"
            className={cn(!hasDescripcion && "hidden sm:flex")}
          >
            <FormText
              source="descripcion"
              label={false}
              widthClass="w-full"
              readOnly={!isActive}
              className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Cant.">
            <FormNumber
              source="cantidad"
              label={false}
              inputMode="decimal"
              step="0.001"
              widthClass="w-full"
              validate={required()}
              readOnly={!isActive}
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Precio">
            <FormNumber
              source="precio"
              label={false}
              inputMode="decimal"
              step="0.01"
              widthClass="w-full"
              readOnly={!isActive}
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Importe">
            <CalculatedImporte
              computeImporte={computeDetalleImporte}
              widthClass="w-full"
              valueClassName={
                !isActive
                  ? FORM_VALUE_READONLY_CLASS
                  : undefined
              }
            />
            <HiddenInput source="importe" />
          </DetailFieldCell>
        </>
      );
    },
    [articuloFilter],
  );

  // Campos opcionales del detalle.
  const DetalleCamposOpcionales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <div className="w-full">
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 md:grid-cols-[210px_210px] md:justify-start">
            <ReferenceInput
              source="centro_costo_id"
              reference="centros-costo"
            >
              <FormSelect
                optionText="nombre"
                label="Centro de costo"
                widthClass="w-full sm:w-[210px]"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
            <ReferenceInput
              source="oportunidad_id"
              reference="crm/oportunidades"
            >
              <FormSelect
                optionText="titulo"
                label="Oportunidad"
                widthClass="w-full sm:w-[210px]"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
          </div>
        </div>
      </div>
    ),
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Detalle"
      mainColumns={columns}
      mainFields={DetalleCamposPrincipales}
      optionalFields={DetalleCamposOpcionales}
      defaults={getPoOrderDetalleDefaults}
      maxHeightClassName="md:max-h-48"
      onActiveRowChange={handleActiveRowChange}
      readOnly={isReadOnly}
    />
  );
};

// Resumen de totales al pie del formulario.
const ResumenTotalesOrdenCompra = () => {
  const total = useWatch({ name: "total" }) as number | undefined;
  const totalValue = Number(total ?? 0);

  return (
    <div className="flex flex-row flex-nowrap items-center justify-start gap-2 rounded-md border border-muted/60 bg-muted/30 px-2 py-1 text-[8px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]">
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
