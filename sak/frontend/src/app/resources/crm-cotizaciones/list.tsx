"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar cotizaciones" className="w-full" alwaysOn />,
  <ReferenceInput key="moneda_origen_id" source="moneda_origen_id" reference="monedas" label="Moneda origen">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <ReferenceInput key="moneda_destino_id" source="moneda_destino_id" reference="monedas" label="Moneda destino">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <TextInput key="fecha_vigencia" source="fecha_vigencia" label="Vigencia desde" type="date" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMCotizacionList = () => (
  <List filters={filters} actions={<ListActions />} sort={{ field: "fecha_vigencia", order: "DESC" }} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="moneda_origen_id" label="Origen">
        <ReferenceField source="moneda_origen_id" reference="monedas">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="moneda_destino_id" label="Destino">
        <ReferenceField source="moneda_destino_id" reference="monedas">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="tipo_cambio" label="Tipo de cambio">
        <NumberField source="tipo_cambio" />
      </DataTable.Col>
      <DataTable.Col source="fecha_vigencia" label="Vigencia">
        <TextField source="fecha_vigencia" />
      </DataTable.Col>
      <DataTable.Col source="fuente" label="Fuente">
        <TextField source="fuente" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
