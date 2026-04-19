"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListBoolean,
  ListColumn,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar tipos de propiedad",
        alwaysOn: true,
        className: "w-[140px] sm:w-[180px]",
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
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: [
          { id: true, name: "Si" },
          { id: false, name: "No" },
        ],
        className: "w-full",
      },
    },
  ],
  { keyPrefix: "tipos-propiedad" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type TipoPropiedadListProps = {
  embedded?: boolean;
  perPage?: number;
  rowClick?: "edit" | ((id: string | number) => string);
  createTo?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

export const TipoPropiedadList = ({
  embedded = false,
  perPage = 5,
  rowClick = "edit",
  createTo,
}: TipoPropiedadListProps = {}) => (
  <List
    title="Tipos de propiedad"
    filters={LIST_FILTERS}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    containerClassName={LIST_CONTAINER_WIDE}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["descripcion", "activo"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[50px] text-center">
        <ListID source="id" widthClass="w-[50px]" />
      </ListColumn>
      <ListColumn source="nombre" label="Nombre" className="w-[160px] max-w-[160px]">
        <ListText source="nombre" className="max-w-[160px] whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="descripcion" label="Descripcion" className="w-[220px]">
        <ListText source="descripcion" className="whitespace-normal break-words" />
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
