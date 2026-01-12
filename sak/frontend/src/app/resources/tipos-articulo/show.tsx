"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { ReferenceField } from "@/components/reference-field";

export const TipoArticuloShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <ReferenceField source="adm_concepto_id" reference="api/v1/adm/conceptos" label="Concepto">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="descripcion" label="Descripcion" />
      <BadgeField source="activo" label="Estado" />
    </div>
  </Show>
);
