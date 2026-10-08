"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar subcuentas", alwaysOn: true } },
    { type: "text", props: { source: "categoria", label: "Categoría", alwaysOn: true } },
  ],
  { keyPrefix: "erp-cash-subctas" },
);

type ErpCashSubctaListProps = { embedded?: boolean; rowClick?: any; perPage?: number; createTo?: string };

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <CreateButton label="Crear" to={createTo} />
    <ExportButton label="Exportar" />
  </div>
);

export const ErpCashSubctaList = ({ embedded = false, rowClick = "edit", perPage = 10, createTo }: ErpCashSubctaListProps = {}) => (
  <List
    resource="erp/cash/subctas"
    title="Subcuentas Cash"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nro_subcta", order: "ASC" }}
    containerClassName={LIST_CONTAINER_STANDARD_PLUS}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable rowClick={rowClick} mobileConfig={{ primaryField: "descripcion", secondaryFields: ["nro_subcta", "categoria"] }}>
      <NumberListColumn source="tpo_subcta" label="Tipo" className="w-[80px]"><ListNumber source="tpo_subcta" /></NumberListColumn>
      <NumberListColumn source="nro_subcta" label="Nro." className="w-[90px]"><ListNumber source="nro_subcta" /></NumberListColumn>
      <TextListColumn source="descripcion" label="Descripción"><ListText source="descripcion" className="whitespace-normal break-words" /></TextListColumn>
      <TextListColumn source="categoria" label="Categoría" className="w-[130px]"><ListText source="categoria" /></TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]"><FormOrderListRowActions showShow={false} /></TextListColumn>
    </ResponsiveDataTable>
  </List>
);
