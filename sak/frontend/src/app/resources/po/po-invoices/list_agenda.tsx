"use client";

import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderBulkExportButton,
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
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

import { INVOICE_STATUS_FIN_BADGES } from "./model";
import { FormAutorizar } from "./form_autorizar";
import { FormPagos } from "./form_pagos";
import { PoInvoiceAgendaBulkPagarButton } from "./bulk_pagar";
import { PoInvoiceAgendaBulkAutorizarButton } from "./bulk_autorizar";

// === Filtros ===
const LIST_FILTERS = buildListFilters(
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
        source: "invoice_status_fin_id",
        reference: "po-invoice-status-fin",
        label: "Agenda",
        sort: { field: "orden", order: "ASC" },
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        label: "Agenda",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-invoices" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

// Acciones de toolbar del listado de facturas.
const AccionesListaFacturas = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

// === Listado ===
// Listado principal de facturas de OC.
export const PoInvoiceAgendaList = () => <ListaFacturasAgenda />;

// Contenedor con configuracion del listado.
const ListaFacturasAgenda = () => {
  return (
    <List
      title="Agenda de pagos"
      filters={LIST_FILTERS}
      actions={<AccionesListaFacturas />}
      debounce={300}
      perPage={10}
      containerClassName={LIST_CONTAINER_WIDE}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      queryOptions={{ refetchOnMount: "always" }}
      resource="po-invoices"
      storeKey="po-invoices-agenda"
    >
      <ResponsiveDataTable
        rowClick="edit"
        bulkActionsToolbar={
          <FormOrderBulkActionsToolbar>
            <FormOrderBulkExportButton />
            <PoInvoiceAgendaBulkAutorizarButton />
            <PoInvoiceAgendaBulkPagarButton />
          </FormOrderBulkActionsToolbar>
        }
        mobileConfig={{
          primaryField: "numero",
          secondaryFields: [
            "titulo",
            "proveedor_id",
            "invoice_status.nombre",
            "fecha_pago",
            "total",
          ],
          detailFields: [],
        }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <ListColumn source="id" label="ID" className="w-[45px] text-center">
          <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="numero" label="Numero" className="w-[75px]">
          <ListText source="numero" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="titulo" label="Titulo" className="w-[90px]">
          <ListText source="titulo" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="proveedor_id" label="Proveedor" className="w-[70px]">
          <ReferenceField source="proveedor_id" reference="proveedores" link={false}>
            <ListText source="nombre" width="12ch" className="whitespace-normal break-words" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="invoice_status_fin.nombre" label="Agenda" className="w-[70px]">
          <ListStatus
            source="invoice_status_fin.nombre"
            statusClasses={INVOICE_STATUS_FIN_BADGES}
            className="text-[8px]"
          />
        </ListColumn>
        <ListColumn source="fecha_vencimiento" label="Fecha Ven" className="w-[70px]">
          <ListDate source="fecha_vencimiento" />
        </ListColumn>
        <ListColumn source="fecha_pago" label="Fecha Pag" className="w-[70px]">
          <ListDate source="fecha_pago" />
        </ListColumn>
        <ListColumn
          source="metodo_pago_id"
          label="Metodo"
          className="w-[30px] max-w-[30px] overflow-hidden"
        >
          <ReferenceField source="metodo_pago_id" reference="metodos-pago" link={false}>
            <ListText source="nombre" className="truncate whitespace-nowrap overflow-hidden" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="total" label="Total" className="w-[75px] text-right">
          <ListMoney source="total" showCurrency={false} className="whitespace-nowrap" />
        </ListColumn>
        <ListColumn label="Acciones" className="w-[60px]">
          <FormOrderListRowActions
            extraMenuItems={
              <>
                <FormPagos />
                <FormAutorizar />
              </>
            }
          />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

// === Helpers ===
