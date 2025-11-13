"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { DateField } from "@/components/date-field";

export const CentroCostoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <BadgeField source="tipo" label="Tipo" />
      <TextField source="codigo_contable" label="Código contable" />
      <TextField source="descripcion" label="Descripción" />
      <BadgeField source="activo" label="Estado" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);
