"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";

const filters = [
  <TextInput key="q" source="q" label="Buscar" placeholder="Buscar departamentos" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const DepartamentoList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    containerClassName="lg:max-w-[960px]"
  >
    <ResponsiveDataTable
      rowClick="edit"
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="Id" className="w-[60px] text-center">
        <TextField source="id" className="inline-block w-full text-center" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="nombre" className="w-[120px]">
        <TextField source="nombre" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="descripcion" label="Descripcion" className="w-[220px]">
        <TextField source="descripcion" className="whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="centro_costo_id"
        label="Centro de costo"
        className="w-[160px] whitespace-normal break-words"
      >
        <ReferenceField source="centro_costo_id" reference="centros-costo">
          <TextField source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="activo"
        label="Activo"
        className="w-[90px] text-center"
        render={(record) => (
          <span className="inline-flex w-full items-center justify-center">
            {(record as { activo?: boolean })?.activo ? "SI" : "NO"}
          </span>
        )}
      />
    </ResponsiveDataTable>
  </List>
);
