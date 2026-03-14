"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";

export const CRMCatalogoRespuestaForm = () => (
  <SimpleForm>
    <TextInput source="titulo" label="Titulo" validate={required()} className="w-full" />
    <TextInput source="texto" label="Texto" multiline className="w-full" />
    <BooleanInput source="activo" label="Activo" />
  </SimpleForm>
);
