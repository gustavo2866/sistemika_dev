"use client";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  IdentityFilterSync,
  ListColumn,
  ListEstado,
  ListID,
  ListMoney,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  useIdentityFilterDefaults,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Button } from "@/components/ui/button";

import { FormConfirmar } from "./form_confirmar";
import { ORDER_STATUS_BADGES } from "./model";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

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
        source: "titulo",
        label: "Titulo",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "solicitante_id",
        reference: "users",
        label: "Solicitante",
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
        source: "tipo_solicitud_id",
        reference: "tipos-solicitud",
        label: "Tipo solicitud",
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
        source: "order_status_id",
        reference: "po-order-status",
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
  { keyPrefix: "po-orders" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const OrderListTitle = ({ onBack }: { onBack: () => void }) => (
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
        <span>Ordenes</span>
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
      <span>Ordenes</span>
    </span>
  </>
);

// Acciones de toolbar del listado de ordenes.
const AccionesListaOrdenes = () => (
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
// Listado principal de ordenes de compra.
export const PoOrderList = () => <ListaOrdenes />;

// Contenedor con defaults y configuracion del listado.
const ListaOrdenes = () => {
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "solicitante_id",
  });
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
      title={<OrderListTitle onBack={handleBack} />}
      filters={LIST_FILTERS}
      actions={<AccionesListaOrdenes />}
      debounce={300}
      perPage={10}
      containerClassName={LIST_CONTAINER_STANDARD}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <PoOrderListBody identityId={identityId} />
    </List>
  );
};

type PoOrderListBodyProps = {
  identityId?: number | string;
  compact?: boolean;
  showBulkActions?: boolean;
};

export const PoOrderListBody = ({
  identityId,
  compact = false,
  showBulkActions = true,
}: PoOrderListBodyProps) => (
  <>
    {identityId ? (
      <IdentityFilterSync identityId={identityId} source="solicitante_id" />
    ) : null}
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={showBulkActions ? <FormOrderBulkActionsToolbar /> : undefined}
      bulkActionButtons={showBulkActions ? undefined : false}
      compact={compact}
      mobileConfig={{
        primaryField: "titulo",
        secondaryFields: [
          "solicitante_id",
          "tipo_solicitud_id",
          "proveedor_id",
          "total",
        ],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[45px] text-center">
        <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="titulo" label="Titulo" className="w-[120px]">
        <ListText source="titulo" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="solicitante_id" label="Solicitante" className="w-[90px]">
        <ReferenceField source="solicitante_id" reference="users" link={false}>
          <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="tipo_solicitud_id" label="Tipo solicitud" className="w-[90px]">
        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" link={false}>
          <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="proveedor_id" label="Proveedor" className="w-[90px]">
        <ReferenceField source="proveedor_id" reference="proveedores" link={false}>
          <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="order_status_id" label="Estado" className="w-[75px]">
        <ListEstado source="order_status.nombre" statusClasses={ORDER_STATUS_BADGES} />
      </ListColumn>
      <ListColumn source="total" label="Importe" className="w-[90px] text-right">
        <ListMoney source="total" showCurrency={false} className="whitespace-nowrap" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions
          className={compact ? "h-4 w-4 sm:h-4 sm:w-4" : undefined}
          extraMenuItems={
            <>
              <FormConfirmar action="approve" />
              <FormConfirmar action="reject" />
            </>
          }
        />
      </ListColumn>
    </ResponsiveDataTable>
  </>
);

// === Helpers ===
// (sin helpers locales)
