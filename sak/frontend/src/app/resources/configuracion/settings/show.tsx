"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const SettingShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="clave" label="Clave" />
      <TextField source="valor" label="Valor" />
      <TextField source="descripcion" label="Descripcion" />
    </SimpleShowLayout>
  </Show>
);