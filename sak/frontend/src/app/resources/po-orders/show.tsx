"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { NumberField } from "@/components/number-field";

export const PoOrderShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="titulo" label="Título" />
      <ReferenceField source="solicitante_id" reference="users" label="Solicitante">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" label="Tipo solicitud">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="departamento_id" reference="departamentos" label="Departamento">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="order_status_id" reference="po-order-status" label="Estado">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="proveedor_id" reference="proveedores" label="Proveedor">
        <TextField source="nombre" />
      </ReferenceField>
      <NumberField
        source="total"
        label="Importe"
        options={{ style: "currency", currency: "ARS" }}
      />
      <TextField source="comentario" label="Comentario" />
    </SimpleShowLayout>
  </Show>
);

