"use client";

import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  buildListFilters,
  BooleanListColumn,
  NumberListColumn,
  TextListColumn,
  ListPaginator,
  ListText,
  ListTextarea,
  ResponsiveDataTable,
} from "@/components/forms/form_order";

const filters = buildListFilters(
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
        source: "nombre",
        label: "Nombre",
      },
    },
  ],
  { keyPrefix: "po-invoice-status" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: ["orden", "descripcion", "activo", "es_inicial", "es_final"],
};

type PoInvoiceStatusListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const PoInvoiceStatusList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
}: PoInvoiceStatusListProps = {}) => (
  <List
    title="Estados de Factura OC"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "orden", order: "ASC" }}
    containerClassName="max-w-[720px] w-full mr-auto"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={listMobileConfig}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre" className="w-[90px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListTextarea source="descripcion" maxLength={60} />
      </TextListColumn>
      <NumberListColumn source="orden" label="Orden" className="text-center" />
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <BooleanListColumn source="es_inicial" label="Inicial" className="w-[70px]" />
      <BooleanListColumn source="es_final" label="Final" className="w-[70px]" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
