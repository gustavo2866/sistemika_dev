"use client";

import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
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
  Flag,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useDataProvider, useGetIdentity, useListContext, useNotify, useRefresh } from "ra-core";
import { useNavigate } from "react-router-dom";
import type { CRMEvento } from "./model";

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "hecho", name: "Hecho" },
];

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar eventos"
    className="w-full [&_input]:h-7 [&_input]:px-2.5 [&_input]:py-1 [&_input]:text-[10px] [&_input]:leading-none sm:[&_input]:h-9 sm:[&_input]:px-3 sm:[&_input]:py-2 sm:[&_input]:text-sm sm:[&_input]:leading-normal"
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
      label={false}
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
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
    />
    <CreateButton
      size="sm"
      className="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
    />
    <ExportButton
      size="sm"
      className="h-7 px-2 gap-1 text-[10px] sm:h-9 sm:px-3 sm:gap-2 sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
    />
  </div>
);

export const CRMEventoList = () => {
  const { data: identity } = useGetIdentity();
  const defaultFilters = {
    default_scope: "pendientes_mes",
    ...(identity?.id ? { asignado_a_id: identity.id } : {}),
  };
  const listKey = identity?.id ? `crm-eventos-${identity.id}` : "crm-eventos";

  return (
    <List
      key={listKey}
      title={<ResourceTitle icon={CalendarCheck} text="CRM - Eventos" />}
      filters={filters}
      filterDefaultValues={defaultFilters}
      actions={<ListActions />}
      perPage={1000}
      pagination={false}
      sort={{ field: "fecha_evento", order: "DESC" }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-sm sm:p-3">
        <EventosTodoList />
      </div>
    </List>
  );
};

type SeguimientoOptionId = "hoy" | "manana" | "semana" | "siguiente";

const seguimientoOptions: Array<{ id: SeguimientoOptionId; label: string; daysToAdd: number }> = [
  { id: "hoy", label: "Hoy", daysToAdd: 0 },
  { id: "manana", label: "Manana", daysToAdd: 1 },
  { id: "semana", label: "Semana", daysToAdd: 7 },
  { id: "siguiente", label: "Siguiente", daysToAdd: 14 },
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
  const target = normalizeFechaBase(record);
  target.setDate(target.getDate() + option.daysToAdd);
  return target;
};

const SeguimientoMenu = ({ record }: { record: CRMEvento }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
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
    setLoading(true);
    try {
      await dataProvider.update<CRMEvento>("crm/eventos", {
        id: record.id,
        data: { estado_evento: "2-realizado" },
        previousData: record,
      });
      notify("Evento marcado como realizado.", { type: "info" });
      refresh();
    } catch (error: any) {
      console.error("Error al completar evento", error);
      const message = error?.message ?? "No se pudo completar el evento.";
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (event: Event | SyntheticEvent) => {
    event.preventDefault();
    if ("stopPropagation" in event) {
      event.stopPropagation();
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
    }
  };

  return (
    <DropdownMenu>
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
        <DropdownMenuItem onSelect={handleDelete} className="flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" />
          <span>Eliminar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() + 2);
  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);
  endWeek.setHours(23, 59, 59, 999);

  if (date < startToday) return "vencido";
  if (date <= endToday) return "hoy";
  if (date >= startTomorrow && date <= endTomorrow) return "manana";
  if (date >= startWeek && date <= endWeek) return "semana";
  return "siguientes";
};

const EventosTodoList = () => {
  const { data = [], isLoading } = useListContext<CRMEvento>();
  const [collapsed, setCollapsed] = useState<Record<FechaBucket, boolean>>({
    vencido: false,
    hoy: false,
    manana: true,
    semana: true,
    siguientes: true,
  });

  const grouped = useMemo(() => {
    const base: Record<FechaBucket, CRMEvento[]> = {
      vencido: [],
      hoy: [],
      manana: [],
      semana: [],
      siguientes: [],
    };
    data.forEach((evento) => {
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
  }, [data]);

  if (isLoading) {
    return <div className="py-6 text-sm text-muted-foreground">Cargando eventos...</div>;
  }

  if (!data.length) {
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
                    <EventoTodoRow key={evento.id} record={evento} />
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

const EventoTodoRow = ({ record }: { record: CRMEvento }) => {
  const navigate = useNavigate();
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
      className="flex items-center gap-1 border-b border-slate-100 px-2.5 py-1 last:border-b-0 hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 sm:gap-1.5 sm:px-4 sm:py-2"
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
        <div className="truncate text-[10px] text-slate-700 sm:text-[12px]">
          <span className="font-semibold text-slate-900">
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
        <SeguimientoMenu record={record} />
      </div>
    </div>
  );
};
