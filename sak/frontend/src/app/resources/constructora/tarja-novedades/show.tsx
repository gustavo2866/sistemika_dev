"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { SelectField } from "@/components/select-field";
import { FormOrderEditButton } from "@/components/forms/form_order";

const PRESENTISMO_CHOICES = [
  { id: true, name: "SI" },
  { id: false, name: "NO" },
];

export const TarjaNovedadShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="tarja_id" label="Tarja" />
      <NumberField source="horas_justificadas" label="Horas justificadas" />
      <SelectField source="presentismo" choices={PRESENTISMO_CHOICES} />
      <NumberField source="adicional" />
      <NumberField source="premio" />
      <TextField source="observaciones" empty="-" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default TarjaNovedadShow;
