"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { BooleanInput } from "@/components/boolean-input";

export const TipoOperacionForm = () => (
  <SimpleForm className="w-full max-w-3xl">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="codigo" label="Codigo" validate={required()} />
      <TextInput source="descripcion" label="Descripcion" validate={required()} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <BooleanInput source="requiere_iva" label="Requiere IVA" />
      <NumberInput
        source="porcentaje_iva_default"
        label="IVA por defecto (%)"
        step={0.1}
      />
    </div>
    <TextInput source="cuenta_contable" label="Cuenta contable" />
    <BooleanInput source="activo" label="Activo" />
  </SimpleForm>
);
