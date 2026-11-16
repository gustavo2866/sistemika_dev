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
import { List, LIST_CONTAINER_SM } from "@/components/list";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar empresas",
        alwaysOn: true,
      },
    },
    { type: "text", props: { source: "grupo", label: "Grupo" } },
  ],
  { keyPrefix: "erp-empresas" },
);

type ErpEmpresaListProps = {
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

export const ErpEmpresaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
}: ErpEmpresaListProps = {}) => (
  <List
    resource="erp/empresas"
    title="Empresas ERP"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "empresa_nombre", order: "ASC" }}
    containerClassName={LIST_CONTAINER_SM}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{ primaryField: "empresa_nombre", secondaryFields: ["empresa_id", "grupo"] }}
    >
      <NumberListColumn source="empresa_id" label="ID ERP" className="w-[90px]">
        <ListNumber source="empresa_id" />
      </NumberListColumn>
      <TextListColumn source="empresa_nombre" label="Nombre">
        <ListText source="empresa_nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="grupo" label="Grupo" className="w-[140px]">
        <ListText source="grupo" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpEmpresaList;
