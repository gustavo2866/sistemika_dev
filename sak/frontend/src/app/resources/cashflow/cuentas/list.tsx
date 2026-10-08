"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_SM } from "@/components/list";
import { ERP_CASH_CUENTA_TIPO_CHOICES } from "./model";

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar cuentas cash", alwaysOn: true } },
    {
      type: "select",
      props: {
        source: "tipo",
        label: "Tipo",
        choices: ERP_CASH_CUENTA_TIPO_CHOICES,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "erp-cash-cuentas" },
);

type ErpCashCuentaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <CreateButton label="Crear" to={createTo} />
    <ExportButton label="Exportar" />
  </div>
);

export const ErpCashCuentaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
}: ErpCashCuentaListProps = {}) => (
  <List
    resource="erp/cash/cuentas"
    title="Cuentas Cash"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "descripcion", order: "ASC" }}
    containerClassName={LIST_CONTAINER_SM}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{ primaryField: "descripcion", secondaryFields: ["tipo"] }}
    >
      <TextListColumn source="descripcion" label="Descripción">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="tipo" label="Tipo" className="w-[110px]">
        <ListText source="tipo" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
