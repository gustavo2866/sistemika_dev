"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  CRM_CELULAR_DEFAULTS,
  crmCelularSchema,
  VALIDATION_RULES,
  type CRMCelularFormValues,
} from "./model";

const CRMCelularMainFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="alias"
      label="Alias"
      widthClass="w-full md:col-span-2"
      maxLength={VALIDATION_RULES.ALIAS.MAX_LENGTH}
    />
    <FormText
      source="numero_celular"
      label="Numero celular"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.NUMERO_CELULAR.MAX_LENGTH}
      placeholder="+54911..."
    />
    <FormText
      source="meta_celular_id"
      label="Meta celular ID"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.META_CELULAR_ID.MAX_LENGTH}
    />
    <div className="md:col-span-2">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

export const CRMCelularForm = () => (
  <SimpleForm<CRMCelularFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(crmCelularSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={CRM_CELULAR_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del celular"
      main={<CRMCelularMainFields />}
      defaultOpen
    />
  </SimpleForm>
);

