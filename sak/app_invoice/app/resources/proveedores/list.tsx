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

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar proveedores..." alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" placeholder="Filtrar por nombre" />,
  <TextInput key="cuit" source="cuit" label="CUIT" placeholder="Filtrar por CUIT" />,
  <TextInput key="razon_social" source="razon_social" label="Razón Social" placeholder="Filtrar por razón social" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export default function ProveedoresList() {
  return (
    <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
      <DataTable rowClick="edit">
        <DataTable.Col source="id">
          <TextField source="id" />
        </DataTable.Col>
        
        <DataTable.Col source="nombre">
          <TextField source="nombre" />
        </DataTable.Col>
        
        <DataTable.Col source="razon_social">
          <TextField source="razon_social" />
        </DataTable.Col>
        
        <DataTable.Col source="cuit">
          <TextField source="cuit" />
        </DataTable.Col>
        
        <DataTable.Col source="telefono">
          <TextField source="telefono" />
        </DataTable.Col>
        
        <DataTable.Col source="email">
          <TextField source="email" />
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
