"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  ADM_CONCEPTO_DEFAULT,
  ADM_CONCEPTO_RULES,
  admConceptoSchema,
  type AdmConceptoFormValues,
} from "./model";

const AdmConceptoMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={ADM_CONCEPTO_RULES.NOMBRE.MAX_LENGTH}
      />
      <FormText
        source="cuenta"
        label="Cuenta"
        validate={required()}
        widthClass="w-full"
        maxLength={ADM_CONCEPTO_RULES.CUENTA.MAX_LENGTH}
      />
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={3}
        widthClass="w-full"
        maxLength={ADM_CONCEPTO_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="es_impuesto" label="Es impuesto" defaultValue={false} />
    </div>
  </div>
);

export const AdmConceptoForm = () => (
  <SimpleForm<AdmConceptoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(admConceptoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ADM_CONCEPTO_DEFAULT}
  >
    <SectionBaseTemplate title="Datos del concepto" main={<AdmConceptoMainFields />} defaultOpen />
  </SimpleForm>
);
