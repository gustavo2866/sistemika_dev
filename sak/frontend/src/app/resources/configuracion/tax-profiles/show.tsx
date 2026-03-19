"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";

export const TaxProfileShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nombre" label="Nombre" />
      <TextField source="descripcion" label="Descripcion" />
      <BadgeField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
