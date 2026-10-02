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

const filters = buildListFilters(
  [{ type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar cuentas cash", alwaysOn: true } }],
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
  perPage = 25,
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
    <ResponsiveDataTable rowClick={rowClick} mobileConfig={{ primaryField: "descripcion" }}>
      <TextListColumn source="descripcion" label="Descripción">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
