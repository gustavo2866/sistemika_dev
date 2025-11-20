"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";

export const CRMCotizacionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ReferenceField source="moneda_origen_id" reference="monedas" label="Moneda origen">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="moneda_destino_id" reference="monedas" label="Moneda destino">
        <TextField source="nombre" />
      </ReferenceField>
      <NumberField source="tipo_cambio" label="Tipo de cambio" />
      <TextField source="fecha_vigencia" label="Fecha de vigencia" />
      <TextField source="fuente" label="Fuente" />
    </SimpleShowLayout>
  </Show>
);
