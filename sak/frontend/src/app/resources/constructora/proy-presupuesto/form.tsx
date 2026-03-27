"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { useWatch } from "react-hook-form";
import { NumberField } from "@/components/number-field";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  PROY_PRESUPUESTO_DEFAULT,
  computeProyPresupuestoTotal,
  proyPresupuestoSchema,
  type ProyPresupuestoFormValues,
} from "./model";

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const PresupuestoMainFields = () => (
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
    <FormNumber
      source="mo_propia"
      label="MO propia"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="mo_terceros"
      label="MO terceros"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="materiales"
      label="Materiales"
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
      source="metros"
      label="Metros"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="importe"
      label="Importe"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
  </div>
);

const PresupuestoResumen = () => {
  const importe = useWatch({ name: "importe" }) as number | undefined;
  const total = computeProyPresupuestoTotal({
    importe,
  });

  return (
    <div className="flex justify-end">
      <div className="rounded-md border border-muted/60 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="mr-2 font-medium">Importe:</span>
        <NumberField
          source="importe"
          record={{ importe: total }}
          options={{ style: "currency", currency: "ARS" }}
          className="font-semibold text-foreground"
        />
      </div>
    </div>
  );
};

export const ProyPresupuestoForm = () => {
  const record = useRecordContext<ProyPresupuestoFormValues & { id?: number | string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const proyectoIdFromQuery = parseNumericParam(params.get("proyecto_id"));

  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            ...PROY_PRESUPUESTO_DEFAULT,
            proyecto_id: proyectoIdFromQuery ?? PROY_PRESUPUESTO_DEFAULT.proyecto_id,
          },
    [proyectoIdFromQuery, record?.id],
  );

  return (
    <SimpleForm<ProyPresupuestoFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(proyPresupuestoSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <SectionBaseTemplate
        title="Presupuesto"
        main={<PresupuestoMainFields />}
        optional={<PresupuestoResumen />}
        defaultOpen
      />
    </SimpleForm>
  );
};
