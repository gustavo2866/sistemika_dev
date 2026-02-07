"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { NumberField } from "@/components/number-field";

export const PoOrderList = () => (
  <List perPage={10}>
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "titulo",
        secondaryFields: ["solicitante_id", "tipo_solicitud_id"],
        detailFields: [
          { source: "proveedor_id", reference: "proveedores", referenceField: "nombre" },
          { source: "total", type: "number" },
        ],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[70px]">
        <TextField source="id" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="titulo" label="Título" className="min-w-[220px]">
        <TextField source="titulo" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="solicitante_id" label="Solicitante" className="min-w-[180px]">
        <ReferenceField source="solicitante_id" reference="users">
          <TextField source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="tipo_solicitud_id" label="Tipo solicitud" className="min-w-[180px]">
        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud">
          <TextField source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="proveedor_id" label="Proveedor" className="min-w-[180px]">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="total" label="Importe" className="w-[120px] text-right">
        <NumberField
          source="total"
          options={{ style: "currency", currency: "ARS" }}
          className="whitespace-nowrap"
        />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);

