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
  CRM_TIPO_EVENTO_DEFAULTS,
  VALIDATION_RULES,
  crmTipoEventoSchema,
  type CRMTipoEventoFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales editables del tipo de evento.
const CamposPrincipalesTipoEvento = () => (
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
const AyudaTipoEvento = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Configura el codigo comercial, el nombre visible y si el tipo queda disponible
    para categorizar eventos y acciones del flujo CRM.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMTipoEventoForm = () => (
  <SimpleForm<CRMTipoEventoFormValues>
    className="w-full max-w-2xl"
    // ra-core tipa resolver como Resolver<FieldValues>, igual que otros resources.
    resolver={zodResolver(crmTipoEventoSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_TIPO_EVENTO_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del tipo de evento"
      main={<CamposPrincipalesTipoEvento />}
      optional={<AyudaTipoEvento />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
