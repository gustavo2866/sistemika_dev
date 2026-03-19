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
  <TextInput key="q" source="q" label={false} placeholder="Buscar monedas" className="w-full" />,
  <TextInput key="codigo" source="codigo" label="Código" />,
  <BooleanInput key="es_moneda_base" source="es_moneda_base" label="Solo moneda base" />,
  <BooleanInput key="activo" source="activo" label="Solo activas" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const MonedaList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25} sort={{ field: "codigo", order: "ASC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="codigo" label="Código">
        <TextField source="codigo" />
      </DataTable.Col>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="simbolo" label="Símbolo">
        <TextField source="simbolo" />
      </DataTable.Col>
      <DataTable.Col source="es_moneda_base" label="Es base">
        <TextField source="es_moneda_base" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Activa">
        <TextField source="activo" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
