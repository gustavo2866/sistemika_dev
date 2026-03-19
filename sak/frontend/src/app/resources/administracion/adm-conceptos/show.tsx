"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";

export const AdmConceptoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nombre" label="Nombre" />
      <TextField source="cuenta" label="Cuenta" />
      <TextField source="descripcion" label="Descripcion" />
      <BadgeField source="es_impuesto" label="Impuesto" />
    </SimpleShowLayout>
  </Show>
);
