"use client";

import { cloneElement, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import isEqual from "lodash/isEqual";
import { ExternalLink, MoreHorizontal, Pencil, Wrench } from "lucide-react";
import {
  useDataProvider,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListBoolean,
  ListColumn,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  SectionBaseTemplate,
  buildListFilters,
  resolveNumericId,
  useRowActionDialog,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar servicios",
        alwaysOn: true,
        className: "w-[140px] sm:w-[180px]",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: [
          { id: true, name: "Si" },
          { id: false, name: "No" },
        ],
        className: "compact-filter w-[88px]",
      },
    },
  ],
  { keyPrefix: "propiedades-servicios" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const LIST_TABLE_CLASS_NAME = "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]";
const FICHA_ACTION_ITEM_CLASSNAME = "gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]";
const FICHA_ACTION_ICON_CLASSNAME = "mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5";
const buildEmbeddedFilters = (hiddenSources: Set<string>) =>
  LIST_FILTERS
    .filter((filterElement) => {
      const source = String(filterElement.props.source ?? "");
      return source && !hiddenSources.has(source);
    })
    .map((filterElement) => {
      const source = String(filterElement.props.source ?? "");
      return cloneElement(filterElement, {
        ...filterElement.props,
        alwaysOn: source === "q",
      });
    });

type PropiedadServicioRecord = {
  id?: number;
  comentario?: string | null;
  servicio_tipo?: {
    url?: string | null;
  } | null;
};

const normalizeServicioUrl = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const ServicioUrlButton = () => {
  const record = useRecordContext<PropiedadServicioRecord>();
  const servicioUrl = normalizeServicioUrl(record?.servicio_tipo?.url);

  if (!servicioUrl) {
    return <span className="text-muted-foreground">-</span>;
  }

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const popup = window.open(
      servicioUrl,
      `servicio-relacionado-${record?.id ?? "popup"}`,
      "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes",
    );
    popup?.focus();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-5 w-5 p-0"
      onClick={handleOpen}
      data-row-click="ignore"
      title="Abrir servicio"
      aria-label="Abrir servicio"
    >
      <ExternalLink className="h-2 w-2" />
    </Button>
  );
};

type PropiedadServicioListProps = {
  embedded?: boolean;
  perPage?: number;
  propiedadId?: number | null;
  rowClick?: "edit" | false | ((id: string | number) => string);
  createTo?: string;
  filterDefaultValues?: Record<string, unknown>;
  permanentFilter?: Record<string, unknown>;
  storeKey?: string;
  emptyMessage?: string;
  showEmbeddedHeader?: boolean;
  embeddedTitle?: ReactNode | string | false;
  embeddedExtraActions?: ReactNode;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

const isMeaningfulFilterValue = (value: unknown): boolean => {
  if (value === "" || value == null) return false;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((nestedValue) =>
      isMeaningfulFilterValue(nestedValue),
    );
  }
  return true;
};

const EmbeddedDefaultFilterSync = ({
  enabled,
  filterDefaultValues,
}: {
  enabled: boolean;
  filterDefaultValues?: Record<string, unknown>;
}) => {
  const { filterValues, setFilters } = useListContext();

  useEffect(() => {
    if (!enabled || !filterDefaultValues) return;

    const nextFilters = {
      ...(filterValues ?? {}),
      ...filterDefaultValues,
    };

    if (isEqual(filterValues ?? {}, nextFilters)) return;
    setFilters(nextFilters, undefined, false);
  }, [enabled, filterDefaultValues, filterValues, setFilters]);

  return null;
};

const EmbeddedServicioListActions = ({
  filters,
  createTo,
  extraActions,
}: {
  filters: ReturnType<typeof buildListFilters>;
  createTo?: string;
  extraActions?: ReactNode;
}) => {
  return (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={filters}
        size="sm"
        buttonClassName={ACTION_BUTTON_CLASS}
      />
      <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
      <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
      {extraActions}
    </div>
  );
};

const useAgregarServiciosActivos = (propiedadId: number) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const handleAgregarServiciosActivos = useCallback(async () => {
    if (!propiedadId || busy) return;

    setBusy(true);
    try {
      const [{ data: serviciosActivos = [] }, { data: serviciosActuales = [] }] = await Promise.all([
        dataProvider.getList("servicios-tipo", {
          filter: { activo: true },
          sort: { field: "nombre", order: "ASC" },
          pagination: { page: 1, perPage: 500 },
        }),
        dataProvider.getList("propiedades-servicios", {
          filter: { propiedad_id: propiedadId },
          sort: { field: "id", order: "ASC" },
          pagination: { page: 1, perPage: 500 },
        }),
      ]);

      const existentes = new Set(
        (serviciosActuales as Array<{ servicio_tipo_id?: unknown }>).map((item) =>
          resolveNumericId(item?.servicio_tipo_id),
        ),
      );

      const faltantes = (serviciosActivos as Array<{ id?: unknown; nombre?: string | null }>).filter(
        (item) => {
          const servicioTipoId = resolveNumericId(item?.id);
          return servicioTipoId && !existentes.has(servicioTipoId);
        },
      );

      if (faltantes.length === 0) {
        notify("La propiedad ya tiene todos los servicios activos", { type: "info" });
        return;
      }

      await Promise.all(
        faltantes.map((item) =>
          dataProvider.create("propiedades-servicios", {
            data: {
              propiedad_id: propiedadId,
              servicio_tipo_id: resolveNumericId(item.id),
              activo: true,
            },
          }),
        ),
      );

      notify(
        faltantes.length === 1
          ? "Se agrego 1 servicio activo"
          : `Se agregaron ${faltantes.length} servicios activos`,
        { type: "info" },
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudieron agregar los servicios activos", { type: "warning" });
      throw error;
    } finally {
      setBusy(false);
    }
  }, [busy, dataProvider, notify, propiedadId, refresh]);

  return { busy, handleAgregarServiciosActivos };
};

const PropiedadServiciosAccionesItem = ({
  propiedadId,
  overlayClassName,
}: {
  propiedadId: number;
  overlayClassName?: string;
}) => {
  const dialog = useRowActionDialog();
  const { busy, handleAgregarServiciosActivos } = useAgregarServiciosActivos(propiedadId);

  return (
    <DropdownMenuItem
      className={FICHA_ACTION_ITEM_CLASSNAME}
      disabled={busy}
      onSelect={(event) => {
        event.stopPropagation();
        dialog?.openDialog({
          title: "Agregar servicios activos",
          content:
            "Se agregaran a la propiedad todos los servicios activos que aun no esten vinculados.",
          confirmLabel: "Agregar",
          confirmColor: "primary",
          overlayClassName,
          onConfirm: handleAgregarServiciosActivos,
        });
      }}
    >
      <Wrench className={FICHA_ACTION_ICON_CLASSNAME} />
      Servicios ++
    </DropdownMenuItem>
  );
};

export const PropiedadServiciosAccionesMenu = ({
  propiedadId,
  overlayClassName,
}: {
  propiedadId: number;
  overlayClassName?: string;
}) => {
  const { busy } = useAgregarServiciosActivos(propiedadId);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          tabIndex={-1}
          aria-label="Acciones de servicios"
          title="Acciones de servicios"
          disabled={busy}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <PropiedadServiciosAccionesItem
          propiedadId={propiedadId}
          overlayClassName={overlayClassName}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ComentarioCell = () => {
  const record = useRecordContext<PropiedadServicioRecord>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(record?.comentario ?? ""));
  }, [open, record?.comentario]);

  if (!record) return null;

  const handleSave = async () => {
    if (!record.id || saving) return;
    setSaving(true);
    try {
      await dataProvider.update("propiedades-servicios", {
        id: record.id,
        data: { comentario: value },
        previousData: record,
      });
      notify("Comentario actualizado", { type: "info" });
      setOpen(false);
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el comentario", { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group block w-full text-left"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            data-row-click="ignore"
            aria-label="Editar comentario"
            title="Editar comentario"
          >
            <span className="inline-block w-full whitespace-normal break-words line-clamp-3 rounded-sm px-1 text-[9px] text-foreground/90 transition group-hover:bg-amber-100/80">
              {record.comentario ? record.comentario : "-"}
              <Pencil className="ml-1 inline-block h-2.5 w-2.5 text-amber-700/70 opacity-0 align-[-1px] transition group-hover:text-amber-700 group-hover:opacity-100" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-72 border-none bg-transparent p-0 shadow-none"
        >
          <SectionBaseTemplate
            title="Editar comentario"
            main={
              <div className="space-y-2">
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-[80px] !px-2 !py-1 !text-[9px] !leading-tight"
                  placeholder="Escribe un comentario..."
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={handleSave}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

type PropiedadServicioListBodyProps = {
  rowClick?: "edit" | false | ((id: string | number) => string);
  showBulkActions?: boolean;
  emptyMessage?: string;
  className?: string;
};

const PropiedadServicioListBody = ({
  rowClick = "edit",
  showBulkActions = true,
  emptyMessage,
  className,
}: PropiedadServicioListBodyProps) => (
  <ResponsiveDataTable
    rowClick={rowClick}
    bulkActionsToolbar={
      showBulkActions ? <FormOrderBulkActionsToolbar /> : undefined
    }
    bulkActionButtons={showBulkActions ? undefined : false}
    emptyMessage={emptyMessage}
    mobileConfig={{
      primaryField: "servicio_tipo_id",
      secondaryFields: ["ref_cliente", "activo"],
      detailFields: [],
    }}
    className={cn(LIST_TABLE_CLASS_NAME, className)}
  >
    <ListColumn source="id" label="ID" className="w-[50px] text-center">
      <ListID source="id" widthClass="w-[50px]" />
    </ListColumn>
    <ListColumn source="servicio_tipo_id" label="Tipo servicio" className="w-[90px]">
      <ReferenceField source="servicio_tipo_id" reference="servicios-tipo" link={false}>
        <ListText source="nombre" className="whitespace-normal break-words" />
      </ReferenceField>
    </ListColumn>
    <ListColumn source="ref_cliente" label="Ref cliente" className="w-[100px]">
      <ListText source="ref_cliente" className="whitespace-normal break-words" />
    </ListColumn>
    <ListColumn label="Abrir" className="w-[40px] text-center">
      <ServicioUrlButton />
    </ListColumn>
    <ListColumn source="comentario" label="Comentario" className="w-[200px]">
      <ComentarioCell />
    </ListColumn>
    <ListColumn source="activo" label="Activo" className="w-[36px]">
      <ListBoolean source="activo" />
    </ListColumn>
    <ListColumn className="w-[60px]">
      <FormOrderListRowActions />
    </ListColumn>
  </ResponsiveDataTable>
);

export const PropiedadServicioList = ({
  embedded = false,
  perPage = 5,
  propiedadId,
  rowClick = "edit",
  createTo,
  filterDefaultValues,
  permanentFilter,
  storeKey,
  emptyMessage,
  showEmbeddedHeader,
  embeddedTitle,
  embeddedExtraActions,
}: PropiedadServicioListProps = {}) => (
  <PropiedadServicioListContent
    embedded={embedded}
    perPage={perPage}
    propiedadId={propiedadId}
    rowClick={rowClick}
    createTo={createTo}
    filterDefaultValues={filterDefaultValues}
    permanentFilter={permanentFilter}
    storeKey={storeKey}
    emptyMessage={emptyMessage}
    showEmbeddedHeader={showEmbeddedHeader}
    embeddedTitle={embeddedTitle}
    embeddedExtraActions={embeddedExtraActions}
  />
);

const PropiedadServicioListContent = ({
  embedded,
  perPage,
  propiedadId,
  rowClick,
  createTo,
  filterDefaultValues,
  permanentFilter,
  storeKey,
  emptyMessage,
  showEmbeddedHeader = false,
  embeddedTitle = "Servicios",
  embeddedExtraActions,
}: Required<Pick<PropiedadServicioListProps, "embedded" | "perPage">> &
  Omit<PropiedadServicioListProps, "embedded" | "perPage">) => {
  const location = useLocation();
  const returnTo = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const resolvedCreateTo = useMemo(() => {
    if (createTo) return createTo;
    if (!embedded || !propiedadId) return undefined;

    const params = new URLSearchParams();
    params.set("propiedad_id", String(propiedadId));
    params.set("lock_propiedad", "1");
    params.set("returnTo", returnTo);
    return `/propiedades-servicios/create?${params.toString()}`;
  }, [createTo, embedded, propiedadId, returnTo]);
  const resolvedRowClick = useMemo(() => {
    if (typeof rowClick === "function" || rowClick === false) return rowClick;
    if (!embedded || !propiedadId || rowClick !== "edit") return rowClick;

    return (id: string | number) =>
      `/propiedades-servicios/${id}?returnTo=${encodeURIComponent(returnTo)}`;
  }, [embedded, propiedadId, returnTo, rowClick]);
  const resolvedFilterDefaults = filterDefaultValues;
  const resolvedPermanentFilter = permanentFilter;
  const resolvedStoreKey = storeKey;
  const hiddenEmbeddedFilterSources = new Set(
    Object.keys(resolvedPermanentFilter ?? {}).filter((key) =>
      isMeaningfulFilterValue(resolvedPermanentFilter?.[key]),
    ),
  );
  const embeddedFilters = buildEmbeddedFilters(hiddenEmbeddedFilterSources);
  const resolvedFilters = embedded ? embeddedFilters : LIST_FILTERS;
  const embeddedActions = embedded ? (
    <EmbeddedServicioListActions
      filters={embeddedFilters}
      createTo={resolvedCreateTo}
      extraActions={embeddedExtraActions}
    />
  ) : undefined;

  return (
    <List
      resource="propiedades-servicios"
      title={embedded ? (showEmbeddedHeader ? embeddedTitle : undefined) : "Servicios"}
      filters={resolvedFilters}
      actions={embedded ? embeddedActions : <ListActions createTo={resolvedCreateTo} />}
      debounce={300}
      perPage={perPage}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      showBreadcrumb={!embedded}
      showHeader={embedded ? showEmbeddedHeader : true}
      filterDefaultValues={resolvedFilterDefaults}
      filter={resolvedPermanentFilter}
      disableSyncWithLocation={embedded}
      storeKey={embedded ? (resolvedStoreKey ?? "propiedades-servicios-embedded") : undefined}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <EmbeddedDefaultFilterSync
        enabled={embedded}
        filterDefaultValues={resolvedFilterDefaults}
      />
      <PropiedadServicioListBody
        rowClick={resolvedRowClick}
        showBulkActions={!embedded}
        emptyMessage={emptyMessage}
      />
    </List>
  );
};
