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
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar items..." alwaysOn />,
  <TextInput key="name" source="name" label="Nombre" placeholder="Filtrar por nombre" />,
  <TextInput key="description" source="description" label="Descripción" placeholder="Filtrar por descripción" />,
  <ReferenceInput key="user_id" source="user_id" reference="users" label="Usuario">
    <SelectInput emptyText="Seleccionar usuario" optionText="nombre" />
  </ReferenceInput>,
  <ReferenceInput key="user_pais_id" source="user.pais_id" reference="paises" label="País">
    <SelectInput emptyText="Seleccionar país" optionText="name" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const ItemList = () => (
  <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
    {/* 👉 hace que el click en la fila abra la vista de edición */}
    <DataTable rowClick="edit">
      <DataTable.Col source="id">       <TextField source="id" />       </DataTable.Col>
      <DataTable.Col source="name">     <TextField source="name" />     </DataTable.Col>
      <DataTable.Col source="description"> <TextField source="description" /> </DataTable.Col>
      <DataTable.Col label="Usuario">
        <ReferenceField source="user_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="País">
        <TextField source="user.pais.name" />
      </DataTable.Col>

      {/* Botón extra por si preferís editar desde la última columna */}
      <DataTable.Col> <EditButton /> </DataTable.Col>

    </DataTable>
  </List>
);
