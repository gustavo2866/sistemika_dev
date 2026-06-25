"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { FormOrderEditButton } from "@/components/forms/form_order";

const ESTADO_CHOICES = [
  { id: true, name: "Activo" },
  { id: false, name: "Inactivo" },
];

export const TarjaEstadoShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="abreviatura" label="Abreviatura" />
      <TextField source="nombre" label="Nombre" />
      <SelectField source="activo" choices={ESTADO_CHOICES} />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default TarjaEstadoShow;
