"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";

export const TipoPropiedadForm = () => (
  <SimpleForm className="w-full max-w-2xl">
    <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
    <TextInput
      source="descripcion"
      label="Descripcion"
      multiline
      className="w-full"
      rows={3}
    />
    <BooleanInput source="activo" label="Activo" defaultValue />
  </SimpleForm>
);

