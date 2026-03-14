"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";

export const CRMOrigenLeadForm = () => (
  <SimpleForm>
    <TextInput source="codigo" label="Código" validate={required()} className="w-full" />
    <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
    <TextInput source="descripcion" label="Descripción" multiline className="w-full" />
    <BooleanInput source="activo" label="Activo" />
  </SimpleForm>
);
