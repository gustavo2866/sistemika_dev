"use client";

import { BadgeField } from "@/components/badge-field";
import { DateField } from "@/components/date-field";
import { FormOrderEditButton } from "@/components/forms/form_order";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";

export const ErpCuentaShow = () => (
  <Show title="Cuenta ERP" actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ReferenceField source="rubro_id" reference="erp/rubros" label="Rubro">
        <TextField source="nombre" />
      </ReferenceField>
      <NumberField source="nro_cuenta" label="Nro. cuenta" />
      <TextField source="cod_cuenta" label="Codigo" />
      <TextField source="descripcion" label="Descripcion" />
      <ReferenceField
        source="proyectos_concepto_id"
        reference="constructora/proyectos-conceptos"
        label="Concepto"
      >
        <TextField source="nombre" />
      </ReferenceField>
      <BadgeField source="activo" label="Activo" />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default ErpCuentaShow;
