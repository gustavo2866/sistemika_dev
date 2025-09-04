"use client";

import { List } from "@/components/list";
// ajustá esta ruta a la que te generó el kit:
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";


const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar usuarios..." alwaysOn />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <CreateButton />
    <ExportButton />
    <FilterButton filters={filters} />
  </div>
);

export const PaisList = () => (
  <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
    <DataTable rowClick="edit">

      <DataTable.Col source="id">       <TextField source="id" />       </DataTable.Col>
      <DataTable.Col source="name">   <TextField source="name" />   </DataTable.Col>

      {/* Botón extra por si preferís editar desde la última columna */}
      <DataTable.Col> <EditButton /> </DataTable.Col>
      
    </DataTable>
  </List>
);