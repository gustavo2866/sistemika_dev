"use client";

import { List, LIST_CONTAINER_SM } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";

const LIST_FILTERS = buildListFilters(
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
        source: "abreviatura",
        label: "Abreviatura",
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
  { keyPrefix: "parte-diario-estados" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const LIST_MOBILE_CONFIG = {
  primaryField: "nombre",
  secondaryFields: ["abreviatura", "activo"],
};

type ParteDiarioEstadoListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
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

export const ParteDiarioEstadoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ParteDiarioEstadoListProps = {}) => (
  <List
    resource="parte-diario-estados"
    title="Estados de parte diario"
    filters={LIST_FILTERS}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "ASC" }}
    containerClassName={LIST_CONTAINER_SM}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={LIST_MOBILE_CONFIG}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="abreviatura" label="Abreviatura" className="w-[100px]">
        <ListText source="abreviatura" />
      </TextListColumn>
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <TextListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ParteDiarioEstadoList;
