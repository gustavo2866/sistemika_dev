"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const TipoComprobanteForm = () => (
  <SimpleForm className="w-full max-w-lg">
    <TextInput source="name" label="Nombre" validate={required()} className="w-full" />
  </SimpleForm>
);
