"use client";

import { List } from "@/components/list";
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
import { BadgeField } from "@/components/badge-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar tareas..." alwaysOn />,
  <TextInput key="titulo" source="titulo" label="Título" placeholder="Filtrar por título" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={[
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'en_progreso', name: 'En Progreso' },
    { id: 'completada', name: 'Completada' },
    { id: 'cancelada', name: 'Cancelada' }
  ]} />,
  <SelectInput key="prioridad" source="prioridad" label="Prioridad" choices={[
    { id: 'baja', name: 'Baja' },
    { id: 'media', name: 'Media' },
    { id: 'alta', name: 'Alta' },
    { id: 'urgente', name: 'Urgente' }
  ]} />,
  <ReferenceInput key="user_id" source="user_id" reference="users" label="Usuario">
    <SelectInput emptyText="Seleccionar usuario" optionText="nombre" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const TareaList = () => (
  <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id">
        <TextField source="id" />
      </DataTable.Col>
      
      <DataTable.Col source="titulo">
        <TextField source="titulo" />
      </DataTable.Col>
      
      <DataTable.Col label="Estado">
        <BadgeField source="estado" />
      </DataTable.Col>
      
      <DataTable.Col label="Prioridad">
        <BadgeField source="prioridad" />
      </DataTable.Col>
      
      <DataTable.Col label="Usuario">
        <ReferenceField source="user_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      
      <DataTable.Col source="fecha_vencimiento">
        <TextField source="fecha_vencimiento" />
      </DataTable.Col>

      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
