"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { BadgeField } from "@/components/badge-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { BooleanInput } from "@/components/boolean-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { ShowButton } from "@/components/show-button";
import { CENTRO_COSTO_TIPO_CHOICES } from "./model";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar centros de costo"
    alwaysOn
  />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={CENTRO_COSTO_TIPO_CHOICES}
    emptyText="Todos"
  />,
  <TextInput
    key="codigo_contable"
    source="codigo_contable"
    label="Código contable"
  />,
  <BooleanInput key="activo" source="activo" label="Solo activos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CentroCostoList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="nombre" label="Nombre" className="min-w-[220px]">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo" className="w-[160px]">
        <BadgeField source="tipo" />
      </DataTable.Col>
      <DataTable.Col source="codigo_contable" label="Código contable" className="w-[180px]">
        <TextField source="codigo_contable" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripción" className="min-w-[260px]">
        <TextField source="descripcion" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Estado" className="w-[140px]">
        <BadgeField source="activo" />
      </DataTable.Col>
      <DataTable.Col source="updated_at" label="Actualizado" className="w-[160px]">
        <DateField source="updated_at" />
      </DataTable.Col>
      <DataTable.Col label="Acciones" className="w-[140px]">
        <div className="flex items-center gap-2">
          <EditButton />
          <ShowButton />
        </div>
      </DataTable.Col>
    </DataTable>
  </List>
);
