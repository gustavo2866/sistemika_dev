"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const UserShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="email" label="Email" />
      <TextField source="telefono" label="Telefono" />
      <TextField source="url_foto" label="URL Foto" />
      <TextField source="pais_id" label="Pais (ID)" />
    </SimpleShowLayout>
  </Show>
);