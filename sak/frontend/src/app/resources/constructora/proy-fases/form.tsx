"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  PROY_FASE_DEFAULT,
  VALIDATION_RULES,
  proyFaseSchema,
  type ProyFaseFormValues,
} from "./model";

const ProyFaseMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <FormNumber
        source="orden"
        label="Orden"
        validate={required()}
        widthClass="w-full"
        min={1}
      />
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={3}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

export const ProyFaseForm = () => (
  <SimpleForm<ProyFaseFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(proyFaseSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROY_FASE_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la fase"
      main={<ProyFaseMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
