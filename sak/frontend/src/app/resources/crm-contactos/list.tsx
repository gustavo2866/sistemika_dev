"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { UserRound } from "lucide-react";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Buscar"
    placeholder="Buscar contactos"
    className="w-[200px]"
    alwaysOn
  />,
  <TextInput key="email" source="email" label="Email" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMContactoList = () => (
  <List
    title={<ResourceTitle icon={UserRound} text="CRM - Contactos" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    debounce={300}
    sort={{ field: "nombre_completo", order: "ASC" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[70px] min-w-[70px]">
        <TextField source="id" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="nombre_completo" label="Nombre" className="min-w-[260px]">
        <TextField source="nombre_completo" className="whitespace-normal break-words max-w-[420px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="email" label="Email">
        <TextField source="email" className="whitespace-normal break-words max-w-[260px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="telefonos" label="Teléfonos">
        <TextField source="telefonos" className="whitespace-normal break-words max-w-[220px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);
