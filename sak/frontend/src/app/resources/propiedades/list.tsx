"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { EditButton } from "@/components/edit-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="tipo" source="tipo" label="Tipo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
  </div>
);

const PropiedadBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const PropiedadList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<PropiedadBulkActions />}>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo">
        <TextField source="tipo" />
      </DataTable.Col>
      <DataTable.Col source="propietario" label="Propietario">
        <TextField source="propietario" />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <TextField source="estado" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
