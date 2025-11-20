"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { ArrayField } from "@/components/array-field";
import { SingleFieldList } from "@/components/single-field-list";

export const CRMContactoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre_completo" label="Nombre" />
      <ArrayField source="telefonos">
        <SingleFieldList />
      </ArrayField>
      <TextField source="email" label="Email" />
      <TextField source="red_social" label="Red social" />
      <ReferenceField source="origen_lead_id" reference="crm/catalogos/origenes-lead" label="Origen">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="responsable_id" reference="users" label="Responsable">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="notas" label="Notas" />
    </SimpleShowLayout>
  </Show>
);
