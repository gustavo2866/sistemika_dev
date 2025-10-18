"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { UrlField } from "@/components/url-field";
import { SelectField } from "@/components/select-field";
import { categoriaChoices, estadoChoices } from "./constants";

export const NominaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="apellido" label="Apellido" />
      <TextField source="dni" label="DNI" />
      <TextField source="email" label="Email" />
      <TextField source="telefono" label="Telefono" />
      <TextField source="direccion" label="Direccion" />
      <SelectField
        source="categoria"
        choices={categoriaChoices}
      />
      <NumberField
        source="salario_mensual"
        label="Salario Mensual"
        options={{ style: "currency", currency: "ARS" }}
      />
      <DateField source="fecha_nacimiento" />
      <DateField source="fecha_ingreso" />
      <SelectField
        source="activo"
        choices={estadoChoices}
      />
      <UrlField source="url_foto" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default NominaShow;
