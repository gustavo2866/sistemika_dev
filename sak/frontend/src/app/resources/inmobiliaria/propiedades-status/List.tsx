"use client";

import { List, LIST_CONTAINER_SM } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  buildListFilters,
  BooleanListColumn,
  NumberListColumn,
  TextListColumn,
  ListPaginator,
  ListText,
  ListTextarea,
  ResponsiveDataTable,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar estados",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "nombre",
        label: "Nombre",
      },
    },
  ],
  { keyPrefix: "propiedades-status" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const PropiedadesStatusList = () => (
  <List
    title="Estados de Propiedad"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "orden", order: "ASC" }}
    containerClassName={LIST_CONTAINER_SM}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["orden", "descripcion", "activo", "es_inicial", "es_final"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListTextarea source="descripcion" maxLength={60} />
      </TextListColumn>
      <NumberListColumn source="orden" label="Orden" className="text-center" />
      <BooleanListColumn source="activo" label="Activo" />
      <BooleanListColumn source="es_inicial" label="Inicial" />
      <BooleanListColumn source="es_final" label="Final" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
