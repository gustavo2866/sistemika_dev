"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { required, useWrappedSource } from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { Loading } from "@/components/loading";
import { NumberField } from "@/components/number-field";
import {
  DetailFieldCell,
  FormErrorSummary,
  FORM_FIELD_READONLY_CLASS,
  FORM_VALUE_READONLY_CLASS,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  FormOrderHeaderMenuActions,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
} from "@/components/forms/form_order";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { Confirm } from "@/components/confirm";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import {
  computeDetalleImporte,
  getPoInvoiceDetalleDefaults,
  getPoInvoiceTaxDefaults,
  mapPoOrderDetailToInvoiceDetail,
  mergeInvoiceDetails,
  poInvoiceSchema,
} from "./model";
import type { PoInvoiceFormValues, PoOrderDetailRaw } from "./model";
import {
  useAccionesCabeceraFactura,
  usePoInvoiceDefaults,
  usePoInvoiceFormDefaults,
  usePoInvoiceReadOnly,
  useResponsableCentroCostoSync,
  usePoInvoiceTotals,
} from "./form_hooks";
import { FormConfirmarButton } from "./form_confirmar";
import {
  useCentroCostoOportunidadExclusion,
  useDetalleCentroCostoOportunidadExclusion,
  useOcIdByPoOrderDetailId,
} from "../shared/po-hooks";
import { PoOrderLoadDialog } from "../shared/po-order-load-dialog";

// === Formulario principal ===
// Renderiza el formulario principal de Factura OC.
export const PoInvoiceForm = () => {
  const { defaultValues, isLoadingDefaults } = usePoInvoiceFormDefaults();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoadingDefaults) {
    return <Loading delay={200} />;
  }

  return (
    <PoInvoiceDetailEditContext.Provider value={{ isEditing, setIsEditing }}>
      <SimpleForm<PoInvoiceFormValues>
        className="w-full max-w-3xl"
        resolver={zodResolver(poInvoiceSchema) as any}
        toolbar={<FacturaToolbar />}
        defaultValues={defaultValues}
      >
        <FacturaContenido />
      </SimpleForm>
    </PoInvoiceDetailEditContext.Provider>
  );
};

// Barra de acciones del formulario de factura.
const FacturaToolbar = () => {
  const editContext = usePoInvoiceDetailEdit();
  const isDetailEditing = editContext?.isEditing ?? false;
  const isReadOnly = usePoInvoiceReadOnly();

  return (
    <div className="flex w-full items-center justify-end gap-2">
      <FormOrderCancelButton />
      <FormOrderSaveButton
        variant="secondary"
        disabled={isDetailEditing || isReadOnly}
      />
      <FormConfirmarButton disabled={isDetailEditing || isReadOnly} />
    </div>
  );
};

// Contenido principal del formulario (cabecera, detalle e impuestos).
const FacturaContenido = () => {
  usePoInvoiceDefaults();
  usePoInvoiceTotals();
  useCentroCostoOportunidadExclusion();
  useDetalleCentroCostoOportunidadExclusion();

  return (
    <>
      <FormErrorSummary />

      <CabeceraFactura />

      <DetalleFactura />

      <ImpuestosFactura />

      <ResumenTotalesFactura />
    </>
  );
};

// === Seccion cabecera ===
// Seccion de cabecera con campos principales y opcionales.
const CabeceraFactura = () => {
  const {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
  } = useAccionesCabeceraFactura();

  const isReadOnly = usePoInvoiceReadOnly();
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
            <HiddenInput source="subtotal" />
            <HiddenInput source="total_impuestos" />
            <HiddenInput source="total" />
            <HiddenInput source="invoice_status_id" />
            <HiddenInput source="invoice_status_fin_id" />
          </>
        }
        actions={accionesMenu}
        optional={<CabeceraCamposOpcionales />}
      />
      {canDelete ? (
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

// Campos principales de la cabecera de factura.
const CabeceraCamposPrincipales = () => {
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
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
          widthClass="w-full md:w-[200px]"
        />
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
          widthClass="w-full md:w-[220px]"
        />
      </div>
    </div>
  );
};

// Campos opcionales de la cabecera de factura.
const CabeceraCamposOpcionales = () => (
  <div className="mt-1 space-y-0">
    <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
      <CabeceraCamposOpcionalesFields />
    </div>
  </div>
);

const CabeceraCamposOpcionalesFields = () => {
  const { handleResponsableChange } = useResponsableCentroCostoSync();

  return (
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
      <FormReferenceAutocomplete
        referenceProps={{
          source: "usuario_responsable_id",
          reference: "users",
        }}
        inputProps={{
          optionText: "nombre",
          label: "Responsable",
          validate: required(),
          onSelectionChange: handleResponsableChange,
        }}
        widthClass="w-full"
      />
      <ReferenceInput source="metodo_pago_id" reference="metodos-pago">
        <FormSelect
          optionText="nombre"
          label="Metodo de pago"
          widthClass="w-full"
        />
      </ReferenceInput>
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
  );
};

// === Seccion detalle ===
// Seccion de detalle con articulos.
const DetalleFactura = () => {
  const { getValues, setValue } = useFormContext<PoInvoiceFormValues>();
  const proveedorId = useWatch({ name: "proveedor_id" }) as number | undefined;
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const editContext = usePoInvoiceDetailEdit();
  const isReadOnly = usePoInvoiceReadOnly();
  const handleActiveRowChange = useMemo(
    () => (index: number | null) => {
      editContext?.setIsEditing(index != null);
    },
    [editContext],
  );

  const columns: SectionDetailColumn[] = [
    { label: "Articulo", width: "180px", mobileSpan: "full" },
    { label: "Descripcion", width: "150px", mobileSpan: "full" },
    { label: "Cantidad", width: "64px", mobileSpan: 1, className: "-ml-[15px]" },
    { label: "Precio", width: "84px", mobileSpan: 1, className: "ml-[0px]" },
    { label: "Importe", width: "60px", mobileSpan: 1, className: "ml-[30px]" },
    { label: "OC", width: "60px", mobileSpan: 1, className: "text-center" },
    { label: "", width: "28px" },
  ];

  // Campos principales del detalle de factura.
  const DetalleCamposPrincipales = ({ isActive }: SectionDetailFieldsProps) => {
      const descripcionSource = useWrappedSource("descripcion");
      const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
      const hasDescripcion = Boolean(descripcion?.trim());

      return (
        <>
          <DetailFieldCell label="Articulo" data-focus-field="true">
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
              source="precio_unitario"
              label={false}
              inputMode="decimal"
              step="0.01"
              widthClass="w-full"
              validate={required()}
              readOnly={!isActive}
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Importe">
            <CalculatedImporteDetalle
              widthClass="w-full"
              valueClassName={!isActive ? FORM_VALUE_READONLY_CLASS : undefined}
            />
            <HiddenInput source="importe" />
          </DetailFieldCell>
          <DetailFieldCell label="OC" className="items-center text-center">
            <DetalleOrdenId />
          </DetailFieldCell>
        </>
      );
  };

  // Campos opcionales del detalle de factura.
  const DetalleCamposOpcionales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <div className="w-full">
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 md:grid-cols-2 md:justify-start">
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
      </div>
    ),
    [],
  );

  const handleLoadOrders = useCallback(
    (details: PoOrderDetailRaw[]) => {
      const existing = (getValues("detalles") as PoInvoiceFormValues["detalles"]) ?? [];
      const mapped = details.map((detalle) =>
        mapPoOrderDetailToInvoiceDetail(detalle),
      );
      const merged = mergeInvoiceDetails(existing, mapped);
      setValue("detalles", merged, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  const isLoadDisabled = proveedorId == null;

  return (
    <>
      <SectionDetailTemplate2
        title="Detalle"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        optionalFields={DetalleCamposOpcionales}
        defaults={getPoInvoiceDetalleDefaults}
        maxHeightClassName="md:max-h-48"
        onActiveRowChange={handleActiveRowChange}
        readOnly={isReadOnly}
        actions={
          <DropdownMenuItem
            onSelect={() => {
              if (isLoadDisabled) return;
              setLoadDialogOpen(true);
            }}
            disabled={isLoadDisabled || isReadOnly}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Download className="h-3 w-3" />
            Cargar OC
          </DropdownMenuItem>
        }
      />
      <PoOrderLoadDialog
        proveedorId={proveedorId}
        onConfirm={handleLoadOrders}
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        showTrigger={false}
        disabled={isLoadDisabled}
      />
    </>
  );
};

const PoInvoiceDetailEditContext = createContext<{
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
} | null>(null);

const usePoInvoiceDetailEdit = () => useContext(PoInvoiceDetailEditContext);

// === Seccion impuestos ===
// Seccion de impuestos y conceptos adicionales.
const ImpuestosFactura = () => {
  const isReadOnly = usePoInvoiceReadOnly();
  const columns: SectionDetailColumn[] = [
    { label: "Concepto", width: "180px" },
    { label: "Descripcion", width: "200px" },
    { label: "Importe", width: "84px" },
    { label: "", width: "28px" },
  ];

  // Campos principales de impuestos.
  const ImpuestoCamposPrincipales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <>
        <DetailFieldCell label="Concepto" data-focus-field="true">
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
        </DetailFieldCell>
        <DetailFieldCell label="Descripcion" desktopOnly>
          <FormText
            source="descripcion"
            label={false}
            widthClass="w-full"
            readOnly={!isActive}
            className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Importe">
          <FormNumber
            source="importe"
            label={false}
            inputMode="decimal"
            step="0.01"
            widthClass="w-full"
            readOnly={!isActive}
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
          />
        </DetailFieldCell>
      </>
    ),
    [],
  );

  // Campos opcionales de impuestos.
  const ImpuestoCamposOpcionales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <div className="w-full">
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
      </div>
    ),
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Impuestos"
      detailsSource="taxes"
      defaultOpen={false}
      mainColumns={columns}
      mainFields={ImpuestoCamposPrincipales}
      optionalFields={ImpuestoCamposOpcionales}
      defaults={getPoInvoiceTaxDefaults}
      maxHeightClassName="md:max-h-48"
      readOnly={isReadOnly}
    />
  );
};

// === Resumen ===
// Resumen de totales al pie del formulario.
const ResumenTotalesFactura = () => {
  const subtotal = useWatch({ name: "subtotal" }) as number | undefined;
  const totalImpuestos = useWatch({ name: "total_impuestos" }) as number | undefined;
  const total = useWatch({ name: "total" }) as number | undefined;

  const subtotalValue = Number(subtotal ?? 0);
  const impuestosValue = Number(totalImpuestos ?? 0);
  const totalValue = Number(total ?? 0);

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

// === Helpers ===
// Calcula el importe de la linea usando cantidad y precio_unitario.
const CalculatedImporteDetalle = ({
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
      widthClass={widthClass ?? "w-[64px] sm:w-[84px] shrink-0"}
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

// Muestra el numero de OC asociado al detalle (solo lectura).
const DetalleOrdenId = () => {
  const detailIdSource = useWrappedSource("poOrderDetail_id");
  const detailId = useWatch({ name: detailIdSource }) as
    | number
    | string
    | undefined;
  const orderId = useOcIdByPoOrderDetailId(detailId);

  if (orderId == null || String(orderId).trim() === "") return null;

  return (
    <div className="text-[9px] text-muted-foreground leading-none">
      {String(orderId)}
    </div>
  );
};
