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
  PARTE_DIARIO_ESTADO_DEFAULT,
  VALIDATION_RULES,
  parteDiarioEstadoSchema,
  type ParteDiarioEstadoFormValues,
} from "./model";

const ParteDiarioEstadoFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="abreviatura"
      label="Abreviatura"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.ABREVIATURA.MAX_LENGTH}
    />
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
    />
    <div className="md:col-span-2">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

export const ParteDiarioEstadoForm = () => (
  <SimpleForm<ParteDiarioEstadoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(parteDiarioEstadoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PARTE_DIARIO_ESTADO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del estado"
      main={<ParteDiarioEstadoFields />}
      defaultOpen
    />
  </SimpleForm>
);
