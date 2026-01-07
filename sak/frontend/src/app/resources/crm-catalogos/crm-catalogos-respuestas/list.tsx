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

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar respuestas" className="w-full" />,
  <TextInput key="titulo" source="titulo" label="Titulo" />,
  <BooleanInput key="activo" source="activo" label="Solo activos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMCatalogoRespuestaList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={10} sort={{ field: "titulo", order: "ASC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="titulo" label="Titulo">
        <TextField source="titulo" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Activo">
        <TextField source="activo" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
