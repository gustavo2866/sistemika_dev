"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const MetodoPagoForm = () => (
  <SimpleForm className="w-full max-w-md">
    <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
  </SimpleForm>
);
