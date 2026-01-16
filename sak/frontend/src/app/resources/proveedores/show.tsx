"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { ReferenceField } from "@/components/reference-field";

export const ProveedorShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="nombre" label="Nombre" />
      <TextField source="razon_social" label="Razon social" />
      <TextField source="cuit" label="CUIT" />
      <TextField source="telefono" label="Telefono" />
      <TextField source="email" label="Email" />
      <TextField source="direccion" label="Direccion" />
      <ReferenceField source="concepto_id" reference="api/v1/adm/conceptos" label="Concepto">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="cbu" label="CBU" />
      <TextField source="alias_bancario" label="Alias bancario" />
      <BadgeField source="activo" label="Estado" />
    </div>
  </Show>
);
