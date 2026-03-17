"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import {
  FormBoolean,
  FormText,
  FormOrderToolbar,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  CRM_CELULAR_DEFAULTS,
  crmCelularSchema,
  VALIDATION_RULES,
  type CRMCelularFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales editables del celular CRM.
const CamposPrincipalesCelular = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="alias"
        label="Alias"
        widthClass="w-full md:col-span-2"
        maxLength={VALIDATION_RULES.ALIAS.MAX_LENGTH}
        placeholder="Ej. Linea soporte"
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
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Celular activo" defaultValue />
    </div>
  </div>
);

// Muestra una ayuda breve sobre el alcance funcional del recurso.
const AyudaCelularCRM = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Define el alias operativo, el numero y el identificador expuesto por Meta
    para mantener integradas las conversaciones del canal.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMCelularForm = () => (
  <SimpleForm<CRMCelularFormValues>
    className="w-full max-w-2xl"
    // ra-core tipa resolver como Resolver<FieldValues>, igual que otros resources.
    resolver={zodResolver(crmCelularSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_CELULAR_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del celular"
      main={<CamposPrincipalesCelular />}
      optional={<AyudaCelularCRM />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
