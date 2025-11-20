"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const MonedaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="codigo" label="Código" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="simbolo" label="Símbolo" />
      <TextField source="es_moneda_base" label="Es moneda base" />
      <TextField source="activo" label="Activa" />
    </SimpleShowLayout>
  </Show>
);
