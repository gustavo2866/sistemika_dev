"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  TIPO_ACTUALIZACION_DEFAULT,
  TIPO_ACTUALIZACION_VALIDATIONS,
  tipoActualizacionSchema,
  type TipoActualizacionFormValues,
} from "./model";

const TipoActualizacionMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={TIPO_ACTUALIZACION_VALIDATIONS.NOMBRE_MAX}
      />
      <FormNumber
        source="cantidad_meses"
        label="Cantidad de meses"
        validate={required()}
        widthClass="w-full"
        min={1}
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activa" label="Activa" defaultValue />
    </div>
  </div>
);

export const TipoActualizacionForm = () => (
  <SimpleForm<TipoActualizacionFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(tipoActualizacionSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={TIPO_ACTUALIZACION_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del tipo de actualizacion"
      main={<TipoActualizacionMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
