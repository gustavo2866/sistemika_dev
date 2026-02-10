"use client";

import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FormOrderBulkActionsToolbar, FormOrderListRowActions, ListColumn, ListEstado, ListID, ListMoney, ListPaginator, ListText, ResponsiveDataTable, buildListFilters } from "@/components/forms/form_order";
import { ORDER_STATUS_BADGES } from "./model";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { useGetIdentity, useListContext } from "ra-core";
import { useEffect, useMemo } from "react";

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
  { keyPrefix: "po-orders" }
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

export const PoOrderList = () => (
  <ListWithDefaults />
);

const ListWithDefaults = () => {
  const { data: identity } = useGetIdentity();
  const defaultFilters = useMemo(
    () => (identity?.id ? { solicitante_id: identity.id } : {}),
    [identity?.id]
  );

  return (
    <List
      title="Ordenes"
      filters={filters}
      actions={<ListActions />}
      debounce={300}
      perPage={10}
      containerClassName="max-w-[900px] w-full mr-auto"
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <PoOrdersFilterSync identityId={identity?.id} />
      <ResponsiveDataTable
        rowClick="edit"
        bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
        mobileConfig={{
          primaryField: "titulo",
        secondaryFields: ["solicitante_id", "tipo_solicitud_id", "proveedor_id", "total"],
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
        <FormOrderListRowActions />
      </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

const PoOrdersFilterSync = ({ identityId }: { identityId?: number | string }) => {
  const { filterValues, setFilters } = useListContext();

  useEffect(() => {
    if (identityId == null) return;
    const hasSolicitante =
      filterValues?.solicitante_id != null &&
      String(filterValues.solicitante_id).trim().length > 0;
    if (!hasSolicitante) {
      setFilters({ ...filterValues, solicitante_id: identityId }, {});
    }
  }, [filterValues, identityId, setFilters]);

  return null;
};
