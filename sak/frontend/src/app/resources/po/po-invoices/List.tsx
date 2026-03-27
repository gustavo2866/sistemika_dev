"use client";

import { ArrowLeft } from "lucide-react";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
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
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

import { INVOICE_STATUS_BADGES } from "./model";
import { FormConfirmar } from "./form_confirmar";
import { FormAprobar } from "./form_aprobar";

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

const InvoiceListTitle = ({ onBack }: { onBack: () => void }) => (
  <>
    <div className="sm:hidden">
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-1.5 text-[11px] font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <div className="-mt-0.5 flex items-center justify-center">
        <span>Facturas OC</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-sm font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <span>Facturas OC</span>
    </span>
  </>
);

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
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnToFromLocation(location);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/po-orders");
  };

  return (
    <List
      title={<InvoiceListTitle onBack={handleBack} />}
      filters={LIST_FILTERS}
      actions={<AccionesListaFacturas />}
      debounce={300}
      perPage={10}
      containerClassName={LIST_CONTAINER_WIDE}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      queryOptions={{ refetchOnMount: "always" }}
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
        <ListColumn source="numero" label="Numero" className="w-[75px]">
          <ListText source="numero" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="titulo" label="Titulo" className="w-[110px]">
          <ListText source="titulo" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="proveedor_id" label="Proveedor" className="w-[85px]">
          <ReferenceField source="proveedor_id" reference="proveedores" link={false}>
            <ListText source="nombre" width="12ch" className="whitespace-normal break-words" />
          </ReferenceField>
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
          <FormOrderListRowActions
            extraMenuItems={
              <>
                <FormConfirmar />
                <FormAprobar action="approve" />
                <FormAprobar action="reject" />
              </>
            }
          />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

// === Helpers ===
