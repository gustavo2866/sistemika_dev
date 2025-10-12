"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";

export const ProyectoForm = () => (
  <SimpleForm>
    <TextInput source="nombre" label="Nombre" isRequired className="w-full" />
    <TextInput source="estado" label="Estado" className="w-full" />
    <TextInput
      source="fecha_inicio"
      label="Fecha de Inicio"
      type="date"
      className="w-full"
    />
    <TextInput
      source="fecha_final"
      label="Fecha de Finalizacion"
      type="date"
      className="w-full"
    />
    <NumberInput
      source="importe_mat"
      label="Importe Materiales"
      step="0.01"
      className="w-full"
    />
    <NumberInput
      source="importe_mo"
      label="Importe Mano de Obra"
      step="0.01"
      className="w-full"
    />
    <TextInput
      source="comentario"
      label="Comentario"
      multiline
      rows={4}
      className="w-full"
    />
  </SimpleForm>
);
