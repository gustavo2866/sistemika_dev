"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";

export const DepartamentoForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <TextInput 
      source="nombre" 
      label="Nombre del departamento" 
      validate={required()} 
    />
    
    <TextInput
      source="descripcion"
      label="Descripción"
      multiline
      rows={3}
    />
    
    <BooleanInput
      source="activo"
      label="Departamento activo"
      defaultValue={true}
    />
  </SimpleForm>
);
