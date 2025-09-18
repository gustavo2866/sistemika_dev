"use client";

import { List } from "@/components/list";
// ajustá esta ruta a la que te generó el kit:
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { EditButton } from "@/components/edit-button";
import { AvatarCell } from "@/app/admin/components/cells/avatar-cell";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceField } from "@/components/reference-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar usuarios..." alwaysOn />,
  <TextInput key="email" source="email" label="Email" placeholder="Filtrar por email" />,
  <TextInput key="telefono" source="telefono" label="Teléfono" placeholder="Filtrar por teléfono" />,
  <ReferenceInput key="pais_id" source="pais_id" reference="paises" label="País">
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

export const UserList = () => (
  <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
    {/* 👉 hace que el click en la fila abra la vista de edición */}
    <DataTable rowClick="edit">
      <DataTable.Col source="id">       <TextField source="id" />       </DataTable.Col>


      {/* En vez de mostrar la URL cruda, renderizamos un avatar */}
      <DataTable.Col label="Foto">
        <AvatarCell nameSource="nombre" urlSource="url_foto" />
      </DataTable.Col>

      <DataTable.Col source="nombre">   <TextField source="nombre" />   </DataTable.Col>
      <DataTable.Col source="telefono"> <TextField source="telefono" /> </DataTable.Col>
      <DataTable.Col source="email">    <TextField source="email" />    </DataTable.Col>
      <DataTable.Col label="País">
        <ReferenceField source="pais_id" reference="paises">
          <TextField source="name" />
        </ReferenceField>
      </DataTable.Col>

      {/* Botón extra por si preferís editar desde la última columna */}
      <DataTable.Col> <EditButton /> </DataTable.Col>
      
    </DataTable>
  </List>
);
