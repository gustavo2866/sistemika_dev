"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";

export const AdmConceptoShow = () => (
  <Show>
    <TextField source="nombre" label="Nombre" />
    <TextField source="cuenta" label="Cuenta" />
    <TextField source="descripcion" label="Descripcion" />
  </Show>
);
