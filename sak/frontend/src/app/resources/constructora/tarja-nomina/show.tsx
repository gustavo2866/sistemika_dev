"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { SelectField } from "@/components/select-field";
import { FormOrderEditButton } from "@/components/forms/form_order";
import { useRecordContext } from "ra-core";

const PRESENTISMO_CHOICES = [
  { id: true, name: "SI" },
  { id: false, name: "NO" },
];

const TarjaNominaShowActions = () => {
  const record = useRecordContext<{ tipo_novedad?: string | null; editable?: boolean | null }>();
  if (record?.tipo_novedad === "ALT" || record?.editable === false) {
    return null;
  }
  return <FormOrderEditButton />;
};

export const TarjaNominaShow = () => (
  <Show actions={<TarjaNominaShowActions />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="tarja_id" label="Tarja" />
      <NumberField source="horas_justificadas" label="Horas justificadas" />
      <SelectField source="presentismo" choices={PRESENTISMO_CHOICES} />
      <NumberField source="presentismo_importe" />
      <NumberField source="adicional_importe" />
      <SelectField source="premio" choices={PRESENTISMO_CHOICES} />
      <NumberField source="premio_importe" />
      <SelectField source="viatico" choices={PRESENTISMO_CHOICES} />
      <NumberField source="viatico_importe" />
      <NumberField source="sueldo_importe" />
      <NumberField source="mejora_importe" />
      <NumberField source="cargas_importe" />
      <DateField source="fecha_desde" />
      <DateField source="fecha_hasta" />
      <TextField source="observaciones" empty="-" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default TarjaNominaShow;
