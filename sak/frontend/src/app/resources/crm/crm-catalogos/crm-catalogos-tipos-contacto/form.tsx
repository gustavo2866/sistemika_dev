"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormBoolean,
  FormOrderToolbar,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { required } from "ra-core";

import {
  CRM_TIPO_CONTACTO_DEFAULTS,
  VALIDATION_RULES,
  crmTipoContactoSchema,
  type CRMTipoContactoFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

const CamposPrincipalesTipoContacto = () => (
  <div className="flex flex-col gap-2">
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
    />
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Tipo activo" defaultValue />
    </div>
  </div>
);

const AyudaTipoContacto = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Define el nombre visible del tipo de contacto y si queda disponible para
    clasificar contactos CRM.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

export const CRMTipoContactoForm = () => (
  <SimpleForm<CRMTipoContactoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(crmTipoContactoSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_TIPO_CONTACTO_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del tipo de contacto"
      main={<CamposPrincipalesTipoContacto />}
      optional={<AyudaTipoContacto />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
