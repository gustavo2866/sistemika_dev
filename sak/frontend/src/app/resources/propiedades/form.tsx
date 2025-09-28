"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const PropiedadForm = () => (
  <SimpleForm className="w-full max-w-3xl">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" isRequired className="w-full" />
      <TextInput source="tipo" label="Tipo" isRequired className="w-full" />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="propietario" label="Propietario" isRequired className="w-full" />
      <TextInput source="estado" label="Estado" isRequired className="w-full" />
    </div>
  </SimpleForm>
);
