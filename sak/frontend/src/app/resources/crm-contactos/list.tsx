"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar contactos" className="w-full" alwaysOn />,
  <TextInput key="email" source="email" label="Email" />,
  <ReferenceInput key="origen_lead_id" source="origen_lead_id" reference="crm/catalogos/origenes-lead" label="Origen">
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

export const CRMContactoList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25} debounce={300} sort={{ field: "nombre_completo", order: "ASC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="nombre_completo" label="Nombre">
        <TextField source="nombre_completo" className="whitespace-normal break-words max-w-[240px]" />
      </DataTable.Col>
      <DataTable.Col source="email" label="Email">
        <TextField source="email" className="whitespace-normal break-words max-w-[260px]" />
      </DataTable.Col>
      <DataTable.Col source="telefonos" label="Teléfonos">
        <TextField source="telefonos" className="whitespace-normal break-words max-w-[220px]" />
      </DataTable.Col>
      <DataTable.Col source="origen_lead_id" label="Origen">
        <ReferenceField source="origen_lead_id" reference="crm/catalogos/origenes-lead">
          <TextField source="nombre" />
        </ReferenceField>
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
