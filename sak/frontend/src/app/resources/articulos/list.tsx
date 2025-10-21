"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { EditButton } from "@/components/edit-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar articulos" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="sku" source="sku" label="SKU" />,
  <TextInput key="tipo_articulo" source="tipo_articulo" label="Tipo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
  </div>
);

const ArticuloBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const ArticuloList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<ArticuloBulkActions />}>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="tipo_articulo" label="Tipo">
        <TextField source="tipo_articulo" />
      </DataTable.Col>
      <DataTable.Col source="unidad_medida" label="Unidad">
        <TextField source="unidad_medida" />
      </DataTable.Col>
      <DataTable.Col source="precio" label="Precio">
        <NumberField source="precio" options={{ style: "currency", currency: "ARS" }} />
      </DataTable.Col>
      <DataTable.Col label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
