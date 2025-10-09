"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";

export const UserForm = () => (
  <SimpleForm>
    <TextInput source="nombre" label="Nombre" isRequired className="w-full" />
    <TextInput source="email" label="Email" isRequired className="w-full" type="email" />
    <TextInput source="telefono" label="Telefono" className="w-full" />
    <TextInput source="url_foto" label="URL Foto" className="w-full" />
    <NumberInput source="pais_id" label="Pais (ID)" className="w-full" />
  </SimpleForm>
);
