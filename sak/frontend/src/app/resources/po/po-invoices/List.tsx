"use client";

import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListID,
  ListMoney,
  ListPaginator,
  ListStatus,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { INVOICE_STATUS_BADGES } from "./model";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[100px] sm:w-[140px]",
      },
    },
    {
      type: "text",
      props: {
        source: "numero",
        label: "Numero",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "proveedor_id",
        reference: "proveedores",
        label: "Proveedor",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "invoice_status_id",
        reference: "po-invoice-status",
        label: "Estado",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-invoices" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

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

export const PoInvoiceList = () => (
  <List
    title="Facturas OC"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={10}
    containerClassName="max-w-[980px] w-full mr-auto"
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "numero",
        secondaryFields: ["titulo", "proveedor_id", "invoice_status.nombre", "total"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[45px] text-center">
        <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="numero" label="Numero" className="w-[90px]">
        <ListText source="numero" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="titulo" label="Titulo" className="w-[130px]">
        <ListText source="titulo" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="proveedor_id" label="Proveedor" className="w-[100px]">
        <ReferenceField source="proveedor_id" reference="proveedores" link={false}>
          <ListText source="nombre" width="12ch" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="fecha_emision" label="Emision" className="w-[75px]">
        <ListDate source="fecha_emision" />
      </ListColumn>
      <ListColumn source="invoice_status.nombre" label="Estado" className="w-[60px]">
        <ListStatus
          source="invoice_status.nombre"
          statusClasses={INVOICE_STATUS_BADGES}
          className="text-[8px]"
        />
      </ListColumn>
      <ListColumn source="total" label="Total" className="w-[75px] text-right">
        <ListMoney source="total" showCurrency={false} className="whitespace-nowrap" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
