"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { BadgeField } from "@/components/badge-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar proveedores" alwaysOn />,
  <TextInput key="cuit" source="cuit" label="CUIT" />,
  <BooleanInput key="activo" source="activo" label="Activo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const ProveedorList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="razon_social" label="Razon social">
        <TextField source="razon_social" />
      </DataTable.Col>
      <DataTable.Col source="cuit" label="CUIT">
        <TextField source="cuit" />
      </DataTable.Col>
      <DataTable.Col source="email">
        <TextField source="email" />
      </DataTable.Col>
      <DataTable.Col source="telefono" label="Telefono">
        <TextField source="telefono" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Estado">
        <BadgeField source="activo" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
