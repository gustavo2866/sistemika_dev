"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { BadgeField } from "@/components/badge-field";

export const TareaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="titulo" />
      <TextField source="descripcion" />
      <BadgeField source="estado" />
      <BadgeField source="prioridad" />
      <TextField source="fecha_vencimiento" />
      <ReferenceField 
        source="user_id" 
        reference="users"
      >
        <TextField source="nombre" />
      </ReferenceField>
    </SimpleShowLayout>
  </Show>
);
