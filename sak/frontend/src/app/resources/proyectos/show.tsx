"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";

export const ProyectoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="estado" label="Estado" />
      <DateField source="fecha_inicio" label="Fecha de Inicio" />
      <DateField source="fecha_final" label="Fecha de Finalizacion" />
      <NumberField
        source="importe_mat"
        label="Importe Materiales"
        options={{ style: "currency", currency: "ARS" }}
      />
      <NumberField
        source="importe_mo"
        label="Importe Mano de Obra"
        options={{ style: "currency", currency: "ARS" }}
      />
      <TextField source="comentario" label="Comentario" />
    </SimpleShowLayout>
  </Show>
);
