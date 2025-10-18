"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { SelectInput } from "@/components/select-input";
import { BooleanInput } from "@/components/boolean-input";
import { categoriaChoices } from "./constants";

export const NominaForm = () => (
  <SimpleForm>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
      <TextInput
        source="apellido"
        label="Apellido"
        validate={required()}
        className="w-full"
      />
      <TextInput source="dni" label="DNI" validate={required()} className="w-full" />
      <SelectInput
        source="categoria"
        label="Categoria"
        choices={categoriaChoices}
        validate={required()}
        className="w-full"
      />
      <TextInput
        source="email"
        label="Email"
        type="email"
        className="w-full"
      />
      <TextInput
        source="telefono"
        label="Telefono"
        className="w-full"
      />
      <TextInput
        source="fecha_nacimiento"
        label="Fecha de Nacimiento"
        type="date"
        className="w-full"
      />
      <TextInput
        source="fecha_ingreso"
        label="Fecha de Ingreso"
        type="date"
        className="w-full"
      />
      <NumberInput
        source="salario_mensual"
        label="Salario Mensual"
        step="0.01"
        className="w-full"
      />
      <TextInput
        source="url_foto"
        label="URL Foto"
        type="url"
        className="w-full"
      />
    </div>
    <TextInput
      source="direccion"
      label="Direccion"
      multiline
      rows={3}
      className="w-full"
    />
    <BooleanInput
      source="activo"
      label="Activo"
      defaultValue={true}
      helperText="Desmarca para ocultar al empleado en listados operativos"
    />
  </SimpleForm>
);
