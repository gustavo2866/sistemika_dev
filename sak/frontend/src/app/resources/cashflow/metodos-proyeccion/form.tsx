"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetList } from "ra-core";
import { useFormContext } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";

import { Confirm } from "@/components/confirm";
import { FormOrderToolbar } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormBoolean,
  FormErrorSummary,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailTemplate2,
  type SectionDetailColumn,
  type SectionDetailFieldsProps,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FUNCION_PROYECCION_CHOICES,
  METODO_PROYECCION_DEFAULTS,
  getMetodoProyeccionCuentaDefaults,
  getMetodoProyeccionDetalleDefaults,
  metodoProyeccionSchema,
  type MetodoProyeccionFormValues,
} from "./model";

const detalleColumns: SectionDetailColumn[] = [
  { label: "Mes destino", width: "100px" },
  { label: "Base desde", width: "100px" },
  { label: "Base hasta", width: "100px" },
  { label: "Función", width: "150px", mobileSpan: "full" },
  { label: "Factor", width: "100px" },
  { label: "", width: "minmax(64px,1fr)" },
];

const cuentaColumns: SectionDetailColumn[] = [
  { label: "Cuenta ERP", width: "minmax(260px,1fr)", mobileSpan: "full" },
  { label: "Activo", width: "100px" },
  { label: "", width: "minmax(64px,1fr)" },
];

type ErpCuentaRecord = {
  id: number | string;
  nro_cuenta?: number | string | null;
  descripcion?: string | null;
};

type ErpCuentaChoice = {
  id: number;
  name: string;
};

const ErpCuentaChoicesContext = createContext<{
  choices: ErpCuentaChoice[];
  isPending: boolean;
}>({ choices: [], isPending: false });

const getDefaultYearDetails = () =>
  Array.from({ length: 12 }, (_, index) => ({
    mes_destino: index + 1,
    mes_base_desde: -1,
    mes_base_hasta: -1,
    funcion: "ULTIMO" as const,
    factor: 1,
  }));

const GenerateDefaultDetailsButton = ({ disabled }: { disabled: boolean }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { setValue } = useFormContext<MetodoProyeccionFormValues>();

  const handleConfirm = () => {
    setValue("detalles", getDefaultYearDetails(), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConfirmOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
      >
        Generar default
      </Button>
      <Confirm
        isOpen={confirmOpen}
        title="Generar configuración por defecto"
        content="Se eliminará la configuración actual y se generarán los doce meses. ¿Deseas continuar?"
        confirmColor="warning"
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
};

const MetodoProyeccionDetalleFields = ({ isActive }: SectionDetailFieldsProps) => (
  <>
    <HiddenInput source="version" />
    <DetailFieldCell label="Mes destino" data-focus-field="true">
      <FormNumber
        source="mes_destino"
        label={false}
        min={1}
        max={12}
        step={1}
        validate={required()}
        widthClass="w-full"
        readOnly={!isActive}
        className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Base desde">
      <FormNumber
        source="mes_base_desde"
        label={false}
        step={1}
        validate={required()}
        widthClass="w-full"
        readOnly={!isActive}
        className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Base hasta">
      <FormNumber
        source="mes_base_hasta"
        label={false}
        step={1}
        validate={required()}
        widthClass="w-full"
        readOnly={!isActive}
        className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Función">
      <FormSelect
        source="funcion"
        label={false}
        choices={FUNCION_PROYECCION_CHOICES}
        emptyText="Sin función"
        widthClass="w-full"
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Factor">
      <FormNumber
        source="factor"
        label={false}
        step={0.0001}
        validate={required()}
        widthClass="w-full"
        readOnly={!isActive}
        className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
      />
    </DetailFieldCell>
  </>
);

const MetodoProyeccionCuentaFields = ({ isActive }: SectionDetailFieldsProps) => {
  const { choices, isPending } = useContext(ErpCuentaChoicesContext);

  return (
    <>
      <HiddenInput source="version" />
      <DetailFieldCell label="Cuenta ERP" data-focus-field="true">
        <FormSelect
          source="nro_cuenta"
          label={false}
          choices={choices}
          emptyText="Seleccionar cuenta"
          validate={required()}
          isPending={isPending}
          widthClass="w-full"
          disableClear
          className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Activo">
        <FormBoolean
          source="activo"
          label={false}
          defaultValue
          className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
        />
      </DetailFieldCell>
    </>
  );
};

export const MetodoProyeccionForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof routeReturnTo === "string" ? routeReturnTo : undefined;
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);
  const [activeCuentaIndex, setActiveCuentaIndex] = useState<number | null>(null);
  const handleActiveRowChange = useCallback(
    (index: number | null) => setActiveDetailIndex(index),
    [],
  );
  const handleActiveCuentaRowChange = useCallback(
    (index: number | null) => setActiveCuentaIndex(index),
    [],
  );
  const { data: erpCuentas = [], isPending: isPendingErpCuentas } =
    useGetList<ErpCuentaRecord>("erp/cuentas", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "nro_cuenta", order: "ASC" },
      filter: {},
    });
  const erpCuentaChoices = useMemo<ErpCuentaChoice[]>(
    () =>
      erpCuentas.flatMap((cuenta) => {
        if (cuenta.nro_cuenta == null || cuenta.nro_cuenta === "") return [];
        const nroCuenta = Number(cuenta.nro_cuenta);
        if (!Number.isFinite(nroCuenta)) return [];
        const descripcion = String(cuenta.descripcion ?? "").trim();
        return [
          {
            id: nroCuenta,
            name: descripcion ? `${nroCuenta} — ${descripcion}` : String(nroCuenta),
          },
        ];
      }),
    [erpCuentas],
  );

  return (
    <ErpCuentaChoicesContext.Provider
      value={{ choices: erpCuentaChoices, isPending: isPendingErpCuentas }}
    >
      <SimpleForm<MetodoProyeccionFormValues>
        className="w-full max-w-4xl"
        resolver={zodResolver(metodoProyeccionSchema) as any}
        toolbar={
          <FormOrderToolbar
            cancelProps={returnTo ? { onClick: () => navigate(returnTo) } : undefined}
            saveProps={{ disabled: activeDetailIndex != null || activeCuentaIndex != null }}
          />
        }
        defaultValues={METODO_PROYECCION_DEFAULTS}
      >
        <FormErrorSummary />
        <SectionBaseTemplate
          title="Método de proyección"
          main={
            <div className="grid gap-2 md:grid-cols-2">
              <FormText
                source="nombre"
                label="Nombre"
                validate={required()}
                autoFocus
                widthClass="w-full"
                maxLength={200}
              />
              <div className="flex h-8 items-center md:self-end">
                <FormBoolean source="activo" label="Activo" defaultValue />
              </div>
              <FormTextarea
                source="descripcion"
                label="Descripción"
                widthClass="w-full md:col-span-2"
                maxLength={1000}
                rows={3}
              />
              <HiddenInput source="version" />
            </div>
          }
          defaultOpen
        />
        <SectionDetailTemplate2
          title="Reglas de cálculo"
          detailsSource="detalles"
          mainColumns={detalleColumns}
          mainFields={MetodoProyeccionDetalleFields}
          defaults={getMetodoProyeccionDetalleDefaults}
          defaultOpen={false}
          inlineActions={
            <GenerateDefaultDetailsButton disabled={activeDetailIndex != null} />
          }
          maxHeightClassName="md:max-h-80"
          onActiveRowChange={handleActiveRowChange}
          readOnly={activeCuentaIndex != null}
          showInfoAction={false}
          showDeleteWhenInactive
          saveOnlyWhenActive
          showExpandActionOnMobile
          addButtonLabel="Agregar regla"
          detailIteratorClassName="[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0"
        />
        <SectionDetailTemplate2
          title="Cuentas"
          detailsSource="cuentas"
          mainColumns={cuentaColumns}
          mainFields={MetodoProyeccionCuentaFields}
          defaults={getMetodoProyeccionCuentaDefaults}
          defaultOpen={false}
          maxHeightClassName="md:max-h-80"
          onActiveRowChange={handleActiveCuentaRowChange}
          readOnly={activeDetailIndex != null}
          showInfoAction={false}
          showDeleteWhenInactive
          saveOnlyWhenActive
          showExpandActionOnMobile
          addButtonLabel="Agregar cuenta"
          detailIteratorClassName="[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0"
        />
      </SimpleForm>
    </ErpCuentaChoicesContext.Provider>
  );
};
