"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";

export const MetodoPagoShow = () => (
  <Show>
    <TextField source="nombre" label="Nombre" />
  </Show>
);
