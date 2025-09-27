"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { BadgeField } from "@/components/badge-field";

export const TipoOperacionShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="codigo" label="Codigo" />
      <TextField source="descripcion" label="Descripcion" />
      <BadgeField source="requiere_iva" label="Requiere IVA" />
      <NumberField source="porcentaje_iva_default" label="IVA por defecto" options={{ style: "decimal", maximumFractionDigits: 2 }} />
      <TextField source="cuenta_contable" label="Cuenta contable" />
      <BadgeField source="activo" label="Estado" />
    </div>
  </Show>
);
