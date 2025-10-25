"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { EditButton } from "@/components/edit-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";

import { solicitudMbTipoChoices } from "./form";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar solicitudes"
    alwaysOn
  />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={solicitudMbTipoChoices}
  />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
  </div>
);

const SolicitudMbBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const SolicitudMbList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    perPage={25}
    sort={{ field: "id", order: "DESC" }}
  >
    <DataTable rowClick="edit" bulkActionButtons={<SolicitudMbBulkActions />}>
      <DataTable.Col source="id" label="ID" />
      <DataTable.Col source="tipo" label="Tipo">
        <TextField source="tipo" />
      </DataTable.Col>
      <DataTable.Col source="fecha_necesidad" label="Fecha Necesidad">
        <DateField source="fecha_necesidad" />
      </DataTable.Col>
      <DataTable.Col label="Solicitante">
        <ReferenceField source="solicitante_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="comentario" label="Comentario">
        <TextField source="comentario" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
