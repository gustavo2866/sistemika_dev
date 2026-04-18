"use client";

import { cloneElement, useEffect, useState } from "react";
import isEqual from "lodash/isEqual";
import { ExternalLink, Pencil } from "lucide-react";
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
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  const hiddenEmbeddedFilterSources = new Set(
    Object.keys(permanentFilter ?? {}).filter((key) =>
      isMeaningfulFilterValue(permanentFilter?.[key]),
    ),
  );
  const resolvedFilterDefaults = filterDefaultValues;
  const embeddedFilters = buildEmbeddedFilters(hiddenEmbeddedFilterSources);
  const resolvedFilters = embedded ? embeddedFilters : LIST_FILTERS;
  const embeddedActions = embedded ? (
    <EmbeddedServicioListActions
      filters={embeddedFilters}
      createTo={createTo}
      extraActions={embeddedExtraActions}
    />
  ) : undefined;

  return (
    <List
      resource="propiedades-servicios"
      title={embedded ? (showEmbeddedHeader ? embeddedTitle : undefined) : "Servicios"}
      filters={resolvedFilters}
      actions={embedded ? embeddedActions : <ListActions createTo={createTo} />}
      debounce={300}
      perPage={perPage}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      showBreadcrumb={!embedded}
      showHeader={embedded ? showEmbeddedHeader : true}
      filterDefaultValues={resolvedFilterDefaults}
      filter={permanentFilter}
      disableSyncWithLocation={embedded}
      storeKey={embedded ? (storeKey ?? "propiedades-servicios-embedded") : undefined}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <EmbeddedDefaultFilterSync
        enabled={embedded}
        filterDefaultValues={resolvedFilterDefaults}
      />
      <PropiedadServicioListBody
        rowClick={rowClick}
        showBulkActions={!embedded}
        emptyMessage={emptyMessage}
      />
    </List>
  );
};
