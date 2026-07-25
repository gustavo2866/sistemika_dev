"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation } from "react-router-dom";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";

import {
  ERP_PRESUPUESTO_DEFAULT,
  erpPresupuestoSchema,
  type ErpPresupuesto,
  type ErpPresupuestoFormValues,
} from "./model";

type ErpCuenta = {
  id: number | string;
  cod_cuenta?: string | null;
  descripcion?: string | null;
  rubro?: {
    id?: number | string;
    nombre?: string | null;
  } | null;
};

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const formatCuentaChoice = (cuenta?: ErpCuenta | null) =>
  [cuenta?.cod_cuenta, cuenta?.descripcion].filter(Boolean).join(" - ");

const RubroCuentaDefaults = () => {
  const record = useRecordContext<ErpPresupuesto>();
  const { getValues, setValue } = useFormContext<ErpPresupuestoFormValues>();
  const rubroId = record?.erp_cuenta?.rubro?.id;

  useEffect(() => {
    if (!rubroId || getValues("rubro_id")) return;
    setValue("rubro_id", Number(rubroId), { shouldDirty: false });
  }, [getValues, rubroId, setValue]);

  return null;
};

const RubroAutocomplete = () => {
  const { setValue } = useFormContext<ErpPresupuestoFormValues>();
  return (
    <FormReferenceAutocomplete
      referenceProps={{
        source: "rubro_id",
        reference: "erp/rubros",
        filter: { activo: true },
      }}
      inputProps={{
        optionText: "nombre",
        label: "Rubro",
        placeholder: "Selecciona un rubro",
        onSelectionChange: () => {
          setValue("erp_cuenta_id", undefined as unknown as number, {
            shouldDirty: true,
            shouldValidate: true,
          });
        },
      }}
      widthClass="w-full"
    />
  );
};

const CuentaAutocomplete = () => {
  const { control } = useFormContext<ErpPresupuestoFormValues>();
  const rubroValue = useWatch({ control, name: "rubro_id" });
  const rubroId = rubroValue ? Number(rubroValue) : undefined;
  const cuentaFilter = useMemo(
    () => ({
      activo: true,
      ...(rubroId ? { rubro_id: rubroId } : {}),
    }),
    [rubroId],
  );

  return (
    <FormReferenceAutocomplete
      referenceProps={{
        source: "erp_cuenta_id",
        reference: "erp/cuentas",
        filter: cuentaFilter,
      }}
      inputProps={{
        optionText: formatCuentaChoice,
        inputText: formatCuentaChoice,
        label: "Cuenta ERP",
        placeholder: rubroId ? "Selecciona una cuenta" : "Selecciona un rubro primero",
        validate: required(),
        disabled: !rubroId,
      }}
      widthClass="w-full"
    />
  );
};

const PresupuestoCabeceraFields = () => {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <RubroCuentaDefaults />
      <FormReferenceAutocomplete
        referenceProps={{ source: "proyecto_id", reference: "proyectos" }}
        inputProps={{
          optionText: "nombre",
          label: "Proyecto",
          validate: required(),
        }}
        widthClass="w-full"
      />
      <FormDate
        source="fecha"
        label="Fecha"
        validate={required()}
        widthClass="w-full"
      />
      <RubroAutocomplete />
      <CuentaAutocomplete />
    </div>
  );
};

const PresupuestoImporteFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormNumber
      source="ingres"
      label="Ingresos"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="egreso"
      label="Egresos"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="obreros_cantidad"
      label="Obreros"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="obreros_costo"
      label="Costo obreros"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
  </div>
);

export const ErpPresupuestoForm = () => {
  const record = useRecordContext<ErpPresupuestoFormValues & { id?: number | string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const proyectoIdFromQuery = parseNumericParam(params.get("proyecto_id"));
  const rubroIdFromQuery = parseNumericParam(params.get("rubro_id"));
  const erpCuentaIdFromQuery = parseNumericParam(params.get("erp_cuenta_id"));

  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            ...ERP_PRESUPUESTO_DEFAULT,
            proyecto_id: proyectoIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.proyecto_id,
            rubro_id: rubroIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.rubro_id,
            erp_cuenta_id: erpCuentaIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.erp_cuenta_id,
          },
    [erpCuentaIdFromQuery, proyectoIdFromQuery, record?.id, rubroIdFromQuery],
  );

  return (
    <SimpleForm<ErpPresupuestoFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(erpPresupuestoSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <SectionBaseTemplate
        title="Cabecera"
        main={<PresupuestoCabeceraFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Valores"
        main={<PresupuestoImporteFields />}
        defaultOpen
      />
    </SimpleForm>
  );
};
