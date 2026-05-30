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

export const ParteDiarioEstadoShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="abreviatura" label="Abreviatura" />
      <TextField source="nombre" label="Nombre" />
      <SelectField source="activo" label="Estado" choices={ESTADO_CHOICES} />
      <DateField source="created_at" label="Creado" />
      <DateField source="updated_at" label="Actualizado" />
    </SimpleShowLayout>
  </Show>
);

export default ParteDiarioEstadoShow;
