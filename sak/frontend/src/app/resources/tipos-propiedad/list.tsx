"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { BadgeField } from "@/components/badge-field";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar tipos de propiedad" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <BooleanInput key="activo" source="activo" label="Activo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const TipoPropiedadList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripcion">
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

