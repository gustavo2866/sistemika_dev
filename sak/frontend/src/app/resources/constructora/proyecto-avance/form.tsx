"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  PROYECTO_AVANCE_DEFAULTS,
  proyectoAvanceSchema,
  type ProyectoAvanceFormValues,
} from "./model";

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const ProyectoAvanceMainFields = () => (
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
      source="fecha_registracion"
      label="Fecha"
      validate={required()}
      widthClass="w-full"
    />
    <FormNumber
      source="avance"
      label="Avance %"
      min={0}
      max={100}
      step="0.01"
      validate={required()}
      widthClass="w-full"
    />
    <FormNumber
      source="horas"
      label="Horas"
      min={0}
      step="1"
      validate={required()}
      widthClass="w-full"
    />
    <FormNumber
      source="importe"
      label="Importe"
      min={0}
      step="0.01"
      validate={required()}
      widthClass="w-full"
    />
    <div className="md:col-span-2">
      <FormTextarea
        source="comentario"
        label="Comentario"
        rows={4}
        widthClass="w-full"
      />
    </div>
  </div>
);

export const ProyectoAvanceForm = () => {
  const record = useRecordContext<ProyectoAvanceFormValues & { id?: number | string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const proyectoIdFromQuery = parseNumericParam(params.get("proyecto_id"));

  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            ...PROYECTO_AVANCE_DEFAULTS,
            proyecto_id: proyectoIdFromQuery ?? PROYECTO_AVANCE_DEFAULTS.proyecto_id,
          },
    [proyectoIdFromQuery, record?.id],
  );

  return (
    <SimpleForm<ProyectoAvanceFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(proyectoAvanceSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <SectionBaseTemplate
        title="Certificado"
        main={<ProyectoAvanceMainFields />}
        defaultOpen
      />
    </SimpleForm>
  );
};
