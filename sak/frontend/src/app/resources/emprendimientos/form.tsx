"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";
import { EMPRENDIMIENTO_ESTADO_CHOICES } from "./model";

export const EmprendimientoForm = () => (
  <SimpleForm>
    <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
    <TextInput source="descripcion" label="Descripción" multiline className="w-full" />
    <TextInput source="ubicacion" label="Ubicación" className="w-full" />
    <SelectInput
      source="estado"
      label="Estado"
      choices={EMPRENDIMIENTO_ESTADO_CHOICES}
      defaultValue="planificacion"
      className="w-full"
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextInput source="fecha_inicio" label="Fecha de inicio" type="date" className="w-full" />
      <TextInput source="fecha_fin_estimada" label="Fecha estimada de fin" type="date" className="w-full" />
    </div>
    <BooleanInput source="activo" label="Activo" />
  </SimpleForm>
);
