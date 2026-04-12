"use client";
import { useRecordContext } from "ra-core";
import { DateField } from "@/components/date-field";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { FormConfirmar } from "./form_confirmar";
import { ORDER_STATUS_BADGES } from "./model";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { PoOrderCreateMenuButton } from "./create-menu-button";

const getUserInitials = (name?: string | null) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const OrderStatusWithDate = () => (
  <div className="flex flex-col items-start gap-0 leading-none">
    <ListEstado source="order_status.nombre" statusClasses={ORDER_STATUS_BADGES} />
    <DateField
      source="created_at"
      className="hidden text-[7px] leading-none text-muted-foreground sm:block xl:text-[8px]"
    />
  </div>
);

const SolicitanteCell = () => {
  const record = useRecordContext<{
    nombre?: string | null;
    avatar?: string | null;
    url_foto?: string | null;
  }>();
  const name = record?.nombre ?? "";
  const avatarUrl = record?.avatar ?? record?.url_foto ?? "";

  return (
    <div className="flex items-center justify-center">
      <Avatar className="size-4 border border-slate-200">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback className="bg-slate-100 text-[7px] font-semibold text-slate-600">
          {getUserInitials(name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

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

const EMBEDDED_LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
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
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-orders-embedded" },
);

// Acciones de toolbar del listado de ordenes.
const AccionesListaOrdenes = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <PoOrderCreateMenuButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

type PoOrderListProps = {
  embedded?: boolean;
  filterDefaultValues?: Record<string, unknown>;
  createTo?: string;
  storeKey?: string;
};

// === Listado ===
// Listado principal de ordenes de compra.
export const PoOrderList = ({
  embedded = false,
  filterDefaultValues,
  createTo,
  storeKey,
}: PoOrderListProps = {}) => {
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

  const resolvedFilterDefaults = embedded ? filterDefaultValues : defaultFilters;
  const resolvedStoreKey = embedded ? storeKey : undefined;
  const embeddedActions = embedded ? (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={EMBEDDED_LIST_FILTERS}
        size="sm"
        buttonClassName={ACTION_BUTTON_CLASS}
      />
      <PoOrderCreateMenuButton
        createTo={createTo}
        className={ACTION_BUTTON_CLASS}
        label="Agregar"
      />
      <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
    </div>
  ) : undefined;

  return (
    <List
      resource="po-orders"
      title={embedded ? undefined : <OrderListTitle onBack={handleBack} />}
      filters={embedded ? EMBEDDED_LIST_FILTERS : LIST_FILTERS}
      actions={embedded ? embeddedActions : <AccionesListaOrdenes />}
      debounce={300}
      perPage={10}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_STANDARD}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={resolvedFilterDefaults}
      disableSyncWithLocation={embedded}
      storeKey={resolvedStoreKey}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <PoOrderListBody
        identityId={embedded ? undefined : identityId}
        compact={embedded}
        showBulkActions={!embedded}
      />
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
      className="text-[9px] [&_th]:text-[9px] [&_td]:text-[9px] xl:text-[10px] xl:[&_th]:text-[10px] xl:[&_td]:text-[10px]"
    >
      <ListColumn source="id" label="ID" className="w-[45px] text-center">
        <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="titulo" label="Titulo" className="w-[120px]">
        <ListText source="titulo" className="whitespace-normal break-words" />
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
      <ListColumn source="order_status_id" label="Estado" className="w-[44px]">
        <OrderStatusWithDate />
      </ListColumn>
      <ListColumn source="total" label="Importe" className="w-[90px] text-right">
        <ListMoney source="total" showCurrency={false} className="whitespace-nowrap" />
      </ListColumn>
      <ListColumn source="solicitante_id" label="Solic" className="w-[36px] text-center">
        <ReferenceField source="solicitante_id" reference="users" link={false}>
          <SolicitanteCell />
        </ReferenceField>
      </ListColumn>
      <ListColumn label="" className="w-[30px]">
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
