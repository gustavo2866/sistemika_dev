"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";

export const TipoPropiedadShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="descripcion" label="Descripcion" />
      <BadgeField source="activo" label="Estado" />
    </div>
  </Show>
);

