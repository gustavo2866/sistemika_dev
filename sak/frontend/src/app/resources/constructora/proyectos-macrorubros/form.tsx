"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";

import {
  PROYECTO_MACRORUBRO_DEFAULT,
  VALIDATION_RULES,
  proyectoMacrorubroSchema,
  type ProyectoMacrorubroFormValues,
} from "./model";

const ProyectoMacrorubroMainFields = () => (
  <div className="flex flex-col gap-2">
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
    />
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

export const ProyectoMacrorubroForm = () => (
  <SimpleForm<ProyectoMacrorubroFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(proyectoMacrorubroSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROYECTO_MACRORUBRO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del macrorubro"
      main={<ProyectoMacrorubroMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
