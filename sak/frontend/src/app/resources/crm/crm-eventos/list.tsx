"use client";

import { useEffect, useMemo, useState } from "react";
import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TodoBoard } from "@/components/todo/todo-board";
import { AlarmClock, Calendar, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, House, MessageCircle, ArrowLeft } from "lucide-react";
import { useGetIdentity, useGetOne, useListContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import type { CRMEvento, FechaBucket } from "./model";
import { bucketLabels, bucketOrder, getFechaBucketLabel, isEventoCompleted } from "./model";
import { CRMEventoTodoItem } from "./todo-item";
import { FormCompletarDialog } from "./form_completar";
import { buildListFilters } from "@/components/forms/form_order";
import type { FilterElementProps } from "@/hooks/filter-context";
import {
  appendFilterParam,
  buildOportunidadFilter,
  buildReturnToWithOportunidad,
  getContextFromLocation,
  getOportunidadIdFromLocation,
  getReturnToFromLocation,
} from "@/lib/oportunidad-context";

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "hecho", name: "Hecho" },
];

export const MinimalActivosToggleFilter = ({
  source = "solo_pendientes",
  className,
}: FilterElementProps & { className?: string }) => {
  const { filterValues, setFilters } = useListContext();
  const isActivos = Boolean((filterValues as Record<string, unknown>)[source]);

  const setMode = (activos: boolean) => {
    const next = { ...filterValues } as Record<string, unknown>;
    if (activos) {
      next[source] = true;
    } else {
      delete next[source];
    }
    setFilters(next, {});
  };

  return (
    <div className={`compact-filter flex items-end ${className ?? ""}`}>
      <div className="flex items-center gap-0 leading-none text-blue-600 [&_button]:!h-[10px] sm:[&_button]:!h-[11px] [&_button]:!min-h-0 [&_button]:!px-[2px] [&_button]:!pt-0 [&_button]:!pb-0 [&_button]:!m-0 [&_button]:border [&_button]:border-slate-200/60 [&_button]:rounded-sm [&_button]:!leading-none [&_button]:min-w-[44px] [&_button]:text-center [&_button]:flex [&_button]:items-center [&_button]:justify-center">
        <button
          type="button"
          onClick={() => setMode(true)}
          style={{ padding: 0 }}
          className={
            isActivos
              ? "font-semibold text-white bg-slate-900 !text-[8px] sm:!text-[9px] leading-none px-[3px] py-0"
              : "text-muted-foreground !text-[8px] sm:!text-[9px] leading-none px-[3px] py-0 hover:text-slate-700"
          }
        >
          Activos
        </button>
        <span className="text-muted-foreground !text-[8px] sm:!text-[9px] leading-none mx-0">/</span>
        <button
          type="button"
          onClick={() => setMode(false)}
          style={{ padding: 0 }}
          className={
            !isActivos
              ? "font-semibold text-white bg-slate-900 !text-[8px] sm:!text-[9px] leading-none px-[3px] py-0"
              : "text-muted-foreground !text-[8px] sm:!text-[9px] leading-none px-[3px] py-0 hover:text-slate-700"
          }
        >
          Todos
        </button>
      </div>
    </div>
  );
};

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar eventos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "asignado_a_id",
        reference: "users",
        label: "Responsable",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
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
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "select",
      props: {
        source: "estado_evento",
        label: "Estado",
        choices: estadoChoices,
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[90px]",
      },
    },
    {
      type: "custom",
      element: (
        <MinimalActivosToggleFilter
          key="solo_pendientes"
          source="solo_pendientes"
          alwaysOn
          className="ml-auto"
        />
      ),
    },
  ],
  { keyPrefix: "crm-eventos" },
);

// Top-right list actions with filters/create/export buttons.
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} to={createTo} />
    <ExportButton className={ACTION_BUTTON_CLASS} />
  </div>
);

// Main CRM eventos list view with contextual header, filters, and todo board.
export const CRMEventoList = () => {
  const { data: identity } = useGetIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const responsableId = useMemo(() => {
    const numeric = Number(identity?.id);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [identity?.id]);
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const context = getContextFromLocation(location);
  const fromChat = context === "chat";
  const fromOportunidad = context === "oportunidad";
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadIdFilter ?? 0 },
    { enabled: Boolean(oportunidadIdFilter) }
  );
  const contactoId = (oportunidad as any)?.contacto_id ?? null;

  const defaultFilters = useMemo(() => {
    if (oportunidadIdFilter) {
      const base: Record<string, unknown> = {
        default_scope: "pendientes_mes",
        oportunidad_id: oportunidadIdFilter,
        solo_pendientes: true,
      };
      if (fromChat && contactoId) {
        base.contacto_id = contactoId;
      }
      return base;
    }
    return {
      default_scope: "pendientes_mes",
      solo_pendientes: true,
      ...(responsableId ? { asignado_a_id: responsableId } : {}),
    };
  }, [contactoId, fromChat, oportunidadIdFilter, responsableId]);
  const listKey = oportunidadIdFilter
    ? `crm-eventos-op-${oportunidadIdFilter}${fromChat && contactoId ? `-co-${contactoId}` : ""}`
    : responsableId
      ? `crm-eventos-${responsableId}`
      : "crm-eventos";
  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const contactoNombre =
    (contacto as any)?.nombre_completo ??
    (contacto as any)?.nombre ??
    (oportunidad as any)?.contacto?.nombre_completo ??
    (oportunidad as any)?.contacto?.nombre ??
    (oportunidad as any)?.contacto_nombre ??
    null;
  const oportunidadTitulo =
    (oportunidad as any)?.titulo ??
    (oportunidad as any)?.descripcion_estado ??
    (oportunidadIdFilter ? `Oportunidad #${oportunidadIdFilter}` : "");
  const returnTo = getReturnToFromLocation(location);
  const handleOpenChat = () => {
    if (!oportunidadIdFilter) return;
    const params = new URLSearchParams();
    params.set(
      "returnTo",
      returnTo ?? buildReturnToWithOportunidad("/crm/crm-eventos", oportunidadIdFilter),
    );
    navigate(`/crm/chat/op-${oportunidadIdFilter}/show?${params.toString()}`);
  };
  const handleOpenOportunidad = () => {
    if (!oportunidadIdFilter) return;
    const params = new URLSearchParams();
    params.set(
      "returnTo",
      returnTo ?? buildReturnToWithOportunidad("/crm/crm-eventos", oportunidadIdFilter),
    );
    navigate(`/crm/oportunidades/${oportunidadIdFilter}?${params.toString()}`);
  };
  const createTo = useMemo(() => {
    const createPath = "/crm/crm-eventos/create";
    if (!oportunidadIdFilter) return createPath;
    const params = new URLSearchParams();
    appendFilterParam(
      params,
      buildOportunidadFilter(oportunidadIdFilter, contactoId ? { contacto_id: contactoId } : undefined),
    );
    params.set(
      "returnTo",
      returnTo ?? buildReturnToWithOportunidad("/crm/crm-eventos", oportunidadIdFilter),
    );
    return `${createPath}?${params.toString()}`;
  }, [contactoId, oportunidadIdFilter, returnTo]);

  return (
    <List
      key={listKey}
      title={
        <ResourceTitle
          icon={CalendarCheck}
          text="CRM - Eventos"
          iconWrapperClassName="h-9 w-9 rounded-xl bg-rose-100 text-rose-700"
          iconClassName="h-4 w-4"
        />
      }
      filters={LIST_FILTERS}
      filterDefaultValues={defaultFilters}
      actions={<ListActions createTo={createTo} />}
      perPage={300}
      sort={{ field: "fecha_evento", order: "DESC" }}
      className="space-y-5"
    >
      <CRMEventoListBody
        fromChat={fromChat}
        fromOportunidad={fromOportunidad}
        responsableId={responsableId}
        oportunidadIdFilter={oportunidadIdFilter ?? undefined}
        contactoNombre={contactoNombre}
        oportunidadTitulo={oportunidadTitulo}
        returnTo={returnTo}
        onBack={() => {
          if (returnTo) {
            navigate(returnTo);
          } else {
            navigate(-1);
          }
        }}
        onOpenChat={handleOpenChat}
        onOpenOportunidad={handleOpenOportunidad}
      />
    </List>
  );
};

type CRMEventoListBodyProps = {
  fromChat: boolean;
  fromOportunidad: boolean;
  responsableId?: number;
  oportunidadIdFilter?: number;
  contactoNombre?: string | null;
  oportunidadTitulo?: string | null;
  returnTo?: string | null;
  onBack?: () => void;
  onOpenChat?: () => void;
  onOpenOportunidad?: () => void;
  showContextHeader?: boolean;
  compact?: boolean;
  showCreateButton?: boolean;
  createTo?: string;
};

export const CRMEventoListBody = ({
  fromChat,
  fromOportunidad,
  responsableId,
  oportunidadIdFilter,
  contactoNombre,
  oportunidadTitulo,
  onBack,
  onOpenChat,
  onOpenOportunidad,
  showContextHeader = true,
  compact = false,
  showCreateButton = false,
  createTo,
}: CRMEventoListBodyProps) => {
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [selectedCompletar, setSelectedCompletar] = useState<CRMEvento | null>(null);
  const shouldShowHeader = Boolean(showContextHeader && oportunidadIdFilter);
  const containerClassName = compact
    ? "rounded-xl border border-slate-200/70 bg-white/95 p-1 shadow-sm"
    : "rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-sm sm:p-3";

  return (
    <>
      <EventosFilterSync
        fromChat={fromChat}
        fromOportunidad={fromOportunidad}
        responsableId={responsableId}
      />
      <div className={containerClassName}>
        {compact && showCreateButton ? (
          <div className="flex items-center justify-end pb-1">
            <CreateButton
              className="h-6 px-2 text-[10px]"
              label="Agregar"
              to={createTo}
            />
          </div>
        ) : null}
        {shouldShowHeader ? (
          <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm sm:mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onBack ?? (() => {})}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="size-9 border border-slate-200">
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
                {(contactoNombre ?? "Contacto")
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((part: string) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {contactoNombre ?? "Contacto"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {oportunidadTitulo} ({oportunidadIdFilter})
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-slate-400">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onOpenChat ?? (() => {})}
                disabled={!oportunidadIdFilter}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onOpenOportunidad ?? (() => {})}
                disabled={!oportunidadIdFilter}
              >
                <House className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
        <EventosTodoList
          onCompletar={(evento) => {
            setSelectedCompletar(evento);
            setCompletarDialogOpen(true);
          }}
          compact={compact}
        />
      </div>
      <FormCompletarDialog
        open={completarDialogOpen}
        onOpenChange={setCompletarDialogOpen}
        selectedEvento={selectedCompletar}
        onSuccess={() => {
          setSelectedCompletar(null);
        }}
        onError={() => {
          setSelectedCompletar(null);
        }}
      />
    </>
  );
};

// Keeps list filters in sync with default context when not opened from other modules.
const EventosFilterSync = ({
  fromChat,
  fromOportunidad,
  responsableId,
}: {
  fromChat: boolean;
  fromOportunidad: boolean;
  responsableId?: number;
}) => {
  const { filterValues, setFilters } = useListContext<CRMEvento>();
  const [hasInitialized, setHasInitialized] = useState(false);
  const shouldSkipSync = fromChat || fromOportunidad;

  useEffect(() => {
    if (shouldSkipSync) {
      if (!hasInitialized) {
        setHasInitialized(true);
      }
      return;
    }
    const nextFilters = { ...filterValues };
    const hadContacto = "contacto_id" in nextFilters;
    const hadOportunidad = "oportunidad_id" in nextFilters;
    const hasResponsable =
      typeof (nextFilters as { asignado_a_id?: unknown }).asignado_a_id !== "undefined" &&
      (nextFilters as { asignado_a_id?: unknown }).asignado_a_id !== null &&
      String((nextFilters as { asignado_a_id?: unknown }).asignado_a_id).trim().length > 0;
    const needsScope = !("default_scope" in nextFilters);
    const needsSoloPendientes = !("solo_pendientes" in nextFilters);
    let didChange = false;

    if (!hasInitialized && needsSoloPendientes) {
      nextFilters.solo_pendientes = true;
      didChange = true;
    }

    if (hadContacto) {
      delete nextFilters.contacto_id;
      didChange = true;
    }
    if (hadOportunidad) {
      delete nextFilters.oportunidad_id;
      didChange = true;
    }
    if (!hasInitialized && !hasResponsable && responsableId) {
      nextFilters.asignado_a_id = responsableId;
      didChange = true;
    }
    if (needsScope) {
      nextFilters.default_scope = "pendientes_mes";
      didChange = true;
    }
    if (didChange) {
      setFilters(nextFilters, {});
    }
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [filterValues, shouldSkipSync, hasInitialized, responsableId, setFilters]);

  return null;
};

const bucketIcons: Record<FechaBucket, React.ComponentType<{ className?: string }>> = {
  vencido: AlarmClock,
  hoy: CalendarDays,
  manana: Calendar,
  semana: CalendarRange,
  siguientes: CalendarClock,
};

const bucketIconClass: Record<FechaBucket, string> = {
  vencido: "text-rose-400",
  hoy: "text-emerald-400",
  manana: "text-sky-400",
  semana: "text-amber-400",
  siguientes: "text-slate-400",
};

const bucketDefinitions = bucketOrder.map((bucket) => ({
  id: bucket,
  label: bucketLabels[bucket],
  icon: bucketIcons[bucket],
  iconClassName: bucketIconClass[bucket],
}));

// Groups eventos by bucket and renders them via the reusable TodoBoard.
const EventosTodoList = ({
  onCompletar,
  compact = false,
}: {
  onCompletar: (evento: CRMEvento) => void;
  compact?: boolean;
}) => {
  const { data = [], isLoading, filterValues } = useListContext<CRMEvento>();
  const soloPendientes = Boolean((filterValues as { solo_pendientes?: boolean })?.solo_pendientes);

  const filteredData = useMemo(
    () => (soloPendientes ? data.filter((evento) => !isEventoCompleted(evento)) : data),
    [data, soloPendientes]
  );

  return (
    <TodoBoard
      items={filteredData}
      isLoading={isLoading}
      loadingText="Cargando eventos..."
      emptyText="Sin eventos"
      emptyBucketText="Sin eventos"
      buckets={bucketDefinitions}
      getBucket={(evento) => getFechaBucketLabel(evento.fecha_evento)}
      getItemKey={(evento) => evento.id}
      sortItems={(a, b) => {
        const aTime = a.fecha_evento ? new Date(a.fecha_evento).getTime() : 0;
        const bTime = b.fecha_evento ? new Date(b.fecha_evento).getTime() : 0;
        return bTime - aTime;
      }}
      renderItem={(evento) => (
        <CRMEventoTodoItem record={evento} onCompletar={onCompletar} compact={compact} />
      )}
      compact={compact}
      collapseAllByDefault
    />
  );
};
