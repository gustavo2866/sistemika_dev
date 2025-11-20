"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";

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
      <ReferenceField source="responsable_id" reference="users" label="Responsable">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
