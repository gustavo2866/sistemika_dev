"use client";

import { useRecordContext } from "ra-core";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import {
  PEDIDO_ESTADO_CHOICES,
  PEDIDO_ORIGEN_CHOICES,
  isPedidoReadOnly,
  type ConstructoraPedidoRecord,
} from "./model";
import { PedidoEstadoMenuItems } from "./status-actions";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar pedidos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: PEDIDO_ESTADO_CHOICES,
        emptyText: "Todos",
        alwaysOn: true,
      },
    },
    {
      type: "select",
      props: {
        source: "origen",
        label: "Origen",
        choices: PEDIDO_ORIGEN_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "oportunidad_id",
        reference: "crm/oportunidades",
        label: "Oportunidad",
      },
      selectProps: {
        optionText: "titulo",
        emptyText: "Todas",
      },
    },
  ],
  { keyPrefix: "constructora-pedidos" },
);

const embeddedFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar pedidos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "select",
      props: {
        source: "origen",
        label: "Origen",
        choices: PEDIDO_ORIGEN_CHOICES,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "constructora-pedidos-embedded" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const PedidoListTitle = ({ onBack }: { onBack: () => void }) => (
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
        <span>Pedidos de obra</span>
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
      <span>Pedidos de obra</span>
    </span>
  </>
);

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const EmbeddedListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={embeddedFilters} size="sm" buttonClassName={actionButtonClass} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const DetalleCountField = () => {
  const record = useRecordContext<{ detalles?: Array<unknown> }>();
  const count = Array.isArray(record?.detalles) ? record.detalles.length : 0;
  return <span>{count}</span>;
};

const PedidoListRowActions = () => {
  const record = useRecordContext<ConstructoraPedidoRecord>();
  const estado = String(record?.estado ?? "").trim().toLowerCase();
  const hasEstadoActions =
    Boolean(record?.id) && !isPedidoReadOnly(estado) && estado !== "cancelado";

  return (
    <FormOrderListRowActions
      showDelete={false}
      extraMenuItems={hasEstadoActions ? <PedidoEstadoMenuItems /> : undefined}
    />
  );
};

export type PedidoListProps = {
  embedded?: boolean;
  filter?: Record<string, unknown>;
  filterDefaultValues?: Record<string, unknown>;
  storeKey?: string;
  showEmbeddedHeader?: boolean;
  embeddedTitle?: string | ReactNode | false;
};

export const PedidoList = ({
  embedded = false,
  filter,
  filterDefaultValues,
  storeKey,
  showEmbeddedHeader = false,
  embeddedTitle = "Pedidos",
}: PedidoListProps = {}) => {
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
    navigate("/constructora/pedidos");
  };

  return (
    <List
      resource="constructora/pedidos"
      title={
        embedded
          ? showEmbeddedHeader
            ? embeddedTitle
            : undefined
          : <PedidoListTitle onBack={handleBack} />
      }
      filters={embedded ? embeddedFilters : filters}
      actions={embedded ? <EmbeddedListActions /> : <ListActions />}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      perPage={25}
      pagination={<ListPaginator />}
      sort={{ field: "created_at", order: "DESC" }}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      disableSyncWithLocation={embedded}
      storeKey={storeKey}
      showBreadcrumb={embedded ? false : true}
      showHeader={embedded ? showEmbeddedHeader : true}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <ResponsiveDataTable
        rowClick="edit"
        compact={embedded}
        mobileConfig={{ primaryField: "titulo", secondaryFields: ["estado", "origen", "oportunidad_id"] }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <TextListColumn source="estado" label="Estado" className="w-[110px]">
          <SelectField source="estado" choices={PEDIDO_ESTADO_CHOICES} />
        </TextListColumn>
        <TextListColumn source="titulo" label="Titulo" className="w-[260px]">
          <ListText source="titulo" className="whitespace-normal break-words" />
        </TextListColumn>
        <TextListColumn source="oportunidad_id" label="Oportunidad" className="w-[180px]">
          <ReferenceField source="oportunidad_id" reference="crm/oportunidades" link={false}>
            <ListText source="titulo" className="whitespace-normal break-words" />
          </ReferenceField>
        </TextListColumn>
        <TextListColumn source="origen" label="Origen" className="w-[90px]">
          <SelectField source="origen" choices={PEDIDO_ORIGEN_CHOICES} />
        </TextListColumn>
        <NumberListColumn label="Lineas" className="w-[70px] text-center">
          <DetalleCountField />
        </NumberListColumn>
        <DateListColumn source="created_at" label="Fecha" className="w-[110px]">
          <ListDate source="created_at" />
        </DateListColumn>
        <TextListColumn label="Acciones" className="w-[80px]">
          <PedidoListRowActions />
        </TextListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

export default PedidoList;
