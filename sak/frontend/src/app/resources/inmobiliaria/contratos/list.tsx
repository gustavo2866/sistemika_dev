"use client";

import { useMemo, type ReactNode } from "react";
import { useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListEstado,
  ListText,
  ListPaginator,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";

import {
  CONTRATO_ESTADO_BADGES,
  CONTRATO_ESTADO_LABELS,
  isContratoVencido,
  type Contrato,
} from "./model";
import {
  ContratoAccionesDialogs,
  ContratoAccionesMenuItems,
  useContratoAccionesState,
} from "./contrato_acciones";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar contratos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[200px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: { optionText: "nombre", emptyText: "Todas", className: "w-full" },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_contrato_id",
        reference: "tipos-contrato",
        label: "Tipo",
      },
      selectProps: { optionText: "nombre", emptyText: "Todos", className: "w-full" },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: Object.entries(CONTRATO_ESTADO_LABELS).map(([id, name]) => ({
          id,
          name,
        })),
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[120px]",
      },
    },
  ],
  { keyPrefix: "contratos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const LIST_TABLE_CLASS_NAME = "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]";
const EMBEDDED_LIST_TABLE_CLASS_NAME = "text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]";

const isMeaningfulFilterValue = (value: unknown): boolean => {
  if (value === "" || value == null) return false;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((nestedValue) =>
      isMeaningfulFilterValue(nestedValue),
    );
  }
  return true;
};

const ListActions = ({
  createTo,
  createAction,
  filters,
}: {
  createTo?: string;
  createAction?: ReactNode;
  filters: ReturnType<typeof buildListFilters>;
}) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    {createAction ?? <CreateButton className={actionButtonClass} label="Crear" to={createTo} />}
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const InquilinoCell = () => {
  const record = useRecordContext<Contrato>();
  if (!record) return null;
  const nombre = [record.inquilino_nombre, record.inquilino_apellido].filter(Boolean).join(" ");
  return <span className="text-[11px]">{nombre || "—"}</span>;
};
// La celda de acciones gestiona su propio estado de di\u00e1logos FUERA del dropdown,
// para evitar que el estado se pierda cuando el men\u00fa se desmonta al cerrarse.
const ContratoAccionesCell = () => {
  const record = useRecordContext<Contrato>();
  const acciones = useContratoAccionesState(record);
  const canDelete = record?.estado === "borrador";
  return (
    <>
      <FormOrderListRowActions
        showShow
        showDelete={canDelete}
        extraMenuItems={<ContratoAccionesMenuItems acciones={acciones} />}
      />
      {record?.id ? <ContratoAccionesDialogs acciones={acciones} /> : null}
    </>
  );
};

const EstadoCell = () => {
  const record = useRecordContext<Contrato>();
  if (!record) return null;
  // vencido es computed: vigente con fecha_vencimiento < hoy
  const displayEstado = isContratoVencido(record) ? "vencido" : (record.estado ?? "");
  return <ListEstado source="estado" statusClasses={CONTRATO_ESTADO_BADGES} record={{ ...record, estado: displayEstado }} />;
};

type ContratoListProps = {
  embedded?: boolean;
  perPage?: number;
  propiedadId?: number | null;
  rowClick?: "edit" | ((id: string | number) => string);
  createTo?: string;
  createAction?: ReactNode;
  filterDefaultValues?: Record<string, unknown>;
  permanentFilter?: Record<string, unknown>;
  storeKey?: string;
  emptyMessage?: string;
  showEmbeddedHeader?: boolean;
  embeddedTitle?: ReactNode | string | false;
};

export const ContratoList = ({
  embedded = false,
  perPage = 5,
  propiedadId,
  rowClick = "edit",
  createTo,
  createAction,
  filterDefaultValues,
  permanentFilter,
  storeKey,
  emptyMessage,
  showEmbeddedHeader = false,
  embeddedTitle = "Contratos",
}: ContratoListProps = {}) => {
  const location = useLocation();
  const returnTo = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const resolvedCreateTo = useMemo(() => {
    if (createTo) return createTo;
    if (!embedded || !propiedadId) return undefined;

    const params = new URLSearchParams();
    params.set("propiedad_id", String(propiedadId));
    params.set("returnTo", returnTo);
    return `/contratos/create?${params.toString()}`;
  }, [createTo, embedded, propiedadId, returnTo]);
  const resolvedRowClick = useMemo(() => {
    if (typeof rowClick === "function") return rowClick;
    if (!embedded || !propiedadId || rowClick !== "edit") return rowClick;

    return (id: string | number) =>
      `/contratos/${id}?returnTo=${encodeURIComponent(returnTo)}`;
  }, [embedded, propiedadId, returnTo, rowClick]);
  const hiddenEmbeddedFilterSources = new Set(
    Object.keys(permanentFilter ?? {}).filter((key) =>
      isMeaningfulFilterValue(permanentFilter?.[key]),
    ),
  );
  const resolvedFilters = embedded
    ? filters.filter((filterElement) => {
        const source = String(filterElement.props.source ?? "");
        return !hiddenEmbeddedFilterSources.has(source);
      })
    : filters;

  return (
    <List
      resource="contratos"
      title={embedded ? (showEmbeddedHeader ? embeddedTitle : undefined) : "Contratos"}
      filters={resolvedFilters}
      actions={<ListActions createTo={resolvedCreateTo} createAction={createAction} filters={resolvedFilters} />}
      debounce={300}
      perPage={perPage}
      filter={permanentFilter}
      filterDefaultValues={filterDefaultValues}
      containerClassName={LIST_CONTAINER_WIDE}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      disableSyncWithLocation={embedded}
      storeKey={embedded ? storeKey : undefined}
      showBreadcrumb={embedded ? false : true}
      showHeader={embedded ? showEmbeddedHeader : true}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <ResponsiveDataTable
        rowClick={resolvedRowClick}
        mobileConfig={{
          primaryField: "id",
          secondaryFields: ["estado", "inquilino_nombre"],
          detailFields: [],
        }}
        emptyMessage={emptyMessage}
        className={embedded ? EMBEDDED_LIST_TABLE_CLASS_NAME : LIST_TABLE_CLASS_NAME}
      >
        <ListColumn source="id" label="ID" className="w-[48px]">
          <ListText source="id" />
        </ListColumn>
        <ListColumn source="propiedad_id" label="Propiedad" className="w-[120px]">
          <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
            <ListText source="nombre" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="inquilino_nombre" label="Inquilino" className="w-[100px]">
          <InquilinoCell />
        </ListColumn>
        <ListColumn source="estado" label="Estado" className="w-[72px]">
          <EstadoCell />
        </ListColumn>
        <ListColumn source="fecha_inicio" label="Inicio" className="w-[72px]">
          <ListDate source="fecha_inicio" />
        </ListColumn>
        <ListColumn source="fecha_vencimiento" label="Vencimiento" className="w-[76px]">
          <ListDate source="fecha_vencimiento" />
        </ListColumn>
        <ListColumn label={embedded ? "" : "Acciones"} className="w-[60px]">
          <ContratoAccionesCell />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};
