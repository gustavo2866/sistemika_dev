"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";

export const TipoComprobanteShow = () => (
  <Show>
    <TextField source="name" label="Nombre" />
  </Show>
);
