"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List, LIST_CONTAINER_SM } from "@/components/list";
import {
  BooleanListColumn,
  buildListFilters,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar macrorubros",
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
  { keyPrefix: "proyectos-macrorubros" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type ProyectoMacrorubroListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ProyectoMacrorubroList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ProyectoMacrorubroListProps = {}) => (
  <List
    title="Macrorubros de proyecto"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nombre", order: "ASC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_SM}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
