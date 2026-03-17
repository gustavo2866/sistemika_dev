"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormBoolean,
  FormOrderToolbar,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { required } from "ra-core";

import {
  CRM_TIPO_OPERACION_DEFAULTS,
  VALIDATION_RULES,
  crmTipoOperacionSchema,
  type CRMTipoOperacionFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales editables del tipo de operacion.
const CamposPrincipalesTipoOperacion = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="codigo"
        label="Codigo"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.CODIGO.MAX_LENGTH}
      />
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={4}
        widthClass="w-full md:col-span-2"
        maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Tipo activo" defaultValue />
    </div>
  </div>
);

// Muestra una ayuda breve sobre el alcance funcional del catalogo.
const AyudaTipoOperacion = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Configura el codigo comercial, el nombre visible y si el tipo queda disponible
    para clasificar oportunidades y cotizaciones CRM.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMTipoOperacionForm = () => (
  <SimpleForm<CRMTipoOperacionFormValues>
    className="w-full max-w-2xl"
    // ra-core tipa resolver como Resolver<FieldValues>, igual que otros resources.
    resolver={zodResolver(crmTipoOperacionSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_TIPO_OPERACION_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del tipo de operacion"
      main={<CamposPrincipalesTipoOperacion />}
      optional={<AyudaTipoOperacion />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
