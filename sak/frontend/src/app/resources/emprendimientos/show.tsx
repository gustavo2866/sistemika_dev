"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const EmprendimientoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="descripcion" label="Descripción" />
      <TextField source="ubicacion" label="Ubicación" />
      <TextField source="estado" label="Estado" />
      <TextField source="fecha_inicio" label="Fecha de inicio" />
      <TextField source="fecha_fin_estimada" label="Fecha estimada" />
      <TextField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
