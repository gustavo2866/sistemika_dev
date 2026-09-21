"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { FormOrderEditButton } from "@/components/forms/form_order";

const ESTADO_CHOICES = [
  { id: true, name: "Activa" },
  { id: false, name: "Inactiva" },
];

export const NominaCategoriaShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="codigo" label="Codigo" />
      <TextField source="descripcion" label="Descripcion" />
      <SelectField source="activa" choices={ESTADO_CHOICES} />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default NominaCategoriaShow;
