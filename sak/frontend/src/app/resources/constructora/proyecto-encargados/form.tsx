"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormDate,
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  PROYECTO_ENCARGADO_DEFAULT,
  proyectoEncargadoSchema,
  type ProyectoEncargadoFormValues,
} from "./model";

const ProyectoEncargadoFields = () => (
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
    <FormReferenceAutocomplete
      referenceProps={{ source: "contacto_id", reference: "crm/contactos" }}
      inputProps={{
        optionText: "nombre_completo",
        label: "Contacto",
        validate: required(),
      }}
      widthClass="w-full"
    />
    <FormDate source="desde" label="Desde" widthClass="w-full" />
    <FormDate source="hasta" label="Hasta" widthClass="w-full" />
    <FormBoolean source="principal" label="Principal" />
    <FormBoolean source="activo" label="Activo" defaultValue />
    <FormTextarea
      source="notas"
      label="Notas"
      rows={3}
      widthClass="w-full"
      className="md:col-span-2 [&_textarea]:min-h-[72px]"
    />
  </div>
);

export const ProyectoEncargadoForm = () => (
  <SimpleForm<ProyectoEncargadoFormValues>
    className="w-full max-w-3xl"
    resolver={zodResolver(proyectoEncargadoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROYECTO_ENCARGADO_DEFAULT}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Encargado de proyecto"
      main={<ProyectoEncargadoFields />}
      defaultOpen
    />
  </SimpleForm>
);
