"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { ShowButton } from "@/components/show-button";
import { categoriaChoices, estadoChoices } from "./constants";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar empleados"
    alwaysOn
  />,
  <SelectInput
    key="categoria"
    source="categoria"
    label="Categoria"
    choices={categoriaChoices}
    emptyText="Todas"
  />,
  <SelectInput
    key="activo"
    source="activo"
    label="Estado"
    choices={estadoChoices}
    emptyText="Todos"
  />,
  <ReferenceInput
    key="idproyecto"
    source="idproyecto"
    reference="proyectos"
    label="Proyecto"
  >
    <SelectInput emptyText="Todos" optionText="nombre" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const NominaList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID" className="w-[70px]">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="nombre" label="Nombre">
        <TextField source="nombre" />
      </DataTable.Col>
      <DataTable.Col source="apellido" label="Apellido">
        <TextField source="apellido" />
      </DataTable.Col>
      <DataTable.Col source="dni" label="DNI">
        <TextField source="dni" />
      </DataTable.Col>
      <DataTable.Col source="categoria" label="Categoria">
        <SelectField source="categoria" choices={categoriaChoices} />
      </DataTable.Col>
      <DataTable.Col source="idproyecto" label="Proyecto">
        <ReferenceField source="idproyecto" reference="proyectos">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="email" label="Email">
        <TextField source="email" />
      </DataTable.Col>
      <DataTable.Col source="telefono" label="Telefono">
        <TextField source="telefono" />
      </DataTable.Col>
      <DataTable.Col source="fecha_ingreso" label="Ingreso">
        <DateField source="fecha_ingreso" />
      </DataTable.Col>
      <DataTable.Col source="salario_mensual" label="Salario">
        <NumberField
          source="salario_mensual"
          options={{ style: "currency", currency: "ARS" }}
        />
      </DataTable.Col>
      <DataTable.Col source="activo" label="Estado">
        <SelectField source="activo" choices={estadoChoices} />
      </DataTable.Col>
      <DataTable.Col className="w-[110px]">
        <div className="flex items-center gap-2">
          <EditButton />
          <ShowButton />
        </div>
      </DataTable.Col>
    </DataTable>
  </List>
);

export default NominaList;
