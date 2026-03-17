"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import {
  FormOrderToolbar,
  FormBoolean,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";

import {
  CRM_CONDICION_PAGO_DEFAULTS,
  VALIDATION_RULES,
  crmCondicionPagoSchema,
  type CRMCondicionPagoFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales editables de la condicion de pago.
const CamposPrincipalesCondicionPago = () => (
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
      <FormBoolean
        source="activo"
        label="Condicion activa"
        defaultValue
      />
    </div>
  </div>
);

// Muestra una ayuda breve sobre el alcance funcional del catalogo.
const AyudaCondicionPago = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Configura el codigo comercial, el nombre visible y si la condicion queda habilitada
    para oportunidades y cotizaciones.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMCondicionPagoForm = () => (
  <SimpleForm<CRMCondicionPagoFormValues>
    className="w-full max-w-2xl"
    // ra-core tipa resolver como Resolver<FieldValues>, igual que otros resources.
    resolver={zodResolver(crmCondicionPagoSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_CONDICION_PAGO_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos de la condicion de pago"
      main={<CamposPrincipalesCondicionPago />}
      optional={<AyudaCondicionPago />}
      defaultOpen
    />
  </SimpleForm>
);

//#endregion Formulario principal
