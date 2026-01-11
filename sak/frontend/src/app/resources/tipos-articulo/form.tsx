"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";

export const TipoArticuloForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <TextInput
      source="nombre"
      label="Nombre del tipo"
      validate={required()}
    />

    <TextInput
      source="codigo_contable"
      label="Codigo contable"
      validate={required()}
    />

    <TextInput
      source="descripcion"
      label="Descripcion"
      multiline
      rows={3}
    />

    <BooleanInput
      source="activo"
      label="Tipo activo"
      defaultValue={true}
    />
  </SimpleForm>
);
