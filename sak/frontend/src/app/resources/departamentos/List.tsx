"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { BadgeField } from "@/components/badge-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar departamentos" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const DepartamentoList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripción">
        <TextField source="descripcion" />
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


