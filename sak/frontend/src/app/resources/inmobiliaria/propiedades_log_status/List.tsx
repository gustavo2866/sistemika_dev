"use client";

import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { ExportButton } from "@/components/export-button";
import { ReferenceField } from "@/components/reference-field";
import {
  buildListFilters,
  ListPaginator,
  ListText,
  ListDate,
  ResponsiveDataTable,
  ListColumn,
} from "@/components/forms/form_order";
import type { ReactNode } from "react";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar cambios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "usuario_id",
        reference: "users",
        label: "Usuario",
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
        source: "estado_nuevo",
        label: "Estado nuevo",
      },
    },
  ],
  { keyPrefix: "propiedades-log-status" },
);

const EMBEDDED_LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar cambios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "usuario_id",
        reference: "users",
        label: "Usuario",
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
        source: "estado_nuevo",
        label: "Estado nuevo",
      },
    },
  ],
  { keyPrefix: "propiedades-log-status-embedded" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ embedded = false }: { embedded?: boolean }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={embedded ? EMBEDDED_LIST_FILTERS : LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type PropiedadesLogStatusListProps = {
  embedded?: boolean;
  filterDefaultValues?: Record<string, unknown>;
  perPage?: number;
  showEmbeddedHeader?: boolean;
  embeddedTitle?: ReactNode | string | false;
  storeKey?: string;
};

export const PropiedadesLogStatusList = ({
  embedded = false,
  filterDefaultValues,
  perPage,
  showEmbeddedHeader = false,
  embeddedTitle = "Log de Estados de Propiedad",
  storeKey,
}: PropiedadesLogStatusListProps = {}) => {
  const resolvedPerPage = perPage ?? (embedded ? 5 : 25);

  return (
  <List
    resource="propiedades-log-status"
    title={embedded ? (showEmbeddedHeader ? embeddedTitle : undefined) : "Log de Estados de Propiedad"}
    filters={embedded ? EMBEDDED_LIST_FILTERS : LIST_FILTERS}
    actions={<ListActions embedded={embedded} />}
    debounce={300}
    perPage={resolvedPerPage}
    pagination={<ListPaginator />}
    sort={{ field: "fecha_cambio", order: "DESC" }}
    containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
    filterDefaultValues={filterDefaultValues}
    disableSyncWithLocation={embedded}
    storeKey={embedded ? storeKey : undefined}
    showBreadcrumb={!embedded}
    showHeader={embedded ? showEmbeddedHeader : true}
    filterFormComponent={embedded ? StyledFilterDiv : undefined}
  >
    <PropiedadesLogStatusListBody hidePropiedadColumn={embedded} />
  </List>
  );
};

type PropiedadesLogStatusListBodyProps = {
  hidePropiedadColumn?: boolean;
};

export const PropiedadesLogStatusListBody = ({
  hidePropiedadColumn = false,
}: PropiedadesLogStatusListBodyProps) => (
  <ResponsiveDataTable
    rowClick={false}
    mobileConfig={{
      primaryField: "estado_nuevo",
      secondaryFields: hidePropiedadColumn
        ? ["usuario_id", "fecha_cambio", "motivo"]
        : ["propiedad_id", "usuario_id", "fecha_cambio"],
    }}
    className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
  >
    {!hidePropiedadColumn ? (
      <ListColumn source="propiedad_id" label="Propiedad" className="w-[160px]">
        <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
    ) : null}
    <ListColumn source="estado_anterior" label="Estado anterior" className="w-[120px]">
      <ListText source="estado_anterior" />
    </ListColumn>
    <ListColumn source="estado_nuevo" label="Estado nuevo" className="w-[120px]">
      <ListText source="estado_nuevo" />
    </ListColumn>
    <ListColumn source="fecha_cambio" label="Fecha" className="w-[120px]">
      <ListDate source="fecha_cambio" options={{ timeZone: "UTC" }} />
    </ListColumn>
    <ListColumn source="usuario_id" label="Usuario" className="w-[140px]">
      <ReferenceField source="usuario_id" reference="users" link={false}>
        <ListText source="nombre" className="whitespace-normal break-words" />
      </ReferenceField>
    </ListColumn>
    <ListColumn source="motivo" label="Motivo" className="w-[160px]">
      <ListText source="motivo" className="whitespace-normal break-words" />
    </ListColumn>
  </ResponsiveDataTable>
);
