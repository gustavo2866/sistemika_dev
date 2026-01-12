"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

export const TipoArticuloForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <TextInput
      source="nombre"
      label="Nombre del tipo"
      validate={required()}
    />

    <ReferenceInput
      source="adm_concepto_id"
      reference="api/v1/adm/conceptos"
      label="Concepto"
    >
      <SelectInput optionText="nombre" validate={required()} />
    </ReferenceInput>

    <TextInput
      source="descripcion"
      label="Descripcion"
      multiline
      rows={3}
    />

    <BooleanInput
      source="activo"
      label="Tipo activo"
      defaultValue={true}
    />
  </SimpleForm>
);
