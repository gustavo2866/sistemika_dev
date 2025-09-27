"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { BadgeField } from "@/components/badge-field";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar tipos de operacion" alwaysOn />,
  <TextInput key="codigo" source="codigo" label="Codigo" />,
  <BooleanInput key="activo" source="activo" label="Activo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const TipoOperacionList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="codigo" label="Codigo">
        <TextField source="codigo" />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripcion">
        <TextField source="descripcion" />
      </DataTable.Col>
      <DataTable.Col source="requiere_iva" label="Requiere IVA">
        <BadgeField source="requiere_iva" />
      </DataTable.Col>
      <DataTable.Col source="porcentaje_iva_default" label="IVA por defecto">
        <NumberField source="porcentaje_iva_default" options={{ style: "decimal", maximumFractionDigits: 2 }} />
      </DataTable.Col>
      <DataTable.Col source="cuenta_contable" label="Cuenta contable">
        <TextField source="cuenta_contable" />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Estado">
        <BadgeField source="activo" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
