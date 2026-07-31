"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  BooleanListColumn,
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
import { ReferenceField } from "@/components/reference-field";
import { ACTIVO_SELECT_CHOICES } from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar cuentas",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "rubro_id",
        reference: "erp/rubros",
        label: "Rubro",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "proyectos_concepto_id",
        reference: "constructora/proyectos-conceptos",
        label: "Concepto",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "text",
      props: {
        source: "cod_cuenta",
        label: "Codigo",
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
  { keyPrefix: "erp-cuentas" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type ErpCuentaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex flex-wrap items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ErpCuentaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: ErpCuentaListProps = {}) => (
  <List
    resource="erp/cuentas"
    title="Cuentas ERP"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nro_cuenta", order: "ASC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_STANDARD_PLUS}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "descripcion",
        secondaryFields: ["cod_cuenta", "rubro_id", "activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="rubro_id" label="Rubro" className="w-[170px]">
        <ReferenceField source="rubro_id" reference="erp/rubros" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <NumberListColumn source="nro_cuenta" label="Nro." className="w-[70px]">
        <ListNumber source="nro_cuenta" />
      </NumberListColumn>
      <TextListColumn source="cod_cuenta" label="Codigo" className="w-[120px]">
        <ListText source="cod_cuenta" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="proyectos_concepto_id" label="Concepto" className="w-[150px]">
        <ReferenceField source="proyectos_concepto_id" reference="constructora/proyectos-conceptos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpCuentaList;
