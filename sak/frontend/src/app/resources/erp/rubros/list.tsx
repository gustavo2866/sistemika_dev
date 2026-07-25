"use client";

import { useRecordContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import {
  BooleanListColumn,
  buildListFilters,
  FormOrderListRowActions,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
} from "@/components/forms/form_order";
import { ACTIVO_SELECT_CHOICES, type ErpRubro } from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar rubros",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "nombre",
        label: "Rubro",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: ACTIVO_SELECT_CHOICES,
        emptyText: "Todos",
        alwaysOn: true,
      },
    },
  ],
  { keyPrefix: "erp-rubros" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const CuentasCountField = () => {
  const record = useRecordContext<ErpRubro>();
  const count = Array.isArray(record?.cuentas) ? record.cuentas.length : 0;
  return <span>{count}</span>;
};

type ErpRubroListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

export const ErpRubroList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ErpRubroListProps = {}) => (
  <List
    resource="erp/rubros"
    title="Rubros ERP"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nombre", order: "ASC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_STANDARD}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["activo"],
        detailFields: [
          {
            source: "cuentas",
            format: (value) => `${Array.isArray(value) ? value.length : 0} cuentas`,
          },
        ],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Rubro" className="w-[320px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <NumberListColumn source="cuentas" label="Cuentas" className="w-[90px]">
        <CuentasCountField />
      </NumberListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[90px]" />
      <TextListColumn source="id" label="ID" className="w-[70px]">
        <ListNumber source="id" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[88px]">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
