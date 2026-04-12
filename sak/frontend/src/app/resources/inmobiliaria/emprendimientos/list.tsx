"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListBoolean,
  ListColumn,
  ListDate,
  ListID,
  ListPaginator,
  ListStatus,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";

import { EMPRENDIMIENTO_ESTADO_CHOICES, EMPRENDIMIENTO_STATUS_BADGES } from "./model";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar emprendimientos",
        alwaysOn: true,
        className: "w-[140px] sm:w-[180px]",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: EMPRENDIMIENTO_ESTADO_CHOICES,
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "emprendimientos" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

type EmprendimientoListProps = {
  perPage?: number;
};

export const EmprendimientoList = ({
  perPage = 25,
}: EmprendimientoListProps = {}) => (
  <List
    title="Emprendimientos"
    filters={LIST_FILTERS}
    actions={<ListActions />}
    debounce={300}
    perPage={perPage}
    containerClassName={LIST_CONTAINER_WIDE}
    pagination={<ListPaginator />}
    sort={{ field: "nombre", order: "ASC" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["estado", "activo"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[50px] text-center">
        <ListID source="id" widthClass="w-[50px]" />
      </ListColumn>
      <ListColumn source="nombre" label="Nombre" className="w-[170px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="estado" label="Estado" className="w-[120px]">
        <ListStatus source="estado" statusClasses={EMPRENDIMIENTO_STATUS_BADGES} />
      </ListColumn>
      <ListColumn source="fecha_inicio" label="Fecha inicio" className="w-[110px]">
        <ListDate source="fecha_inicio" />
      </ListColumn>
      <ListColumn source="fecha_fin_estimada" label="Fecha fin" className="w-[110px]">
        <ListDate source="fecha_fin_estimada" />
      </ListColumn>
      <ListColumn source="activo" label="Activo" className="w-[80px]">
        <ListBoolean source="activo" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
