"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { BadgeField } from "@/components/badge-field";
import { NumberField } from "@/components/number-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar tipos de operación..." alwaysOn />,
  <TextInput key="codigo" source="codigo" label="Código" placeholder="Filtrar por código" />,
  <TextInput key="descripcion" source="descripcion" label="Descripción" placeholder="Filtrar por descripción" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export default function TiposOperacionList() {
  return (
    <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
      <DataTable rowClick="edit">
        <DataTable.Col source="id">
          <TextField source="id" />
        </DataTable.Col>
        
        <DataTable.Col source="codigo">
          <TextField source="codigo" />
        </DataTable.Col>
        
        <DataTable.Col source="descripcion">
          <TextField source="descripcion" />
        </DataTable.Col>
        
        <DataTable.Col label="Requiere IVA">
          <BadgeField source="requiere_iva" />
        </DataTable.Col>
        
        <DataTable.Col source="porcentaje_iva_default">
          <NumberField source="porcentaje_iva_default" />
        </DataTable.Col>
        
        <DataTable.Col source="cuenta_contable">
          <TextField source="cuenta_contable" />
        </DataTable.Col>
        
        <DataTable.Col label="Activo">
          <BadgeField source="activo" />
        </DataTable.Col>

        <DataTable.Col>
          <EditButton />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
