"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  TIPO_ARTICULO_DEFAULT,
  TIPO_ARTICULO_RULES,
  tipoArticuloSchema,
  type TipoArticuloFormValues,
} from "./model";

const TipoArticuloMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre del tipo"
        validate={required()}
        widthClass="w-full"
        maxLength={TIPO_ARTICULO_RULES.NOMBRE.MAX_LENGTH}
      />
      <ReferenceInput
        source="adm_concepto_id"
        reference="api/v1/adm/conceptos"
      >
        <FormSelect
          optionText="nombre"
          label="Concepto"
          widthClass="w-full"
          validate={required()}
        />
      </ReferenceInput>
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={3}
        widthClass="w-full"
        maxLength={TIPO_ARTICULO_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Tipo activo" defaultValue />
    </div>
  </div>
);

export const TipoArticuloForm = () => (
  <SimpleForm<TipoArticuloFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(tipoArticuloSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={TIPO_ARTICULO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del tipo de articulo"
      main={<TipoArticuloMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
