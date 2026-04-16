"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const PropiedadServicioShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="servicio_tipo_id" label="Tipo de servicio" />
      <TextField source="ref_cliente" label="Ref. cliente" />
      <TextField source="fecha" label="Fecha" />
      <TextField source="comentario" label="Comentario" />
      <TextField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
