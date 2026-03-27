"use client";

import { List, LIST_CONTAINER_SM } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListPaginator,
  TextListColumn,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar conceptos",
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
    {
      type: "text",
      props: {
        source: "cuenta",
        label: "Cuenta",
      },
    },
    {
      type: "select",
      props: {
        source: "es_impuesto",
        label: "Impuesto",
        choices: [
          { id: "true", name: "Si" },
          { id: "false", name: "No" },
        ],
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "adm-conceptos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const AdmConceptoList = () => (
  <List
    title="Conceptos"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_SM}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["cuenta", "descripcion", "es_impuesto"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="cuenta" label="Cuenta">
        <ListText source="cuenta" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" />
      </TextListColumn>
      <BooleanListColumn source="es_impuesto" label="Impuesto" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
