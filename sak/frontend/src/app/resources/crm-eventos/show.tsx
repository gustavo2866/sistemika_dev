"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";

export const CRMEventoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ReferenceField source="contacto_id" reference="crm/contactos" label="Contacto">
        <TextField source="nombre_completo" />
      </ReferenceField>
      <ReferenceField source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
        <TextField source="id" />
      </ReferenceField>
      <ReferenceField source="tipo_id" reference="crm/catalogos/tipos-evento" label="Tipo">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="motivo_id" reference="crm/catalogos/motivos-evento" label="Motivo">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="origen_lead_id" reference="crm/catalogos/origenes-lead" label="Origen">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="asignado_a_id" reference="users" label="Asignado a">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="fecha_evento" label="Fecha" />
      <TextField source="fecha_compromiso" label="Compromiso" />
      <TextField source="estado_evento" label="Estado" />
      <TextField source="descripcion" label="Descripción" />
      <TextField source="proximo_paso" label="Próximo paso" />
    </SimpleShowLayout>
  </Show>
);
