"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List, LIST_CONTAINER_SM } from "@/components/list";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { ERP_INDICE_CODIGO_CHOICES } from "./model";

const filters = buildListFilters(
  [
    {
      type: "select",
      props: {
        source: "codigo",
        label: "Código",
        choices: ERP_INDICE_CODIGO_CHOICES,
        emptyText: "Todos",
        alwaysOn: true,
      },
    },
    {
      type: "text",
      props: {
        source: "fecha",
        label: "Fecha",
        type: "date",
      },
    },
  ],
  { keyPrefix: "erp-indices" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type ErpIndiceListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

export const ErpIndiceList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ErpIndiceListProps = {}) => (
  <List
    resource="erp/indices"
    title="Índices ERP"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_SM}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "codigo",
        secondaryFields: ["fecha", "valor"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="codigo" label="Código" className="w-[90px]">
        <ListText source="codigo" className="font-semibold" />
      </TextListColumn>
      <DateListColumn source="fecha" label="Fecha" className="w-[120px]">
        <ListDate source="fecha" options={{ timeZone: "UTC" }} />
      </DateListColumn>
      <NumberListColumn source="valor" label="Valor" className="w-[160px] text-right">
        <ListNumber
          source="valor"
          options={{ minimumFractionDigits: 6, maximumFractionDigits: 6 }}
          className="font-medium"
        />
      </NumberListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpIndiceList;
