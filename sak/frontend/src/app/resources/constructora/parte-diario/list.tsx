"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { ShowButton } from "@/components/show-button";
import { useRecordContext } from "ra-core";
import { estadoParteChoices } from "./constants";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar partes diarios"
    alwaysOn
  />,
  <ReferenceInput
    key="idproyecto"
    source="idproyecto"
    reference="proyectos"
    label="Proyecto"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={estadoParteChoices}
    emptyText="Todos"
  />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const DetalleCountField = () => {
  const record = useRecordContext<{ detalles?: Array<unknown> }>();
  const count = Array.isArray(record?.detalles) ? record!.detalles.length : 0;
  return <span>{count}</span>;
};

export const ParteDiarioList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="fecha" label="Fecha">
        <DateField source="fecha" />
      </DataTable.Col>
      <DataTable.Col label="Proyecto">
        <ReferenceField source="idproyecto" reference="proyectos">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <SelectField source="estado" choices={estadoParteChoices} />
      </DataTable.Col>
      <DataTable.Col source="descripcion" label="Descripción">
        <TextField source="descripcion" />
      </DataTable.Col>
      <DataTable.Col label="Registros">
        <DetalleCountField />
      </DataTable.Col>
      <DataTable.Col className="w-[130px]">
        <div className="flex items-center gap-2">
          <EditButton />
          <ShowButton />
        </div>
      </DataTable.Col>
    </DataTable>
  </List>
);

export default ParteDiarioList;
