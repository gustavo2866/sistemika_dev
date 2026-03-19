"use client";

import { required } from "ra-core";

import { SimpleForm } from "@/components/simple-form";
import {
  FormBoolean,
  FormDate,
  FormErrorSummary,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";

import {
  EMPRENDIMIENTO_ESTADO_CHOICES,
  EMPRENDIMIENTO_DEFAULTS,
  type EmprendimientoFormValues,
} from "./model";

export const EmprendimientoForm = () => (
  <SimpleForm<EmprendimientoFormValues>
    className="w-full max-w-3xl"
    warnWhenUnsavedChanges
    defaultValues={EMPRENDIMIENTO_DEFAULTS}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Cabecera"
      main={<CabeceraFields />}
      optional={<CabeceraOpcionales />}
      defaultOpen
    />
    {/* Fechas ahora se muestran en cabecera (opcionales) */}
  </SimpleForm>
);

const CabeceraFields = () => (
  <div className="grid gap-2 md:grid-cols-5">
    <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-[120px]" />
    <FormSelect
      source="estado"
      label="Estado"
      choices={EMPRENDIMIENTO_ESTADO_CHOICES}
      widthClass="w-[120px]"
      validate={required()}
    />
    <FormBoolean
      source="activo"
      label="Activo"
      className="max-w-[70px] justify-self-center"
    />
    <FormDate source="fecha_inicio" label="Fecha inicio" widthClass="w-[120px]" />
    <FormDate source="fecha_fin_estimada" label="Fecha fin" widthClass="w-[120px]" />
  </div>
);

const CabeceraOpcionales = () => (
  <div className="mt-1 space-y-0">
    <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
      <div className="grid gap-2 md:grid-cols-2">
        <FormText source="ubicacion" label="Ubicación" widthClass="w-full" />
        <FormTextarea
          source="descripcion"
          label="Descripción"
          widthClass="w-full"
          className="md:col-span-2 [&_textarea]:min-h-[80px]"
        />
      </div>
    </div>
  </div>
);
