"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";

export const ArticuloShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nombre" label="Nombre" />
      <TextField source="tipo_articulo" label="Tipo" />
      <TextField source="unidad_medida" label="Unidad de medida" />
      <TextField source="marca" label="Marca" />
      <TextField source="sku" label="SKU" />
      <NumberField source="precio" label="Precio" options={{ style: "currency", currency: "ARS" }} />
      <ReferenceField source="proveedor_id" reference="proveedores" label="Proveedor">
        <TextField source="nombre" />
      </ReferenceField>
    </SimpleShowLayout>
  </Show>
);
