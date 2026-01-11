"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { EditButton } from "@/components/edit-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";

const filters = [
  <TextInput key="q" source="q" label="Buscar" placeholder="Buscar articulos" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="sku" source="sku" label="SKU" />,
  <ReferenceInput
    key="tipo_articulo_id"
    source="tipo_articulo_id"
    reference="tipos-articulo"
    label="Tipo articulo"
  >
    <SelectInput optionText="nombre" className="w-full" emptyText="Todos" />
  </ReferenceInput>,
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
      <DataTable.Col source="nombre" label="Nombre" className="w-[200px]">
        <TextField source="nombre" className="block max-w-[200px] whitespace-normal break-words" />
      </DataTable.Col>
      <DataTable.Col source="tipo_articulo_id" label="Tipo articulo">
        <ReferenceField source="tipo_articulo_id" reference="tipos-articulo">
          <TextField source="nombre" />
        </ReferenceField>
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
