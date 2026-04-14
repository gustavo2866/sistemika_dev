"use client";

import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  CompactSoloActivasToggleFilter,
  FormOrderListRowActions,
} from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListPaginator,
  NumberListColumn,
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
        placeholder: "Buscar tipos de actualizacion",
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
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="activa"
          source="activa"
          label="Activas"
          alwaysOn
          className="ml-auto"
        />
      ),
    },
  ],
  { keyPrefix: "tipos-actualizacion" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type TipoActualizacionListProps = {
  embedded?: boolean;
  perPage?: number;
  rowClick?: "edit" | ((id: string | number) => string);
  createTo?: string;
};

export const TipoActualizacionList = ({
  embedded = false,
  perPage = 10,
  rowClick = "edit",
  createTo,
}: TipoActualizacionListProps = {}) => (
  <List
    title="Tipos de actualizacion"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    filterDefaultValues={{ activa: true }}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["cantidad_meses", "activa"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <NumberListColumn source="id" label="ID" className="text-center" />
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <NumberListColumn source="cantidad_meses" label="Meses" className="text-center" />
      <BooleanListColumn source="activa" label="Activa" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
