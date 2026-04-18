"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";

export const SettingForm = () => (
  <SimpleForm>
    <TextInput source="clave" label="Clave" validate={required()} className="w-full" />
    <TextInput source="valor" label="Valor" validate={required()} className="w-full" />
    <TextInput source="descripcion" label="Descripcion" className="w-full" />
  </SimpleForm>
);