"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { SelectField } from "@/components/select-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { ShowButton } from "@/components/show-button";

const tipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    alwaysOn
    placeholder="Buscar solicitudes"
  />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={tipoChoices}
    emptyText="Todos"
  />,
  <ReferenceInput
    key="solicitante_id"
    source="solicitante_id"
    reference="users"
    label="Responsable"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const SolicitudList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID" className="w-[80px]">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo" className="w-[140px]">
        <SelectField source="tipo" choices={tipoChoices} />
      </DataTable.Col>
      <DataTable.Col source="fecha_necesidad" label="Fecha necesidad" className="w-[160px]">
        <DateField source="fecha_necesidad" />
      </DataTable.Col>
      <DataTable.Col source="solicitante_id" label="Solicitante" className="min-w-[180px]">
        <ReferenceField source="solicitante_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="comentario" label="Comentario" className="min-w-[220px]">
        <TextField source="comentario" />
      </DataTable.Col>
      <DataTable.Col label="Acciones" className="w-[120px]">
        <div className="flex items-center gap-2">
          <EditButton />
          <ShowButton />
        </div>
      </DataTable.Col>
    </DataTable>
  </List>
);
