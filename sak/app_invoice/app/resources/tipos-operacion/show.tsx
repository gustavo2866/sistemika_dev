"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { NumberField } from "@/components/number-field";

export const TipoOperacionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="codigo" />
      <TextField source="descripcion" />
      <BadgeField source="requiere_iva" />
      <NumberField source="porcentaje_iva_default" />
      <TextField source="cuenta_contable" />
      <BadgeField source="activo" />
    </SimpleShowLayout>
  </Show>
);
