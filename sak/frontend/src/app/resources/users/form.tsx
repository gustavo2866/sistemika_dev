"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";

export const UserForm = () => (
  <SimpleForm>
    <TextInput source="nombre" label="Nombre" isRequired fullWidth />
    <TextInput source="email" label="Email" isRequired fullWidth type="email" />
    <TextInput source="telefono" label="Telefono" fullWidth />
    <TextInput source="url_foto" label="URL Foto" fullWidth />
    <NumberInput source="pais_id" label="Pais (ID)" fullWidth />
  </SimpleForm>
);
