"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { TextInput } from "@/components/text-input";
import { cn } from "@/lib/utils";
import { ResourceTitle } from "@/components/resource-title";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SoloActivasToggleFilter } from "@/components/lists/solo-activas-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlarmClock,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  Flag,
  House,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useDataProvider, useGetIdentity, useGetOne, useListContext, useNotify, useRefresh } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import type { CRMEvento } from "./model";
import { FormCompletarDialog } from "./form_completar";
import { Confirm } from "@/components/confirm";

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

const getOportunidadIdFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  const rawFilter = params.get("filter");
  if (rawFilter) {
    try {
      const parsed = JSON.parse(rawFilter);
      if (parsed?.oportunidad_id) return parsed.oportunidad_id;
    } catch {
      // ignore invalid filter param
    }
  }
  const direct = params.get("oportunidad_id");
  if (direct) return direct;
  return undefined;
};

const getContactoIdFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  const rawFilter = params.get("filter");
  if (rawFilter) {
    try {
      const parsed = JSON.parse(rawFilter);
      if (parsed?.contacto_id) return parsed.contacto_id;
    } catch {
      // ignore invalid filter param
    }
  }
  const direct = params.get("contacto_id");
  if (direct) return direct;
  return undefined;
};

const getReturnToFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  return params.get("returnTo") ?? undefined;
};

const getContextFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  return params.get("context") ?? undefined;
};

export const CRMEventoList = () => {
  const { data: identity } = useGetIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [selectedCompletar, setSelectedCompletar] = useState<CRMEvento | null>(null);
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const context = getContextFromLocation(location);
  const fromChat = context === "chat";
  const fromOportunidad = context === "oportunidad";
  const fromSolicitudes = context === "solicitudes";
  const contactoIdFromLocation = getContactoIdFromLocation(location);
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
      ...(identity?.id ? { asignado_a_id: identity.id } : {}),
    };
  }, [contactoId, fromChat, identity?.id, oportunidadIdFilter]);
  const listKey = oportunidadIdFilter
    ? `crm-eventos-op-${oportunidadIdFilter}${fromChat && contactoId ? `-co-${contactoId}` : ""}`
    : identity?.id
      ? `crm-eventos-${identity.id}`
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
      returnTo ??
        `/crm/eventos?filter=${encodeURIComponent(
          JSON.stringify({ oportunidad_id: oportunidadIdFilter }),
        )}`,
    );
    navigate(`/crm/chat/op-${oportunidadIdFilter}/show?${params.toString()}`);
  };
  const handleOpenOportunidad = () => {
    if (!oportunidadIdFilter) return;
    const params = new URLSearchParams();
    params.set(
      "returnTo",
      returnTo ??
        `/crm/eventos?filter=${encodeURIComponent(
          JSON.stringify({ oportunidad_id: oportunidadIdFilter }),
        )}`,
    );
    navigate(`/crm/oportunidades/${oportunidadIdFilter}?${params.toString()}`);
  };
  const handleOpenSolicitudes = () => {
    if (!oportunidadIdFilter) return;
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ oportunidad_id: oportunidadIdFilter }));
    params.set(
      "returnTo",
      returnTo ??
        `/crm/eventos?filter=${encodeURIComponent(
          JSON.stringify({ oportunidad_id: oportunidadIdFilter }),
        )}`,
    );
    navigate(`/po-solicitudes?${params.toString()}`);
  };
  const createTo = useMemo(() => {
    const createPath = "/crm/eventos/create";
    if (!oportunidadIdFilter) return createPath;
    const params = new URLSearchParams();
    params.set(
      "filter",
      JSON.stringify({
        oportunidad_id: oportunidadIdFilter,
        ...(contactoId ? { contacto_id: contactoId } : {}),
      }),
    );
    params.set(
      "returnTo",
      returnTo ??
        `/crm/eventos?filter=${encodeURIComponent(
          JSON.stringify({ oportunidad_id: oportunidadIdFilter }),
        )}`,
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
        fromSolicitudes={fromSolicitudes}
        responsableId={typeof identity?.id === "number" ? identity.id : undefined}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenSolicitudes}
                disabled={!oportunidadIdFilter}
              >
                <FileText className="h-4 w-4" />
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

const EventosFilterSync = ({
  fromChat,
  fromOportunidad,
  fromSolicitudes,
  responsableId,
}: {
  fromChat: boolean;
  fromOportunidad: boolean;
  fromSolicitudes: boolean;
  responsableId?: number;
}) => {
  const { filterValues, setFilters } = useListContext<CRMEvento>();
  const [hasInitialized, setHasInitialized] = useState(false);
  const shouldSkipSync = fromChat || fromOportunidad || fromSolicitudes;

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
    const hasResponsable = "asignado_a_id" in nextFilters;
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

type SeguimientoOptionId = "hoy" | "manana" | "semana" | "siguiente";

const seguimientoOptions: Array<{ id: SeguimientoOptionId; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "manana", label: "Manana" },
  { id: "semana", label: "Semana" },
  { id: "siguiente", label: "Siguiente" },
];

const normalizeFechaBase = (record?: CRMEvento) => {
  const base = new Date();
  if (record?.fecha_evento) {
    const current = new Date(record.fecha_evento);
    if (!Number.isNaN(current.getTime())) {
      base.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());
    }
  }
  return base;
};

const computeSeguimientoDate = (optionId: SeguimientoOptionId, record?: CRMEvento) => {
  const option = seguimientoOptions.find((item) => item.id === optionId);
  if (!option) return null;

  const base = normalizeFechaBase(record);
  const now = new Date();

  const copyTime = (target: Date) => {
    target.setHours(
      base.getHours(),
      base.getMinutes(),
      base.getSeconds(),
      base.getMilliseconds()
    );
  };

  if (optionId === "hoy") {
    return base;
  }

  if (optionId === "manana") {
    const target = new Date(base);
    target.setDate(target.getDate() + 1);
    return target;
  }

  // "Semana": desde pasado mañana hasta el próximo domingo
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() + 2);

  if (optionId === "semana") {
    // Si hoy es viernes/sábado/domingo, mantener el mismo día
    if (now.getDay() >= 5) {
      return base;
    }
    copyTime(startWeek);
    return startWeek;
  }

  // "Siguiente": el día siguiente al próximo domingo
  const endWeek = new Date(startToday);
  const daysUntilSunday = (7 - endWeek.getDay()) % 7;
  endWeek.setDate(endWeek.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  endWeek.setHours(23, 59, 59, 999);
  const nextAfterWeek = new Date(endWeek);
  nextAfterWeek.setDate(nextAfterWeek.getDate() + 1);
  copyTime(nextAfterWeek);
  return nextAfterWeek;
};

const SeguimientoMenu = ({
  record,
  onCompletar,
}: {
  record: CRMEvento;
  onCompletar: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const stopRowClick = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const stopMenuClick = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleSelection = async (optionId: SeguimientoOptionId, event: Event | SyntheticEvent) => {
    event.preventDefault();
    if ("stopPropagation" in event) {
      event.stopPropagation();
    }
    if (!record?.id) {
      return;
    }
    const targetDate = computeSeguimientoDate(optionId, record);
    if (!targetDate) {
      notify("No se pudo calcular la nueva fecha.", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await dataProvider.update<CRMEvento>("crm/eventos", {
        id: record.id,
        data: { fecha_evento: targetDate.toISOString() },
        previousData: record,
      });
      notify(`Evento reprogramado para ${targetDate.toLocaleString("es-AR")}.`, { type: "info" });
      refresh();
    } catch (error: any) {
      console.error("Error al actualizar fecha_evento", error);
      const message = error?.message ?? "No se pudo actualizar la fecha del evento.";
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: Event | SyntheticEvent) => {
    event.preventDefault();
    if ("stopPropagation" in event) {
      event.stopPropagation();
    }
    if (!record?.id) return;
    navigate(`/crm/eventos/${record.id}`);
  };

  const handleComplete = async (event: Event | SyntheticEvent) => {
    event.preventDefault();
    if ("stopPropagation" in event) {
      event.stopPropagation();
    }
    if (!record?.id) return;
    setOpen(false);
    onCompletar();
  };

  const handleDelete = async (event?: Event | SyntheticEvent) => {
    if (event) {
      event.preventDefault();
      if ("stopPropagation" in event) {
        event.stopPropagation();
      }
    }
    if (!record?.id) return;
    setLoading(true);
    try {
      await dataProvider.delete("crm/eventos", { id: record.id, previousData: record });
      notify("Evento eliminado.", { type: "info" });
      refresh();
    } catch (error: any) {
      console.error("Error al eliminar evento", error);
      const message = error?.message ?? "No se pudo eliminar el evento.";
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopRowClick} disabled={loading}>
            <Flag className="h-4 w-4" />
            <span className="sr-only">Opciones de seguimiento</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 text-xs sm:w-44 sm:text-sm"
          onClick={stopMenuClick}
          onPointerDown={stopMenuClick}
        >
          {seguimientoOptions.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={(event) => handleSelection(option.id, event)}
              className="flex items-center gap-2"
            >
              {option.id === "hoy" ? <CalendarDays className="h-3.5 w-3.5" /> : null}
              {option.id === "manana" ? <Calendar className="h-3.5 w-3.5" /> : null}
              {option.id === "semana" ? <CalendarRange className="h-3.5 w-3.5" /> : null}
              {option.id === "siguiente" ? <CalendarClock className="h-3.5 w-3.5" /> : null}
              <span>{option.label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleEdit} className="flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" />
            <span>Editar</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleComplete} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5" />
            <span>Completar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              if ("stopPropagation" in event) {
                event.stopPropagation();
              }
              setConfirmDeleteOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Eliminar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmDeleteOpen}
        title="Eliminar evento"
        content="¿Seguro que deseas eliminar este evento?"
        confirm="Eliminar"
        confirmColor="warning"
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => handleDelete()}
      />
    </>
  );
};

const bucketOrder = ["vencido", "hoy", "manana", "semana", "siguientes"] as const;
type FechaBucket = (typeof bucketOrder)[number];

const bucketLabels: Record<FechaBucket, string> = {
  vencido: "Vencidos",
  hoy: "Hoy",
  manana: "Manana",
  semana: "Semana",
  siguientes: "Siguientes",
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

const formatDateTimeShort = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const datePart = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const timePart = date
    .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(":", ":");
  return `${datePart} ${timePart}`;
};

const isEventoCompleted = (record: CRMEvento) =>
  record.estado_evento === "2-realizado" ||
  record.estado_evento?.includes("realizado") ||
  record.estado_evento?.includes("hecho");

const getFechaBucketLabel = (fecha?: string | null): FechaBucket => {
  if (!fecha) return "siguientes";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "siguientes";

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setHours(23, 59, 59, 999);
  
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const endTomorrow = new Date(startTomorrow);
  endTomorrow.setHours(23, 59, 59, 999);
  
  // "Esta semana" = desde pasado mañana hasta el próximo domingo (fin de semana)
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() + 2);
  
  // Calcular el final de la semana (domingo)
  const endWeek = new Date(startToday);
  const daysUntilSunday = (7 - endWeek.getDay()) % 7; // Días hasta el domingo
  endWeek.setDate(endWeek.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  endWeek.setHours(23, 59, 59, 999);

  if (date < startToday) return "vencido";
  if (date <= endToday) return "hoy";
  if (date >= startTomorrow && date <= endTomorrow) return "manana";
  if (date >= startWeek && date <= endWeek) return "semana";
  return "siguientes";
};

const EventosTodoList = ({ onCompletar }: { onCompletar: (evento: CRMEvento) => void }) => {
  const { data = [], isLoading, filterValues } = useListContext<CRMEvento>();
  const [collapsed, setCollapsed] = useState<Record<FechaBucket, boolean>>({
    vencido: true,
    hoy: true,
    manana: true,
    semana: true,
    siguientes: true,
  });
  const soloPendientes = Boolean((filterValues as { solo_pendientes?: boolean })?.solo_pendientes);

  const filteredData = useMemo(
    () => (soloPendientes ? data.filter((evento) => !isEventoCompleted(evento)) : data),
    [data, soloPendientes]
  );

  const grouped = useMemo(() => {
    const base: Record<FechaBucket, CRMEvento[]> = {
      vencido: [],
      hoy: [],
      manana: [],
      semana: [],
      siguientes: [],
    };
    filteredData.forEach((evento) => {
      const bucket = getFechaBucketLabel(evento.fecha_evento);
      base[bucket].push(evento);
    });
    bucketOrder.forEach((bucket) => {
      base[bucket].sort((a, b) => {
        const aTime = a.fecha_evento ? new Date(a.fecha_evento).getTime() : 0;
        const bTime = b.fecha_evento ? new Date(b.fecha_evento).getTime() : 0;
        return bTime - aTime;
      });
    });
    return base;
  }, [filteredData]);

  if (isLoading) {
    return <div className="py-6 text-sm text-muted-foreground">Cargando eventos...</div>;
  }

  if (!filteredData.length) {
    return <div className="py-6 text-sm text-muted-foreground">Sin eventos</div>;
  }

  const toggleBucket = (bucket: FechaBucket) =>
    setCollapsed((prev) => ({ ...prev, [bucket]: !prev[bucket] }));

  return (
    <div className="space-y-4">
      {bucketOrder.map((bucket) => {
        const items = grouped[bucket];
        const isCollapsed = collapsed[bucket];
        const label = bucketLabels[bucket];
        const Icon = bucketIcons[bucket];
        return (
          <div
            key={bucket}
            className="rounded-2xl border border-slate-200/80 bg-white/90"
          >
            <button
              type="button"
              onClick={() => toggleBucket(bucket)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3"
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
              )}
              <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${bucketIconClass[bucket]}`} />
              <span className="text-xs font-semibold text-slate-800 sm:text-sm">{label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:px-2 sm:text-xs">
                {items.length}
              </span>
            </div>
          </button>
            {isCollapsed ? null : (
              <div className="border-t border-slate-200/70">
                {items.length == 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400">Sin eventos</div>
                ) : (
                  items.map((evento) => (
                    <EventoTodoRow key={evento.id} record={evento} onCompletar={onCompletar} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const EventoTodoRow = ({ record, onCompletar }: { record: CRMEvento; onCompletar: (evento: CRMEvento) => void }) => {
  const navigate = useNavigate();
  const isCompleted = isEventoCompleted(record);
  const contactoName =
    record.contacto?.nombre_completo?.trim() ||
    record.contacto?.nombre?.trim() ||
    (record.contacto_id ? `Contacto #${record.contacto_id}` : "Sin contacto");
  const tipoEvento =
    record.tipo_evento?.trim() ||
    record.tipo_catalogo?.codigo?.trim() ||
    record.tipo_catalogo?.nombre?.trim() ||
    "";
  const responsable =
    record.asignado_a?.nombre?.trim() ||
    (record.asignado_a_id ? `Usuario #${record.asignado_a_id}` : "Sin responsable");
  const responsableAvatar =
    (record.asignado_a as any)?.url_foto ||
    (record.asignado_a as any)?.avatar ||
    null;
  const responsableInitials = responsable
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleOpen = () => {
    if (!record.id) return;
    navigate(`/crm/eventos/${record.id}`);
  };

  const tipoIcon = (() => {
    const value = tipoEvento.toLowerCase();
    if (value.includes("llam")) return Phone;
    if (value.includes("visita") || value.includes("reun")) return Calendar;
    if (value.includes("tarea")) return CalendarCheck;
    if (value.includes("email")) return Mail;
    if (value.includes("whatsapp")) return MessageCircle;
    if (value.includes("nota")) return StickyNote;
    return Calendar;
  })();

  return (
    <div
      className="flex items-center gap-1 border-b border-slate-100 px-2.5 py-1 last:border-b-0 hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 sm:gap-1.5 sm:px-4 sm:py-2"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <span className="w-[60px] shrink-0 text-[9px] font-semibold text-slate-500 sm:w-[80px] sm:text-[12px]">
        {formatDateTimeShort(record.fecha_evento)}
      </span>
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 text-slate-600 sm:h-5 sm:w-5">
        {(() => {
          const Icon = tipoIcon;
          return <Icon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />;
        })()}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[10px] text-slate-700 sm:text-[12px] ${
            isCompleted ? "line-through text-slate-400" : ""
          }`}
        >
          <span className={`font-semibold ${isCompleted ? "text-slate-400" : "text-slate-900"}`}>
            {contactoName.slice(0, 12)}
          </span>
          <span className="mx-1.5 text-slate-300">-</span>
          <span className="text-slate-700">{record.titulo || "Sin titulo"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Avatar className="size-4.5 border border-slate-200 sm:size-6">
          {responsableAvatar ? (
            <AvatarImage src={responsableAvatar} alt={responsable} />
          ) : null}
          <AvatarFallback className="bg-slate-100 text-[7px] font-semibold uppercase text-slate-600 sm:text-[9px]">
            {responsableInitials || "??"}
          </AvatarFallback>
        </Avatar>
        {isCompleted ? null : (
          <SeguimientoMenu
            record={record}
            onCompletar={() => onCompletar(record)}
          />
        )}
      </div>
    </div>
  );
};
