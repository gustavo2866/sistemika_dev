"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { TextInput } from "@/components/text-input";
import { BadgeField } from "@/components/badge-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar estados" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const PoOrderStatusList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripcion">
        <TextField source="descripcion" className="block max-w-[260px] truncate" />
      </DataTable.Col>
      <DataTable.Col source="orden" label="Orden">
        <NumberField source="orden" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Activo">
        <BadgeField source="activo" />
      </DataTable.Col>
      <DataTable.Col source="es_inicial" label="Inicial">
        <BadgeField source="es_inicial" />
      </DataTable.Col>
      <DataTable.Col source="es_final" label="Final">
        <BadgeField source="es_final" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
