"use client";

import { useEffect, useState, type HTMLAttributes } from "react";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Target,
  Trash2,
  Workflow,
} from "lucide-react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  IdentityFilterSync,
  ListColumn,
  ListEstado,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  SectionBaseTemplate,
  buildListFilters,
  useIdentityFilterDefaults,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  canUseOportunidadActionForRecord,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  isClosedOportunidad,
  isMantenimientoOportunidad,
  isProspectOportunidad,
} from "./model";
import { captureOportunidadModalBackground } from "./modal_background";

//#region Base CRUD: configuracion del listado

const LIST_FILTERS = buildListFilters(
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
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: CRM_OPORTUNIDAD_ESTADO_CHOICES,
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[80px]",
        alwaysOn: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "responsable_id",
        reference: "users",
        label: "Responsable",
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
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Contacto",
      },
      selectProps: {
        optionText: "nombre_completo",
        className: "w-full",
        emptyText: "Todos",
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
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "text",
      props: {
        source: "propiedad.tipo",
        label: "Tipo de propiedad",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "emprendimiento_id",
        reference: "emprendimientos",
        label: "Emprendimiento",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-oportunidades" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const LIST_CONTAINER_CLASS_NAME = LIST_CONTAINER_WIDE;
const LIST_TABLE_CLASS_NAME = "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]";
const COMPACT_LIST_TABLE_CLASS_NAME = "text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]";
const EMBEDDED_VISIBLE_FILTER_SOURCES = new Set(["q"]);

const buildEmbeddedVisibleFilters = (hiddenSources: Set<string>) =>
  LIST_FILTERS.filter((filterElement) => {
    const source = String(filterElement.props.source ?? "");
    return EMBEDDED_VISIBLE_FILTER_SOURCES.has(source) && !hiddenSources.has(source);
  });

const buildEmbeddedExpandableFilterSources = (hiddenSources: Set<string>) =>
  LIST_FILTERS
    .map((filterElement) => String(filterElement.props.source ?? ""))
    .filter(
      (source) =>
        source &&
        !EMBEDDED_VISIBLE_FILTER_SOURCES.has(source) &&
        !hiddenSources.has(source),
    );

const buildEmbeddedExpandedFilters = (hiddenSources: Set<string>) =>
  LIST_FILTERS.filter((filterElement) => {
    const source = String(filterElement.props.source ?? "");
    return !hiddenSources.has(source);
  });

const OportunidadListTitle = ({ onBack }: { onBack: () => void }) => (
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
      <div className="-mt-0.5 flex items-center justify-center gap-2">
        <Target className="h-4 w-4" />
        <span>CRM Oportunidades</span>
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
      <span className="inline-flex items-center gap-2">
        <Target className="h-4 w-4" />
        CRM Oportunidades
      </span>
    </span>
  </>
);

//#endregion Base CRUD: configuracion del listado

//#region Fuera del patron: helpers de presentacion enriquecida

const getInitials = (value?: string) => {
  if (!value) return "";

  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

const buildListReturnTo = (pathname: string, search: string) =>
  `${pathname}${search}`;

const oportunidadRowClass = (record: any) =>
  record?.activo === false
    ? "text-muted-foreground/70 bg-muted/20 hover:bg-muted/30"
    : undefined;

//#endregion Fuera del patron: helpers de presentacion enriquecida

//#region Fuera del patron: celdas enriquecidas del listado

const ContactoTituloCell = () => (
  <div className="flex flex-col gap-0">
    <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
      <ListText source="nombre_completo" className="font-medium" />
    </ReferenceField>
    <ListText
      source="titulo"
      className="text-[8px] text-muted-foreground leading-tight"
    />
    <ReferenceField
      source="tipo_operacion_id"
      reference="crm/catalogos/tipos-operacion"
      link={false}
    >
      <ListText
        source="nombre"
        className="text-[8px] text-muted-foreground leading-tight"
      />
    </ReferenceField>
  </div>
);

const ResponsableAvatar = () => {
  const record = useRecordContext<any>();
  const name = record?.nombre ?? record?.fullName ?? record?.email ?? "";
  const initials = getInitials(name);
  const avatarUrl = record?.avatar ?? record?.url_foto ?? "";

  return (
    <Avatar className="size-6 border border-slate-200">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-slate-100 text-[9px] font-semibold text-slate-600">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
};

const DescripcionCell = () => {
  const record = useRecordContext<any>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(record?.descripcion_estado ?? ""));
  }, [open, record?.descripcion_estado]);

  if (!record) return null;

  const handleSave = async () => {
    if (!record?.id || saving) return;

    setSaving(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { descripcion_estado: value },
        previousData: record,
      });
      notify("Descripcion actualizada", { type: "info" });
      setOpen(false);
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la descripcion", { type: "warning" });
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
            aria-label="Editar descripcion"
            title="Editar descripcion"
          >
            <span className="inline-block w-full whitespace-normal break-words line-clamp-3 rounded-sm px-1 text-[9px] text-foreground/90 transition group-hover:bg-amber-100/80">
              {record.descripcion_estado ? record.descripcion_estado : "-"}
              <Pencil className="ml-1 inline-block h-2.5 w-2.5 text-amber-700/70 opacity-0 transition group-hover:opacity-100 group-hover:text-amber-700 align-[-1px]" />
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
            title="Editar descripcion"
            main={
              <div className="space-y-2">
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-[80px] !text-[9px] !leading-tight px-2 py-1"
                  placeholder="Escribe una descripcion..."
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

//#endregion Fuera del patron: celdas enriquecidas del listado

//#region Fuera del patron: acciones operativas y contexto

const OportunidadEliminarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  if (
    !record?.id ||
    !isProspectOportunidad(record.estado) ||
    isMantenimientoOportunidad(record)
  ) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        const recordPayload = {
          id: record.id,
          contacto_id: record.contacto_id,
          titulo: record.titulo,
          descripcion_estado: record.descripcion_estado,
          fecha_estado: record.fecha_estado,
          created_at: record.created_at,
        };
        navigate(`/crm/oportunidades/${record.id}/accion_descartar`, {
          state: {
            returnTo,
            record: recordPayload,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      variant="destructive"
    >
      <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Eliminar
    </DropdownMenuItem>
  );
};

const OportunidadAceptarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  if (
    !record?.id ||
    !isProspectOportunidad(record.estado) ||
    isMantenimientoOportunidad(record)
  ) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        navigate(`/crm/oportunidades/${record.id}/accion_aceptar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Confirmar
    </DropdownMenuItem>
  );
};

const OportunidadCambioEstadoMenu = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  const canAgendar = canUseOportunidadActionForRecord(record, "agendar");
  const canCotizar = canUseOportunidadActionForRecord(record, "cotizar");
  const canReservar = canUseOportunidadActionForRecord(record, "reservar");
  const canCerrar = canUseOportunidadActionForRecord(record, "cerrar");
  const hasStateActions = canAgendar || canCotizar || canReservar || canCerrar;

  if (!record?.id || isClosedOportunidad(record.estado) || !hasStateActions) {
    return null;
  }
  const goTo = (path: string) => {
    navigate(path, {
      state: {
        returnTo,
        background: captureOportunidadModalBackground(),
      },
    });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onClick={(event) => event.stopPropagation()}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Cambiar estado
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-28 sm:w-36">
        {canAgendar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_agendar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Agendar
          </DropdownMenuItem>
        ) : null}
        {canCotizar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cotizar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cotizar
          </DropdownMenuItem>
        ) : null}
        {canReservar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_reservar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Reservar
          </DropdownMenuItem>
        ) : null}
        {canCerrar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cerrar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cerrar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

//#endregion Fuera del patron: acciones operativas y contexto

//#region Base CRUD: componentes principales

const CRMOportunidadListActions = () => (
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

const EmbeddedOportunidadFilterDiv = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <StyledFilterDiv
    {...props}
    className={cn(
      "!grid !min-w-0 !flex-1 !items-start !gap-3",
      "grid-cols-1 sm:grid-cols-3",
      "[&_[data-source=q]]:sm:col-span-full",
      "[&_[data-source=q]]:sm:row-start-1",
      "[&_[data-source]:not([data-source=q])]:sm:row-start-2",
      className,
    )}
  />
);

const EmbeddedOportunidadListActions = ({
  createTo,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  filterDefaultValues,
  expandableFilterSources,
}: {
  createTo?: string;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  filterDefaultValues?: Record<string, unknown>;
  expandableFilterSources: string[];
}) => {
  const { filterValues } = useListContext();
  const activeAdvancedFiltersCount = expandableFilterSources.reduce(
    (count, source) => {
      const value = filterValues?.[source];
      if (!isMeaningfulFilterValue(value)) return count;

      const defaultValue = filterDefaultValues?.[source];
      if (isEqual(value, defaultValue)) return count;

      return count + 1;
    },
    0,
  );

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={showAdvancedFilters ? "secondary" : "outline"}
        size="sm"
        className={ACTION_BUTTON_CLASS}
        onClick={onToggleAdvancedFilters}
      >
        {showAdvancedFilters
          ? "Ocultar filtros"
          : activeAdvancedFiltersCount > 0
            ? `Mas filtros (${activeAdvancedFiltersCount})`
            : "Mas filtros"}
      </Button>
      <CreateButton
        to={createTo}
        className={ACTION_BUTTON_CLASS}
        label="Agregar"
      />
      <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
    </div>
  );
};

type CRMOportunidadListProps = {
  embedded?: boolean;
  filterDefaultValues?: Record<string, unknown>;
  permanentFilter?: Record<string, unknown>;
  createTo?: string;
  storeKey?: string;
  compact?: boolean;
  showBulkActions?: boolean;
  rowClick?: "edit" | "show" | "expand" | false | undefined;
  emptyMessage?: string;
};

type CRMOportunidadListBodyProps = {
  identityId?: number | string;
  compact?: boolean;
  showBulkActions?: boolean;
  rowClick?: "edit" | "show" | "expand" | false | undefined;
  className?: string;
  emptyMessage?: string;
};

export const CRMOportunidadListBody = ({
  identityId,
  compact = false,
  showBulkActions = true,
  rowClick = "edit",
  className,
  emptyMessage,
}: CRMOportunidadListBodyProps) => (
  <>
    {identityId ? (
      <IdentityFilterSync identityId={identityId} source="responsable_id" />
    ) : null}
    <ResponsiveDataTable
      rowClick={rowClick}
      bulkActionsToolbar={
        showBulkActions ? <FormOrderBulkActionsToolbar /> : undefined
      }
      bulkActionButtons={showBulkActions ? undefined : false}
      compact={compact}
      rowClassName={oportunidadRowClass}
      emptyMessage={emptyMessage}
      className={cn(
        compact ? COMPACT_LIST_TABLE_CLASS_NAME : LIST_TABLE_CLASS_NAME,
        className,
      )}
    >
      <ListColumn source="id" label="ID" className="w-[40px] text-center">
        <ListID source="id" widthClass="w-[40px]" />
      </ListColumn>
      <ListColumn source="contacto_id" label="Contacto" className="w-[100px]">
        <ContactoTituloCell />
      </ListColumn>
      <ListColumn source="estado" label="Estado" className="w-[75px]">
        <ListEstado source="estado" statusClasses={CRM_OPORTUNIDAD_ESTADO_BADGES} />
      </ListColumn>
      <ListColumn source="responsable_id" label="Resp" className="w-[60px]">
        <ReferenceField source="responsable_id" reference="users" link={false}>
          <ResponsableAvatar />
        </ReferenceField>
      </ListColumn>
      <ListColumn
        source="descripcion_estado"
        label="Descripcion"
        className="w-[140px]"
      >
        <DescripcionCell />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[70px]">
        <FormOrderListRowActions
          showDelete={false}
          extraMenuItems={
            <>
              <OportunidadEliminarMenuItem />
              <OportunidadAceptarMenuItem />
              <OportunidadCambioEstadoMenu />
            </>
          }
        />
      </ListColumn>
    </ResponsiveDataTable>
  </>
);

export const CRMOportunidadList = ({
  embedded = false,
  filterDefaultValues,
  permanentFilter,
  createTo,
  storeKey,
  compact,
  showBulkActions = true,
  rowClick = "edit",
  emptyMessage,
}: CRMOportunidadListProps = {}) => {
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "responsable_id",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hiddenEmbeddedFilterSources = new Set(
    Object.keys(permanentFilter ?? {}).filter((key) =>
      isMeaningfulFilterValue(permanentFilter?.[key]),
    ),
  );
  const resolvedFilterDefaults = embedded ? filterDefaultValues : defaultFilters;
  const embeddedCollapsedFilters = buildEmbeddedVisibleFilters(hiddenEmbeddedFilterSources);
  const embeddedExpandedFilters = buildEmbeddedExpandedFilters(hiddenEmbeddedFilterSources);
  const embeddedExpandableFilterSources =
    buildEmbeddedExpandableFilterSources(hiddenEmbeddedFilterSources);
  const resolvedFilters = embedded
    ? showAdvancedFilters
      ? embeddedExpandedFilters
      : embeddedCollapsedFilters
    : LIST_FILTERS;
  const embeddedActions = embedded ? (
    <EmbeddedOportunidadListActions
      createTo={createTo}
      showAdvancedFilters={showAdvancedFilters}
      onToggleAdvancedFilters={() => setShowAdvancedFilters((current) => !current)}
      filterDefaultValues={resolvedFilterDefaults}
      expandableFilterSources={embeddedExpandableFilterSources}
    />
  ) : undefined;

  const handleBack = () => {
    const stateReturnTo =
      (location.state as { returnTo?: string | null } | null)?.returnTo ?? undefined;
    if (stateReturnTo) {
      navigate(stateReturnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/crm");
  };

  return (
    <List
      resource="crm/oportunidades"
      title={embedded ? undefined : <OportunidadListTitle onBack={handleBack} />}
      filters={resolvedFilters}
      actions={embedded ? embeddedActions : <CRMOportunidadListActions />}
      debounce={300}
      perPage={10}
      filter={permanentFilter}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_CLASS_NAME}
      pagination={<ListPaginator />}
      sort={{ field: "created_at", order: "DESC" }}
      filterDefaultValues={resolvedFilterDefaults}
      disableSyncWithLocation={embedded}
      storeKey={embedded ? storeKey : undefined}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      filterFormComponent={embedded ? EmbeddedOportunidadFilterDiv : undefined}
    >
      <EmbeddedDefaultFilterSync
        enabled={embedded}
        filterDefaultValues={resolvedFilterDefaults}
      />
      <CRMOportunidadListBody
        identityId={embedded ? undefined : identityId}
        compact={compact ?? embedded}
        showBulkActions={embedded ? false : showBulkActions}
        rowClick={rowClick}
        emptyMessage={emptyMessage}
      />
    </List>
  );
};

export default CRMOportunidadList;

//#endregion Base CRUD: componentes principales
