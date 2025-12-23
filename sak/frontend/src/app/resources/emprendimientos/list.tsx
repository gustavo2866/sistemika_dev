"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const estadoChoices = [
  { id: "planificacion", name: "Planificación" },
  { id: "construccion", name: "Construcción" },
  { id: "finalizado", name: "Finalizado" },
  { id: "cancelado", name: "Cancelado" },
];

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar emprendimientos" className="w-full" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={estadoChoices} emptyText="Todos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const EmprendimientoList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25} sort={{ field: "nombre", order: "ASC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <TextField source="estado" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Activo">
        <TextField source="activo" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
