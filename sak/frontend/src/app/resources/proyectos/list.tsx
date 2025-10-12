"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar proyectos"
    alwaysOn
  />,
  <TextInput key="estado" source="estado" label="Estado" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const ProyectoList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
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
      <DataTable.Col source="fecha_inicio" label="Inicio">
        <DateField source="fecha_inicio" />
      </DataTable.Col>
      <DataTable.Col source="fecha_final" label="Finalizacion">
        <DateField source="fecha_final" />
      </DataTable.Col>
      <DataTable.Col source="importe_mat" label="Importe MAT">
        <NumberField
          source="importe_mat"
          options={{ style: "currency", currency: "ARS" }}
        />
      </DataTable.Col>
      <DataTable.Col source="importe_mo" label="Importe MO">
        <NumberField
          source="importe_mo"
          options={{ style: "currency", currency: "ARS" }}
        />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
