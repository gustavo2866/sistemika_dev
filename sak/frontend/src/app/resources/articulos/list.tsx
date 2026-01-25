"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { SoloActivasToggleFilter } from "@/components/lists/solo-activas-toggle";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";

const filters = [
  <TextInput key="q" source="q" label="Buscar" placeholder="Buscar articulos" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="sku" source="sku" label="SKU" />,
  <ReferenceInput
    key="tipo_articulo_id"
    source="tipo_articulo_id"
    reference="tipos-articulo"
    label="Tipo articulo"
    alwaysOn
  >
    <SelectInput optionText="nombre" className="w-full" emptyText="Todos" />
  </ReferenceInput>,
  <SoloActivasToggleFilter
    key="activo"
    source="activo"
    label="Activos"
    alwaysOn
    className="ml-auto"
  />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
  </div>
);

const ArticuloBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const ArticuloList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    filterDefaultValues={{ activo: true }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionButtons={<ArticuloBulkActions />}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[80px]">
        <TextField source="id" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="nombre" label="Nombre" className="w-[200px]">
        <TextField source="nombre" className="block max-w-[200px] whitespace-normal break-words" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="tipo_articulo_id" label="Tipo articulo">
        <ReferenceField source="tipo_articulo_id" reference="tipos-articulo">
          <TextField source="nombre" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="unidad_medida" label="Unidad">
        <TextField source="unidad_medida" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="precio" label="Precio">
        <NumberField source="precio" options={{ style: "currency", currency: "ARS" }} />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="proveedor_id" label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="activo"
        label="Activo"
        className="w-[90px] text-center"
        render={(record) => (
          <span className="inline-flex w-full items-center justify-center">
            {(record as { activo?: boolean })?.activo ? "Si" : "No"}
          </span>
        )}
      />
    </ResponsiveDataTable>
  </List>
);
