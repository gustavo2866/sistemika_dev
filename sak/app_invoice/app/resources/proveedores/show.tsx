"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { EmailField } from "@/components/email-field";

export const ProveedorShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="nombre" />
      <TextField source="razon_social" />
      <TextField source="cuit" />
      <TextField source="telefono" />
      <EmailField source="email" />
      <TextField source="direccion" />
      <TextField source="cbu" />
      <TextField source="alias_bancario" />
      <BadgeField source="activo" />
    </SimpleShowLayout>
  </Show>
);
