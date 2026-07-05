"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormSelect,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";

import {
  PROYECTO_CONCEPTO_DEFAULT,
  SIGNO_CHOICES,
  VALIDATION_RULES,
  proyectoConceptoSchema,
  type ProyectoConceptoFormValues,
} from "./model";

const ProyectoConceptoMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <FormSelect
        source="signo"
        label="Signo"
        choices={SIGNO_CHOICES}
        validate={required()}
        widthClass="w-full"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

export const ProyectoConceptoForm = () => (
  <SimpleForm<ProyectoConceptoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(proyectoConceptoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROYECTO_CONCEPTO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del concepto"
      main={<ProyectoConceptoMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
