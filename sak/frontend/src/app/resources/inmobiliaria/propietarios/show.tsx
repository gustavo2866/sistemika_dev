"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { ReferenceField } from "@/components/reference-field";
import { CENTROS_COSTO_REFERENCE, CONCEPTOS_REFERENCE } from "./model";

export const PropietarioShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nombre" label="Nombre" />
      <ReferenceField
        source="adm_concepto_id"
        reference={CONCEPTOS_REFERENCE.resource}
        label="Concepto administrativo"
      >
        <TextField source={CONCEPTOS_REFERENCE.labelField} />
      </ReferenceField>
      <ReferenceField
        source="centro_costo_id"
        reference={CENTROS_COSTO_REFERENCE.resource}
        label="Centro de costo"
      >
        <TextField source={CENTROS_COSTO_REFERENCE.labelField} />
      </ReferenceField>
      <TextField source="comentario" label="Comentario" />
      <BadgeField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);
