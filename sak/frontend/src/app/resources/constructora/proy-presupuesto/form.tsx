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
  FormNumber,
  FormQuincenaDate,
  FormReferenceAutocomplete,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  PROY_PRESUPUESTO_DEFAULT,
  proyPresupuestoSchema,
  type ProyPresupuestoFormValues,
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

const PresupuestoCabeceraFields = () => (
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
      <FormQuincenaDate
        source="fecha"
        label="Quincena"
        validate={required()}
        widthClass="w-full"
      />
    </div>
    <FormTextarea
      source="descripcion"
      label="Descripcion"
      widthClass="w-full"
      className="[&_textarea]:w-full"
    />
  </div>
);

const PresupuestoCostoTotal = () => {
  const [moPropia, moTerceros, materiales, herramientas] = useWatch({
    name: ["mo_propia", "mo_terceros", "materiales", "herramientas"],
  }) as [unknown, unknown, unknown, unknown];

  const costoTotal =
    toNumber(moPropia) +
    toNumber(moTerceros) +
    toNumber(materiales) +
    toNumber(herramientas);

  return (
    <FormValue
      label="Costo total"
      widthClass="w-full"
      valueClassName="justify-end bg-primary/5 font-semibold text-foreground"
    >
      <NumberField
        source="costo_total"
        record={{ costo_total: costoTotal }}
        options={{ style: "currency", currency: "ARS" }}
        className="tabular-nums"
      />
    </FormValue>
  );
};

const PresupuestoNeto = () => {
  const [moPropia, moTerceros, materiales, herramientas, importe] = useWatch({
    name: ["mo_propia", "mo_terceros", "materiales", "herramientas", "importe"],
  }) as [unknown, unknown, unknown, unknown, unknown];

  const costoTotal =
    toNumber(moPropia) +
    toNumber(moTerceros) +
    toNumber(materiales) +
    toNumber(herramientas);
  const presupuestoNeto = toNumber(importe) - costoTotal;

  return (
    <FormValue
      label="Presupuesto neto"
      widthClass="w-full"
      valueClassName="justify-end bg-primary/5 font-semibold text-foreground"
    >
      <NumberField
        source="presupuesto_neto"
        record={{ presupuesto_neto: presupuestoNeto }}
        options={{ style: "currency", currency: "ARS" }}
        className="tabular-nums"
      />
    </FormValue>
  );
};

const PresupuestoCostosFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
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
      source="herramientas"
      label="Herramientas"
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
    <div className="md:col-start-4">
      <PresupuestoCostoTotal />
    </div>
  </div>
);

const PresupuestoIngresosFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
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
    <div className="md:col-start-4">
      <PresupuestoNeto />
    </div>
  </div>
);

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
        title="Cabecera"
        main={<PresupuestoCabeceraFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Costos"
        main={<PresupuestoCostosFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Ingresos"
        main={<PresupuestoIngresosFields />}
        defaultOpen
      />
    </SimpleForm>
  );
};
