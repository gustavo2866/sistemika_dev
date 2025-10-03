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

const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar solicitudes" alwaysOn />,
  <SelectInput key="tipo" source="tipo" label="Tipo" choices={solicitudTipoChoices} />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
  </div>
);

const SolicitudBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const SolicitudList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<SolicitudBulkActions />}>
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
