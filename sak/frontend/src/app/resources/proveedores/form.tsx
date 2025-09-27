"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";

export const ProveedorForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" isRequired />
      <TextInput source="razon_social" label="Razon social" isRequired />
    </div>
    <TextInput source="cuit" label="CUIT" isRequired />

    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="telefono" label="Telefono" />
      <TextInput source="email" label="Email" type="email" />
    </div>
    <TextInput source="direccion" label="Direccion" />

    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="cbu" label="CBU" />
      <TextInput source="alias_bancario" label="Alias bancario" />
    </div>

    <BooleanInput source="activo" label="Activo" />
  </SimpleForm>
);
