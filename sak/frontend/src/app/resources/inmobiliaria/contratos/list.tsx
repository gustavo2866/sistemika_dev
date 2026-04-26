"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useListContext, useRecordContext } from "ra-core";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

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

const UrlFilterSync = ({ enabled, search }: { enabled: boolean; search: string }) => {
  const { filterValues, setFilters } = useListContext();

  const urlFilters = useMemo(() => {
    if (!enabled) return null;
    const params = new URLSearchParams(search);
    const rawFilter = params.get("filter");
    if (!rawFilter) return null;
    try {
      return JSON.parse(rawFilter) as Record<string, unknown>;
    } catch (error) {
      console.error("No se pudo parsear el filtro de contratos desde la URL", error);
      return null;
    }
  }, [enabled, search]);

  useEffect(() => {
    if (!enabled || !urlFilters) return;

    const currentFilters = JSON.stringify(filterValues ?? {});
    const nextFilters = JSON.stringify(urlFilters);
    if (currentFilters === nextFilters) return;

    setFilters(urlFilters, undefined, false);
  }, [enabled, filterValues, setFilters, urlFilters]);

  return null;
};

const ContratoListTitle = ({ onBack }: { onBack: () => void }) => (
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
        <span>Contratos</span>
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
      <span>Contratos</span>
    </span>
  </>
);

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
  const navigate = useNavigate();
  const location = useLocation();
  const locationReturnTo = getReturnToFromLocation(location);
  const returnTo = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const handleBack = () => {
    if (locationReturnTo) {
      navigate(locationReturnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/contratos");
  };
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
      title={
        embedded
          ? (showEmbeddedHeader ? embeddedTitle : undefined)
          : <ContratoListTitle onBack={handleBack} />
      }
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
      <UrlFilterSync enabled={!embedded} search={location.search} />
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
        <ListColumn source="tipo_contrato_id" label="Tipo contrato" className="w-[110px]">
          <ReferenceField source="tipo_contrato_id" reference="tipos-contrato" link={false}>
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
