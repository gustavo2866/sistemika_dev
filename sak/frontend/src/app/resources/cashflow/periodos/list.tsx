"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListNumber,
  ListPaginator,
  ListStatus,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { ERP_CASH_PERIODO_ESTADO_CHOICES } from "./model";

const filters = buildListFilters(
  [
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: ERP_CASH_PERIODO_ESTADO_CHOICES,
        emptyText: "Todos",
        alwaysOn: true,
      },
    },
    {
      type: "text",
      props: { source: "fecha_periodo", label: "Período", type: "date" },
    },
  ],
  { keyPrefix: "erp-cash-periodos" },
);

type ErpCashPeriodoListProps = {
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

const statusClasses = {
  abierto: "border-amber-200 bg-amber-50 text-amber-700",
  cerrado: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const ErpCashPeriodoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
}: ErpCashPeriodoListProps = {}) => (
  <List
    resource="erp/cash/periodos"
    title="Períodos Cash"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "fecha_periodo", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD_PLUS}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "fecha_periodo",
        secondaryFields: ["estado", "movimientos_count", "saldos_count"],
      }}
    >
      <DateListColumn source="fecha_periodo" label="Período" className="w-[110px]">
        <ListDate source="fecha_periodo" options={{ year: "numeric", month: "long", timeZone: "UTC" }} />
      </DateListColumn>
      <TextListColumn source="estado" label="Estado" className="w-[105px]">
        <ListStatus source="estado" statusClasses={statusClasses} />
      </TextListColumn>
      <DateListColumn source="ultima_sincronizacion" label="Última sincronización" className="w-[160px]">
        <ListDate source="ultima_sincronizacion" showTime empty="-" />
      </DateListColumn>
      <NumberListColumn source="movimientos_count" label="Movimientos" className="w-[105px]">
        <ListNumber source="movimientos_count" />
      </NumberListColumn>
      <NumberListColumn source="saldos_count" label="Saldos" className="w-[80px]">
        <ListNumber source="saldos_count" />
      </NumberListColumn>
      <DateListColumn source="cerrado_en" label="Cerrado el" className="w-[150px]">
        <ListDate source="cerrado_en" showTime empty="-" />
      </DateListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
