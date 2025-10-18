"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const PropiedadForm = () => (
  <SimpleForm className="w-full max-w-3xl">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
      <TextInput source="tipo" label="Tipo" validate={required()} className="w-full" />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="propietario" label="Propietario" validate={required()} className="w-full" />
      <TextInput source="estado" label="Estado" validate={required()} className="w-full" />
    </div>
  </SimpleForm>
);
