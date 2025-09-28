"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const MetodoPagoForm = () => (
  <SimpleForm className="w-full max-w-md">
    <TextInput source="nombre" label="Nombre" isRequired className="w-full" />
  </SimpleForm>
);
