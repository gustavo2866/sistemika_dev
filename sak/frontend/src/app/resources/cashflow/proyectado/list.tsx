"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListMoney,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { ERP_CASH_PROYECTADO_TIPO_CHOICES } from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: { source: "q", label: "Buscar", placeholder: "Buscar proyectados", alwaysOn: true },
    },
    {
      type: "reference",
      referenceProps: {
        source: "cuenta_cash_id",
        reference: "erp/cash/cuentas",
        label: "Cuenta financiera",
      },
      selectProps: { optionText: "descripcion", emptyText: "Todas", className: "w-full" },
    },
    {
      type: "select",
      props: {
        source: "tipo",
        label: "Tipo",
        choices: ERP_CASH_PROYECTADO_TIPO_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "text",
      props: { source: "fecha_periodo", label: "Período", type: "date" },
    },
  ],
  { keyPrefix: "erp-cash-proyectado" },
);

type ErpCashProyectadoListProps = {
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

export const ErpCashProyectadoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
}: ErpCashProyectadoListProps = {}) => (
  <List
    resource="erp/cash/proyectado"
    title="Proyectado Cash"
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
      mobileConfig={{ primaryField: "cuenta_cash_id", secondaryFields: ["fecha_periodo", "tipo", "importe"] }}
    >
      <DateListColumn source="fecha_periodo" label="Período" className="w-[105px]">
        <ListDate source="fecha_periodo" />
      </DateListColumn>
      <TextListColumn source="cuenta_cash_id" label="Cuenta financiera" className="w-[220px]">
        <ReferenceField source="cuenta_cash_id" reference="erp/cash/cuentas" link={false}>
          <ListText source="descripcion" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="tipo" label="Tipo" className="w-[125px]">
        <ListText source="tipo" />
      </TextListColumn>
      <NumberListColumn source="importe" label="Importe" className="w-[130px]">
        <ListMoney source="importe" />
      </NumberListColumn>
      <TextListColumn source="observacion" label="Observación">
        <ListText source="observacion" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
