"use client";

import { required } from "ra-core";

import { SimpleForm } from "@/components/simple-form";
import {
  FormBoolean,
  FormErrorSummary,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";

export const TipoPropiedadForm = () => (
  <SimpleForm className="w-full max-w-2xl" warnWhenUnsavedChanges>
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Cabecera"
      main={
        <div className="grid gap-2 md:grid-cols-3 md:items-end">
          <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-full" />
          <FormText source="descripcion" label="Descripcion" widthClass="w-full" />
          <FormBoolean source="activo" label="Activo" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);

