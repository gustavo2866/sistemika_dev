"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { required } from "ra-core";

export const CRMContactoForm = () => (
  <SimpleForm>
    <TextInput source="nombre_completo" label="Nombre completo" validate={required()} className="w-full" />
    <ArrayInput source="telefonos" label="Teléfonos">
      <SimpleFormIterator getItemLabel={(index) => `Teléfono #${index + 1}`}>
        <TextInput source="" label="Número" className="w-full" />
      </SimpleFormIterator>
    </ArrayInput>
    <TextInput source="email" label="Email" type="email" className="w-full" />
    <TextInput source="red_social" label="Usuario / red social" className="w-full" />
    <ReferenceInput source="responsable_id" reference="users" label="Responsable">
      <SelectInput optionText="nombre" className="w-full" validate={required()} />
    </ReferenceInput>
    <TextInput source="notas" label="Notas" multiline className="w-full" />
  </SimpleForm>
);
