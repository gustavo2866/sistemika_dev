"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";

export const MonedaForm = () => (
  <SimpleForm>
    <TextInput source="codigo" label="Código" validate={required()} className="w-full" />
    <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
    <TextInput source="simbolo" label="Símbolo" validate={required()} className="w-full" />
    <BooleanInput source="es_moneda_base" label="Es moneda base" />
    <BooleanInput source="activo" label="Activa" />
  </SimpleForm>
);
