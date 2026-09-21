"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  NOMINA_TAREA_DEFAULT,
  VALIDATION_RULES,
  nominaTareaSchema,
  type NominaTareaFormValues,
} from "./model";

const NominaTareaFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="codigo"
      label="Codigo"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.CODIGO.MAX_LENGTH}
    />
    <FormText
      source="descripcion"
      label="Descripcion"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
    />
    <div className="md:col-span-2">
      <FormBoolean source="activa" label="Activa" defaultValue />
    </div>
  </div>
);

export const NominaTareaForm = () => (
  <SimpleForm<NominaTareaFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(nominaTareaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={NOMINA_TAREA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la tarea"
      main={<NominaTareaFields />}
      defaultOpen
    />
  </SimpleForm>
);
