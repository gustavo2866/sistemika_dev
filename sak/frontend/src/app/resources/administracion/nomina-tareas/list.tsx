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
        placeholder: "Buscar tareas",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "codigo",
        label: "Codigo",
      },
    },
    {
      type: "text",
      props: {
        source: "descripcion",
        label: "Descripcion",
      },
    },
  ],
  { keyPrefix: "nomina-tareas" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const LIST_MOBILE_CONFIG = {
  primaryField: "descripcion",
  secondaryFields: ["codigo", "activa"],
};

type NominaTareaListProps = {
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

export const NominaTareaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: NominaTareaListProps = {}) => (
  <List
    resource="nomina-tareas"
    title="Tareas de nomina"
    filters={LIST_FILTERS}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "codigo", order: "ASC" }}
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
      <TextListColumn source="codigo" label="Codigo" className="w-[100px]">
        <ListText source="codigo" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activa" label="Activa" className="w-[70px]" />
      <TextListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default NominaTareaList;
