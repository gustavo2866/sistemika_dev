"use client";

import { useEffect, useMemo, useState } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { TextInput } from "@/components/text-input";
import { ResourceTitle } from "@/components/resource-title";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SoloActivasToggleFilter } from "@/components/lists/solo-activas-toggle";
import { TodoBoard } from "@/components/todo/todo-board";
import { AlarmClock, Calendar, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, House, MessageCircle, ArrowLeft } from "lucide-react";
import { useGetIdentity, useGetOne, useListContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import type { CRMEvento, FechaBucket } from "./model";
import { bucketLabels, bucketOrder, getFechaBucketLabel, isEventoCompleted } from "./model";
import { CRMEventoTodoItem } from "./todo-item";
import { FormCompletarDialog } from "./form_completar";
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

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Buscar"
    placeholder="Buscar eventos"
    className="w-[120px] sm:w-[170px] [&_input]:h-7 [&_input]:px-2.5 [&_input]:py-1 [&_input]:text-[10px] [&_input]:leading-none sm:[&_input]:h-9 sm:[&_input]:px-3 sm:[&_input]:py-2 sm:[&_input]:text-sm sm:[&_input]:leading-normal"
    alwaysOn
  />,
  <ReferenceInput
    key="asignado_a_id"
    source="asignado_a_id"
    reference="users"
    label={false}
    alwaysOn
  >
    <SelectInput
      optionText="nombre"
      emptyText="Todos"
      label="Responsable"
      triggerProps={{
        size: "sm",
        className:
          "h-7 gap-1 px-2 py-0.5 text-[10px] leading-none text-left [&_[data-slot=select-value]]:text-left sm:h-9 sm:px-3 sm:py-2 sm:text-sm sm:leading-normal",
      }}
    />
  </ReferenceInput>,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput
      optionText="nombre_completo"
      emptyText="Todos"
      triggerProps={{
        size: "sm",
        className:
          "h-7 gap-1 px-2 py-0.5 text-[10px] leading-none text-left [&_[data-slot=select-value]]:text-left sm:h-9 sm:px-3 sm:py-2 sm:text-sm sm:leading-normal",
      }}
    />
  </ReferenceInput>,
  <SelectInput
    key="estado_evento"
    source="estado_evento"
    label="Estado"
    choices={estadoChoices}
    emptyText="Todos"
    triggerProps={{
      size: "sm",
      className:
        "h-7 gap-1 px-2 py-0.5 text-[10px] leading-none text-left [&_[data-slot=select-value]]:text-left sm:h-9 sm:px-3 sm:py-2 sm:text-sm sm:leading-normal",
    }}
  />,
  <SoloActivasToggleFilter
    key="solo_pendientes"
    source="solo_pendientes"
    label="Activos"
    alwaysOn
    className="ml-auto"
  />,
];

// Top-right list actions with filters/create/export buttons.
const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
    />
    <CreateButton
      size="sm"
      className="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
      to={createTo}
    />
    <ExportButton
      size="sm"
      className="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
    />
  </div>
);

// Main CRM eventos list view with contextual header, filters, and todo board.
export const CRMEventoList = () => {
  const { data: identity } = useGetIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [selectedCompletar, setSelectedCompletar] = useState<CRMEvento | null>(null);
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
      returnTo ?? buildReturnToWithOportunidad("/crm/eventos", oportunidadIdFilter),
    );
    navigate(`/crm/chat/op-${oportunidadIdFilter}/show?${params.toString()}`);
  };
  const handleOpenOportunidad = () => {
    if (!oportunidadIdFilter) return;
    const params = new URLSearchParams();
    params.set(
      "returnTo",
      returnTo ?? buildReturnToWithOportunidad("/crm/eventos", oportunidadIdFilter),
    );
    navigate(`/crm/oportunidades/${oportunidadIdFilter}?${params.toString()}`);
  };
  const createTo = useMemo(() => {
    const createPath = "/crm/eventos/create";
    if (!oportunidadIdFilter) return createPath;
    const params = new URLSearchParams();
    appendFilterParam(
      params,
      buildOportunidadFilter(oportunidadIdFilter, contactoId ? { contacto_id: contactoId } : undefined),
    );
    params.set(
      "returnTo",
      returnTo ?? buildReturnToWithOportunidad("/crm/eventos", oportunidadIdFilter),
    );
    return `${createPath}?${params.toString()}`;
  }, [contactoId, oportunidadIdFilter, returnTo]);

  return (
    <List
      key={listKey}
      title={<ResourceTitle icon={CalendarCheck} text="CRM - Eventos" />}
      filters={filters}
      filterDefaultValues={defaultFilters}
      actions={<ListActions createTo={createTo} />}
      perPage={300}
      pagination={false}
      sort={{ field: "fecha_evento", order: "DESC" }}
      className="space-y-5"
    >
        <EventosFilterSync
          fromChat={fromChat}
          fromOportunidad={fromOportunidad}
          responsableId={responsableId}
        />
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-sm sm:p-3">
        {oportunidadIdFilter ? (
          <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm sm:mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (returnTo) {
                  navigate(returnTo);
                } else {
                  navigate(-1);
                }
              }}
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
                onClick={handleOpenChat}
                disabled={!oportunidadIdFilter}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenOportunidad}
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
    </List>
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
const EventosTodoList = ({ onCompletar }: { onCompletar: (evento: CRMEvento) => void }) => {
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
      renderItem={(evento) => <CRMEventoTodoItem record={evento} onCompletar={onCompletar} />}
      collapseAllByDefault
    />
  );
};
