"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";

export const FacturaShow = () => (
  <Show>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField source="numero" label="Numero" />
      <TextField source="punto_venta" label="Punto de venta" />
      <ReferenceField source="id_tipocomprobante" reference="tipos-comprobante" label="Tipo">
        <TextField source="name" />
      </ReferenceField>
      <TextField source="estado" label="Estado" />
      <ReferenceField source="proveedor_id" reference="proveedores" label="Proveedor">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="usuario_responsable_id" reference="users" label="Usuario responsable">
        <TextField source="nombre" />
      </ReferenceField>
      <ReferenceField source="tipo_operacion_id" reference="tipos-operacion" label="Tipo de operacion">
        <TextField source="descripcion" />
      </ReferenceField>
      <TextField source="fecha_emision" label="Fecha de emision" />
      <TextField source="fecha_vencimiento" label="Fecha de vencimiento" />
      <NumberField source="subtotal" label="Subtotal" options={{ style: "currency", currency: "ARS" }} />
      <NumberField source="total_impuestos" label="Total impuestos" options={{ style: "currency", currency: "ARS" }} />
      <NumberField source="total" label="Total" options={{ style: "currency", currency: "ARS" }} />
      <TextField source="nombre_archivo_pdf" label="Nombre de archivo" />
    </div>
    <TextField source="observaciones" label="Observaciones" />
  </Show>
);
