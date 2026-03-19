"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";

const filters = [
  <TextInput key="q" source="q" label="Buscar" alwaysOn placeholder="Buscar usuarios" />,
  <TextInput key="email" source="email" label="Email" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const UserList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={10}>
    <ResponsiveDataTable
      rowClick="edit"
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[70px]">
        <TextField source="id" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="nombre" className="w-[160px]">
        <TextField source="nombre" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="email" className="w-[200px]">
        <TextField source="email" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="telefono" className="w-[140px]">
        <TextField source="telefono" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="departamento_id" label="Departamento" className="w-[180px]">
        <ReferenceField source="departamento_id" reference="departamentos">
          <TextField source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);

