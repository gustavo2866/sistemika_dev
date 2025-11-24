# List.template

Copiar como `frontend/src/app/resources/<entidad>/List.tsx`.

```tsx
"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { MY_ENTITY_STATUS_CHOICES } from "./model";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar" alwaysOn className="w-full" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={MY_ENTITY_STATUS_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
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

export const MyEntityList = () => (
  <List filters={filters} actions={<ListActions />} perPage={10} sort={{ field: "created_at", order: "DESC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" className="whitespace-normal break-words max-w-[220px]" />
      </DataTable.Col>
      <DataTable.Col source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
```
