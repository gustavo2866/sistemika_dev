"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const CRMCatalogoRespuestaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="titulo" label="Titulo" />
      <TextField source="texto" label="Texto" />
      <TextField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
