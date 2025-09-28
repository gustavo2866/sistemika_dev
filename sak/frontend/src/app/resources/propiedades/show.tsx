"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";

export const PropiedadShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="nombre" label="Nombre" />
      <TextField source="tipo" label="Tipo" />
      <TextField source="propietario" label="Propietario" />
      <TextField source="estado" label="Estado" />
    </div>
  </Show>
);
