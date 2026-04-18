"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import type { SetupListComponentProps } from "@/components/forms/form_order";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar settings" className="w-full" />,
  <TextInput key="clave" source="clave" label="Clave" />,
  <TextInput key="descripcion" source="descripcion" label="Descripcion" />,
];

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton to={createTo} />
    <ExportButton />
  </div>
);

export const SettingList = ({
  embedded = false,
  rowClick = "edit",
  createTo,
}: SetupListComponentProps) => (
  <List
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={25}
    sort={{ field: "clave", order: "ASC" }}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <DataTable rowClick={rowClick}>
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="clave" label="Clave">
        <TextField source="clave" />
      </DataTable.Col>
      <DataTable.Col source="valor" label="Valor">
        <TextField source="valor" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripcion">
        <TextField source="descripcion" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);