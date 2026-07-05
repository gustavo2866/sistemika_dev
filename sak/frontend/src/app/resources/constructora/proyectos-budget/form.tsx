"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { useWatch } from "react-hook-form";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { NumberField } from "@/components/number-field";
import { SimpleForm } from "@/components/simple-form";

import {
  PROYECTOS_BUDGET_DEFAULT,
  proyectosBudgetSchema,
  type ProyectosBudgetFormValues,
} from "./model";

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const toNumber = (value: unknown) => {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
};

const BudgetCabeceraFields = () => (
  <div className="grid gap-2">
    <div className="grid gap-2 md:grid-cols-2">
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
      <FormReferenceAutocomplete
        referenceProps={{
          source: "proyectos_concepto_id",
          reference: "constructora/proyectos-conceptos",
          filter: { activo: true },
        }}
        inputProps={{
          optionText: "nombre",
          label: "Concepto",
          validate: required(),
        }}
        widthClass="w-full"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "proyectos_macrorubro_id",
          reference: "constructora/proyectos-macrorubros",
          filter: { activo: true },
        }}
        inputProps={{
          optionText: "nombre",
          label: "Macrorubro",
          validate: required(),
        }}
        widthClass="w-full"
      />
    </div>
    <FormTextarea
      source="descripcion"
      label="Descripcion"
      widthClass="w-full"
      className="[&_textarea]:w-full"
      maxLength={500}
    />
  </div>
);

const BudgetLaborTotal = () => {
  const [horas, valorHora] = useWatch({
    name: ["horas", "valor_hora"],
  }) as [unknown, unknown];
  const total = toNumber(horas) * toNumber(valorHora);

  return (
    <FormValue
      label="Horas x valor"
      widthClass="w-full"
      valueClassName="justify-end bg-primary/5 font-semibold text-foreground"
    >
      <NumberField
        source="total_mano_obra"
        record={{ total_mano_obra: total }}
        options={{ style: "currency", currency: "ARS" }}
        className="tabular-nums"
      />
    </FormValue>
  );
};

const BudgetImporteFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormNumber
      source="importe"
      label="Importe"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="horas"
      label="Horas"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="empleados"
      label="Empleados"
      min={0}
      step="1"
      widthClass="w-full"
    />
    <FormNumber
      source="valor_hora"
      label="Valor hora"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <div className="md:col-start-4">
      <BudgetLaborTotal />
    </div>
  </div>
);

export const ProyectosBudgetForm = () => {
  const record = useRecordContext<ProyectosBudgetFormValues & { id?: number | string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const proyectoIdFromQuery = parseNumericParam(params.get("proyecto_id"));

  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            ...PROYECTOS_BUDGET_DEFAULT,
            proyecto_id: proyectoIdFromQuery ?? PROYECTOS_BUDGET_DEFAULT.proyecto_id,
          },
    [proyectoIdFromQuery, record?.id],
  );

  return (
    <SimpleForm<ProyectosBudgetFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(proyectosBudgetSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <SectionBaseTemplate
        title="Cabecera"
        main={<BudgetCabeceraFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Valores"
        main={<BudgetImporteFields />}
        defaultOpen
      />
    </SimpleForm>
  );
};
