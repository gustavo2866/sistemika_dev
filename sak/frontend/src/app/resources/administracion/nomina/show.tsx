"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { UrlField } from "@/components/url-field";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { FormOrderEditButton } from "@/components/forms/form_order";
import { CATEGORIA_CHOICES, ESTADO_CHOICES } from "./model";

export const NominaShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="apellido" label="Apellido" />
      <TextField source="dni" label="DNI" />
      <TextField source="nro_legajo" label="Nro. legajo" />
      <TextField source="email" label="Email" />
      <TextField source="telefono" label="Telefono" />
      <TextField source="direccion" label="Direccion" />
      <SelectField
        source="categoria"
        choices={CATEGORIA_CHOICES}
      />
      <ReferenceField source="idproyecto" reference="proyectos" label="Proyecto">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="encargado_contacto_id" reference="crm/contactos" label="Encargado">
        <TextField source="nombre_completo" />
      </ReferenceField>
      <NumberField
        source="salario_mensual"
        label="Salario Mensual"
        options={{ style: "currency", currency: "ARS" }}
      />
      <DateField source="fecha_nacimiento" />
      <DateField source="fecha_ingreso" />
      <DateField source="fecha_egreso" />
      <SelectField
        source="activo"
        choices={ESTADO_CHOICES}
      />
      <UrlField source="url_foto" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default NominaShow;
