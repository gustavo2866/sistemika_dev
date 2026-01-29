"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { BadgeField } from "@/components/badge-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { BooleanInput } from "@/components/boolean-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { CENTRO_COSTO_TIPO_CHOICES } from "./model";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Buscar"
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
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={10}>
    <ResponsiveDataTable
      rowClick="edit"
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[70px]">
        <TextField source="id" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="nombre" label="Nombre" className="w-[220px]">
        <TextField source="nombre" className="block max-w-[220px] truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="tipo" label="Tipo" className="w-[120px]">
        <BadgeField source="tipo" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="codigo_contable" label="Código contable" className="w-[140px]">
        <TextField source="codigo_contable" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="descripcion"
        label="DescripciИn"
        className="w-[260px]"
        headerClassName="whitespace-normal break-words"
      >
        <TextField source="descripcion" className="block max-w-[260px] truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="activo"
        label="Activo"
        className="w-[100px] text-center"
        headerClassName="text-center"
        render={(record) => (record?.activo ? "SI" : "NO")}
      />
    </ResponsiveDataTable>
  </List>
);







