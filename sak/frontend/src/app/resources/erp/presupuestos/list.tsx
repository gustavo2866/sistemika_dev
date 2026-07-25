"use client";

import { useRecordContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_XL } from "@/components/list";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";

import type { ErpPresupuesto } from "./model";

const MoneyField = ({ source }: { source: string }) => (
  <NumberField
    source={source}
    options={{ style: "currency", currency: "ARS" }}
    className="whitespace-nowrap text-right tabular-nums"
  />
);

const DecimalField = ({ source }: { source: string }) => (
  <NumberField
    source={source}
    options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
    className="whitespace-nowrap text-right tabular-nums"
  />
);

const ErpCuentaField = () => {
  const record = useRecordContext<ErpPresupuesto>();
  const cuenta = record?.erp_cuenta;
  const label = [cuenta?.cod_cuenta, cuenta?.descripcion].filter(Boolean).join(" - ");
  return (
    <span className="whitespace-normal break-words">
      {label || (record?.erp_cuenta_id ? `#${record.erp_cuenta_id}` : "")}
    </span>
  );
};

const ErpRubroField = () => {
  const record = useRecordContext<ErpPresupuesto>();
  return (
    <span className="whitespace-normal break-words">
      {record?.erp_cuenta?.rubro?.nombre ?? ""}
    </span>
  );
};

export const ERP_PRESUPUESTO_LIST_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "proyecto_id",
        reference: "proyectos",
        label: "Proyecto",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha",
        label: "Fecha",
        type: "date",
        alwaysOn: true,
      },
    },
    {
      type: "text",
      props: {
        source: "erp_cuenta_id",
        label: "Cuenta ID",
        className: "w-[110px]",
      },
    },
  ],
  { keyPrefix: "erp-presupuestos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={ERP_PRESUPUESTO_LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ErpPresupuestoList = () => (
  <List
    resource="erp/presupuestos"
    title="Presupuestos ERP"
    filters={ERP_PRESUPUESTO_LIST_FILTERS}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_XL}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionButtons={false}
      mobileConfig={{
        primaryField: "proyecto_id",
        secondaryFields: ["fecha", "erp_cuenta_id", "ingres", "egreso"],
      }}
      className="text-[9px] [&_th]:text-[9px] [&_td]:text-[9px] xl:text-[10px] xl:[&_th]:text-[10px] xl:[&_td]:text-[10px]"
    >
      <ListColumn source="proyecto_id" label="Proyecto" className="w-[170px] xl:w-[190px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words max-w-[160px] xl:max-w-[190px]" />
        </ReferenceField>
      </ListColumn>
      <DateListColumn source="fecha" label="Fecha" className="w-[76px]" />
      <ListColumn label="Rubro" className="w-[130px]">
        <ErpRubroField />
      </ListColumn>
      <ListColumn source="erp_cuenta_id" label="Cuenta" className="w-[210px]">
        <ErpCuentaField />
      </ListColumn>
      <ListColumn source="ingres" label="Ingresos" className="w-[110px] text-right">
        <MoneyField source="ingres" />
      </ListColumn>
      <ListColumn source="egreso" label="Egresos" className="w-[110px] text-right">
        <MoneyField source="egreso" />
      </ListColumn>
      <ListColumn source="obreros_cantidad" label="Obr." className="w-[70px] text-right">
        <DecimalField source="obreros_cantidad" />
      </ListColumn>
      <ListColumn source="obreros_costo" label="Costo obr." className="w-[110px] text-right">
        <MoneyField source="obreros_costo" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[48px] xl:w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
