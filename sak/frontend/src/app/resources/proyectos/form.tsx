"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  PROYECTO_DEFAULT,
  PROYECTO_VALIDATIONS,
  proyectoSchema,
  type ProyectoFormValues,
} from "./model";

const ProyectoMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={PROYECTO_VALIDATIONS.NOMBRE_MAX}
      />
      <FormText
        source="estado"
        label="Estado"
        widthClass="w-full"
        maxLength={PROYECTO_VALIDATIONS.ESTADO_MAX}
      />
      <FormDate
        source="fecha_inicio"
        label="Fecha de inicio"
        widthClass="w-full"
      />
      <FormDate
        source="fecha_final"
        label="Fecha de finalizacion"
        widthClass="w-full"
      />
      <FormNumber
        source="importe_mat"
        label="Importe materiales"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="importe_mo"
        label="Importe mano de obra"
        step="0.01"
        widthClass="w-full"
      />
      <FormTextarea
        source="comentario"
        label="Comentario"
        widthClass="w-full"
        className="md:col-span-2 [&_textarea]:min-h-[64px]"
        maxLength={PROYECTO_VALIDATIONS.COMENTARIO_MAX}
      />
    </div>
  </div>
);

export const ProyectoForm = () => (
  <SimpleForm<ProyectoFormValues>
    className="w-full max-w-3xl"
    resolver={zodResolver(proyectoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROYECTO_DEFAULT}
  >
    <SectionBaseTemplate title="Datos generales" main={<ProyectoMainFields />} defaultOpen />
  </SimpleForm>
);
