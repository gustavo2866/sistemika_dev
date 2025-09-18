"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { BadgeField } from "@/components/badge-field";
import { ReferenceField } from "@/components/reference-field";

export const FacturaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="numero" />
      <TextField source="punto_venta" />
      <TextField source="tipo_comprobante" />
      <DateField source="fecha_emision" />
      <DateField source="fecha_vencimiento" />
      
      <ReferenceField source="proveedor_id" reference="proveedores">
        <TextField source="nombre" />
      </ReferenceField>
      
      <ReferenceField source="tipo_operacion_id" reference="tipos-operacion">
        <TextField source="descripcion" />
      </ReferenceField>
      
      <ReferenceField source="usuario_responsable_id" reference="users">
        <TextField source="nombre" />
      </ReferenceField>
      
      <NumberField source="subtotal" options={{ style: 'currency', currency: 'ARS' }} />
      <NumberField source="total_impuestos" options={{ style: 'currency', currency: 'ARS' }} />
      <NumberField source="total" options={{ style: 'currency', currency: 'ARS' }} />
      
      <BadgeField source="estado" />
      <TextField source="observaciones" />
      
      <TextField source="nombre_archivo_pdf" />
      <BadgeField source="extraido_por_ocr" />
      <BadgeField source="extraido_por_llm" />
      <NumberField source="confianza_extraccion" />
    </SimpleShowLayout>
  </Show>
);
