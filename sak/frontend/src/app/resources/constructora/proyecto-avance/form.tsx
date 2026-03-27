"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
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

export const ProyectoAvanceForm = () => (
  <SimpleForm<ProyectoAvanceFormValues>
    className="w-full max-w-3xl"
    resolver={zodResolver(proyectoAvanceSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROYECTO_AVANCE_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Certificado"
      main={<ProyectoAvanceMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
