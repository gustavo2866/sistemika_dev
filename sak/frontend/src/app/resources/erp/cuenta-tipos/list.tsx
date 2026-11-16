"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { ERP_CUENTA_TIPO_IMPUESTO_CHOICES } from "./model";


const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Nombre, descripción o cuenta",
        alwaysOn: true,
      },
    },
    {
      type: "select",
      props: {
        source: "es_impuesto",
        label: "Impuesto",
        choices: ERP_CUENTA_TIPO_IMPUESTO_CHOICES,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "erp-cuenta-tipos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type ErpCuentaTipoListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

export const ErpCuentaTipoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ErpCuentaTipoListProps = {}) => (
  <List
    resource="erp/cuenta-tipos"
    title="Tipos de cuenta ERP"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nombre", order: "ASC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_STANDARD}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["cuenta", "es_impuesto"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre" className="w-[230px]">
        <ListText source="nombre" className="font-medium" />
      </TextListColumn>
      <TextListColumn source="cuenta" label="Cuenta" className="w-[140px]">
        <ListText source="cuenta" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripción">
        <ListText source="descripcion" className="whitespace-normal break-words" empty="-" />
      </TextListColumn>
      <BooleanListColumn source="es_impuesto" label="Impuesto" className="w-[90px]" />
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpCuentaTipoList;
