"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";

export const TipoActualizacionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nombre" label="Nombre" />
      <TextField source="cantidad_meses" label="Cantidad de meses" />
      <BadgeField source="activa" label="Activa" />
    </SimpleShowLayout>
  </Show>
);
