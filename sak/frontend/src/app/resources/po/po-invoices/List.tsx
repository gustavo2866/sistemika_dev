"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDataProvider, useListContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
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
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

import { INVOICE_STATUS_BADGES } from "./model";

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
        source: "invoice_status_id",
        reference: "po-invoice-status",
        label: "Estado",
        sort: { field: "orden", order: "ASC" },
        alwaysOn: true,
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

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

// === Defaults ===
// Default de filtro por estado (Borrador).
const useInvoiceStatusFilterDefaults = () => {
  const dataProvider = useDataProvider();
  const [statusId, setStatusId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await dataProvider.getList("po-invoice-status", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "orden", order: "ASC" },
          filter: { nombre: "Borrador" },
        });
        if (!active) return;
        const status = data?.[0];
        if (status?.id) {
          setStatusId(status.id);
          return;
        }
      } catch {
        // ignore and fallback
      }
      if (active) {
        setStatusId(1);
      }
    })();
    return () => {
      active = false;
    };
  }, [dataProvider]);

  const defaultFilters = useMemo(
    () => (statusId ? { invoice_status_id: statusId } : {}),
    [statusId],
  );

  return { statusId, defaultFilters };
};

type InvoiceStatusFilterSyncProps = {
  statusId?: number | null;
};

// Sincroniza el filtro por estado si no hay valor inicial.
const InvoiceStatusFilterSync = ({ statusId }: InvoiceStatusFilterSyncProps) => {
  const { filterValues, setFilters } = useListContext();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    if (statusId == null) return;
    const value = filterValues?.invoice_status_id;
    const hasValue = value != null && String(value).trim().length > 0;
    if (!hasValue) {
      setFilters({ ...filterValues, invoice_status_id: statusId }, {});
    }
    didInitRef.current = true;
  }, [filterValues, setFilters, statusId]);

  return null;
};

// Acciones de toolbar del listado de facturas.
const AccionesListaFacturas = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

// === Listado ===
// Listado principal de facturas de OC.
export const PoInvoiceList = () => <ListaFacturas />;

// Contenedor con configuracion del listado.
const ListaFacturas = () => {
  const { statusId, defaultFilters } = useInvoiceStatusFilterDefaults();

  return (
    <List
      title="Facturas OC"
      filters={LIST_FILTERS}
      actions={<AccionesListaFacturas />}
      debounce={300}
      perPage={10}
      containerClassName="max-w-[980px] w-full mr-auto"
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <InvoiceStatusFilterSync statusId={statusId} />
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
};

// === Helpers ===
