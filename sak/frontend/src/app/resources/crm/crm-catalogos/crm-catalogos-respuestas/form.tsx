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
  CRM_CATALOGO_RESPUESTA_DEFAULTS,
  VALIDATION_RULES,
  crmCatalogoRespuestaSchema,
  type CRMCatalogoRespuestaFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales editables de la respuesta catalogada.
const CamposPrincipalesCatalogoRespuesta = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2">
      <FormText
        source="titulo"
        label="Titulo"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.TITULO.MAX_LENGTH}
      />
      <FormTextarea
        source="texto"
        label="Texto"
        rows={6}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.TEXTO.MAX_LENGTH}
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Respuesta activa" defaultValue />
    </div>
  </div>
);

// Muestra una ayuda breve sobre el alcance funcional del catalogo.
const AyudaCatalogoRespuesta = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Configura el titulo visible, el texto reutilizable y si la respuesta queda
    disponible para acelerar respuestas dentro del flujo CRM.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMCatalogoRespuestaForm = () => (
  <SimpleForm<CRMCatalogoRespuestaFormValues>
    className="w-full max-w-2xl"
    // ra-core tipa resolver como Resolver<FieldValues>, igual que otros resources.
    resolver={zodResolver(crmCatalogoRespuestaSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_CATALOGO_RESPUESTA_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos de la respuesta"
      main={<CamposPrincipalesCatalogoRespuesta />}
      optional={<AyudaCatalogoRespuesta />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
