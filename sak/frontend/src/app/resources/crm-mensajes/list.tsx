"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { useListContext, useRecordContext, useRefresh } from "ra-core";
import { AggregateEstadoChips } from "@/components/lists/AggregateEstadoChips";
import { ResourceTitle } from "@/components/resource-title";
import { Mail, MessageCircle, Trash2, ArrowDownLeft, ArrowUpRight, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CRMMensaje } from "./model";
import { CRMMensajeReplyDialog } from "./form_responder";
import { ScheduleDialog } from "./form_agendar";
import { DiscardDialog } from "./form_descartar";
import { ButtonToggle, type ButtonToggleOption } from "@/components/forms/button-toggle";
import {
  CRM_MENSAJE_TIPO_CHOICES,
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_ESTADO_BADGES,
  formatMensajeEstado,
  getEstadosPorTipo,
  getTipoEstadoFromToggle,
  getToggleFromTipoEstado,
  type TipoToggleValue,
} from "./model";

// ============================================================================
// UTILITY FUNCTIONS - Filter Management
// ============================================================================

// Normaliza el valor del filtro tipo a un array de strings
const normalizeTipoFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
};

// Actualiza el filtro tipo en el objeto de filtros
const setTipoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.tipo = values;
  } else {
    delete filters.tipo;
  }
};

// Normaliza el valor del filtro estado a un array de strings
const normalizeEstadoFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
};

// Actualiza el filtro estado en el objeto de filtros
const setEstadoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.estado = values;
  } else {
    delete filters.estado;
  }
};

// Aplica filtros combinados de tipo y estado basados en el valor del toggle
const applyTipoToggleFilters = (
  value: TipoToggleValue,
  currentFilters: Record<string, unknown>
): Record<string, unknown> => {
  const newFilters = { ...currentFilters };
  const { tipo, estado } = getTipoEstadoFromToggle(value);
  
  setTipoFilterValue(newFilters, [tipo]);
  if (estado) {
    setEstadoFilterValue(newFilters, [estado]);
  } else {
    delete newFilters.estado;
  }

  if (value === "nuevos") {
    return removeFechaEstadoBounds(newFilters);
  }
  
  return newFilters;
};

// Filtra los estados disponibles según el tipo de mensaje seleccionado
const filterEstadosByTipo = (choices: Array<{id: string; name: string}>, filterValues: Record<string, unknown>) => {
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const currentTipo = currentTipos[0] as any;
  
  if (!currentTipo) return choices;
  
  const validEstados = getEstadosPorTipo(currentTipo);
  return choices.filter(choice => validEstados.includes(choice.id as any));
};

// ============================================================================
// UTILITY FUNCTIONS - Fecha Estado Quick Filter
// ============================================================================

const FECHA_ESTADO_FILTER_KEY = "fecha_estado_quick";

type FechaEstadoFilterOption = "todos" | "hoy" | "semana";

const FECHA_ESTADO_TOGGLE_OPTIONS: ButtonToggleOption<FechaEstadoFilterOption>[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "todos", label: "Todos" },
];

const isFechaEstadoOption = (value: unknown): value is FechaEstadoFilterOption =>
  value === "hoy" || value === "semana" || value === "todos";

const getFechaEstadoBounds = (option: FechaEstadoFilterOption) => {
  if (option === "hoy") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (option === "semana") {
    const start = new Date();
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  return {};
};

const removeFechaEstadoBounds = (filters: Record<string, unknown>) => {
  if (!("fecha_estado__gte" in filters) && !("fecha_estado__lte" in filters)) {
    return filters;
  }
  const nextFilters = { ...filters };
  delete nextFilters.fecha_estado__gte;
  delete nextFilters.fecha_estado__lte;
  return nextFilters;
};

const applyFechaEstadoFilterOption = (
  filters: Record<string, unknown>,
  option: FechaEstadoFilterOption,
  skipBounds = false
) => {
  const nextFilters = { ...filters, [FECHA_ESTADO_FILTER_KEY]: option };
  delete nextFilters.fecha_estado__gte;
  delete nextFilters.fecha_estado__lte;

  if (!skipBounds && option !== "todos") {
    const bounds = getFechaEstadoBounds(option);
    if (bounds.from) {
      nextFilters.fecha_estado__gte = bounds.from;
    }
    if (bounds.to) {
      nextFilters.fecha_estado__lte = bounds.to;
    }
  }

  return nextFilters;
};

const getFechaEstadoOption = (filters: Record<string, unknown>): FechaEstadoFilterOption => {
  const stored = filters[FECHA_ESTADO_FILTER_KEY];
  if (isFechaEstadoOption(stored)) {
    return stored;
  }

  const currentFrom =
    typeof filters.fecha_estado__gte === "string" ? filters.fecha_estado__gte : undefined;
  const currentTo = typeof filters.fecha_estado__lte === "string" ? filters.fecha_estado__lte : undefined;

  if (!currentFrom && !currentTo) {
    return "hoy";
  }

  for (const option of ["hoy", "semana"] as const) {
    const bounds = getFechaEstadoBounds(option);
    if ((bounds.from ?? null) === (currentFrom ?? null) && (bounds.to ?? null) === (currentTo ?? null)) {
      return option;
    }
  }

  return "hoy";
};

const shouldSyncFechaEstadoFilters = (
  filters: Record<string, unknown>,
  option: FechaEstadoFilterOption
) => {
  const currentFrom =
    typeof filters.fecha_estado__gte === "string" ? filters.fecha_estado__gte : undefined;
  const currentTo = typeof filters.fecha_estado__lte === "string" ? filters.fecha_estado__lte : undefined;

  if (option === "todos") {
    return Boolean(currentFrom || currentTo);
  }

  const desired = getFechaEstadoBounds(option);
  return (desired.from ?? null) !== (currentFrom ?? null) || (desired.to ?? null) !== (currentTo ?? null);
};

// ============================================================================
// UTILITY FUNCTIONS - Styling
// ============================================================================

// Genera la clase CSS para un chip de estado según su selección
const estadoChipClass = (estado: string, selected = false) => {
  const base =
    CRM_MENSAJE_ESTADO_BADGES[estado as keyof typeof CRM_MENSAJE_ESTADO_BADGES] ??
    "bg-slate-100 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

// Genera la clase CSS para una fila según las propiedades del mensaje
const mensajeRowClass = (record: CRMMensaje) =>
  cn(
    "border-b border-slate-200/60 transition-colors hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 odd:bg-white even:bg-slate-50/70 last:border-b-0",
    record.tipo === "entrada" && "border-l-4 border-l-emerald-200/80",
    record.tipo === "salida" && "border-l-4 border-l-sky-200/80",
    record.estado === "nuevo" && "ring-1 ring-emerald-300/70 ring-offset-0"
  );

// ============================================================================
// CONFIGURATION - Filter Definitions
// ============================================================================

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar mensajes" className="w-full" alwaysOn />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={CRM_MENSAJE_TIPO_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="canal"
    source="canal"
    label="Canal"
    choices={CRM_MENSAJE_CANAL_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={CRM_MENSAJE_ESTADO_CHOICES}
    emptyText="Todos"
  />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="oportunidad_id" source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
    <SelectInput
      optionText={(record) =>
        record?.descripcion_estado ? `${record.id} - ${record.descripcion_estado}` : `#${record?.id}`
      }
      emptyText="Todas"
    />
  </ReferenceInput>,
];

// ============================================================================
// COMPONENTS - Actions & Toggles
// ============================================================================

// Barra de acciones del listado (filtros, crear, exportar)
const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

// Toggle dual para filtrar por tipo de mensaje (Nuevos/Entrada/Salida)
const TipoDualToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const currentEstados = normalizeEstadoFilter(filterValues.estado);
  
  const activeValue = getToggleFromTipoEstado(
    currentTipos[0] as any,
    currentEstados[0] as any
  );

  const handleToggle = (value: TipoToggleValue) => {
    const newFilters = applyTipoToggleFilters(value, filterValues);
    setFilters(newFilters, {});
  };

  const options: ButtonToggleOption<"nuevos" | "entrada" | "salida">[] = [
    {
      id: "nuevos",
      label: "Nuevos",
      badge: {
        color: CRM_MENSAJE_ESTADO_BADGES.nuevo,
      },
    },
    {
      id: "entrada",
      label: "Entrada",
      badge: {
        color: CRM_MENSAJE_ESTADO_BADGES.recibido,
      },
    },
    {
      id: "salida",
      label: "Salida",
      badge: {
        color: CRM_MENSAJE_ESTADO_BADGES.enviado,
      },
    },
  ];

  return (
    <ButtonToggle
      options={options}
      value={activeValue}
      onChange={handleToggle}
      variant="rounded"
      size="md"
      aria-label="Filtro de tipo de mensaje"
    />
  );
};

const FechaEstadoFilter = () => {
  const { filterValues, setFilters } = useListContext();
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const currentEstados = normalizeEstadoFilter(filterValues.estado);
  const activeToggle = getToggleFromTipoEstado(currentTipos[0] as any, currentEstados[0] as any);
  const showFilter = activeToggle === "entrada" || activeToggle === "salida";
  const activeOption = getFechaEstadoOption(filterValues);

  useEffect(() => {
    if (!showFilter) {
      const cleaned = removeFechaEstadoBounds(filterValues);
      if (cleaned !== filterValues) {
        setFilters(cleaned, {});
      }
      return;
    }

    if (shouldSyncFechaEstadoFilters(filterValues, activeOption)) {
      const nextFilters = applyFechaEstadoFilterOption(filterValues, activeOption, false);
      setFilters(nextFilters, {});
    }
  }, [showFilter, activeOption, filterValues, setFilters]);

  if (!showFilter) {
    return null;
  }

  const handleChange = (option: FechaEstadoFilterOption) => {
    if (option === activeOption) {
      return;
    }
    const nextFilters = applyFechaEstadoFilterOption(filterValues, option, false);
    setFilters(nextFilters, {});
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-1 py-0.5 shadow-sm">
      {FECHA_ESTADO_TOGGLE_OPTIONS.map((option) => {
        const isActive = option.id === activeOption;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleChange(option.id)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-150",
              isActive
                ? "bg-slate-900 text-white shadow-[0_4px_12px_rgba(15,23,42,0.3)]"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// COMPONENTS - Main List
// ============================================================================

// Componente principal del listado de mensajes CRM
export const CRMMensajeList = () => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedMensaje, setSelectedMensaje] = useState<CRMMensaje | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [mensajeDescartar, setMensajeDescartar] = useState<CRMMensaje | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMensaje, setScheduleMensaje] = useState<CRMMensaje | null>(null);
  const refresh = useRefresh();

  const handleReplyClick = (mensaje: CRMMensaje) => {
    setSelectedMensaje(mensaje);
    setReplyOpen(true);
  };

  const handleDiscardClick = (mensaje: CRMMensaje) => {
    setMensajeDescartar(mensaje);
    setDiscardOpen(true);
  };

  const handleScheduleClick = (mensaje: CRMMensaje) => {
    setScheduleMensaje(mensaje);
    setScheduleOpen(true);
  };

  const handleReplySuccess = () => {
    refresh();
    setReplyOpen(false);
    setSelectedMensaje(null);
  };

  const handleScheduleSuccess = () => {
    refresh();
    setScheduleOpen(false);
    setScheduleMensaje(null);
  };

  return (
    <>
      <List
        title={<ResourceTitle icon={Mail} text="CRM - Mensajes" compact />}
        filters={filters}
        actions={<ListActions />}
        filterDefaultValues={{ tipo: ["entrada"], estado: ["nuevo"] }}
        perPage={10}
        sort={{ field: "fecha_mensaje", order: "DESC" }}
        showBreadcrumb={false}
        className="space-y-5"
      >
    <div className="space-y-4 rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/80 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.15)]">
      <AggregateEstadoChips
        endpoint="crm/mensajes/aggregates/estado"
        choices={CRM_MENSAJE_ESTADO_CHOICES}
        badges={CRM_MENSAJE_ESTADO_BADGES}
        getChipClassName={estadoChipClass}
        filterChoices={filterEstadosByTipo}
        dense
        className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm"
        leftSlot={
          <div className="flex flex-wrap items-center gap-2">
            <TipoDualToggle />
            <FechaEstadoFilter />
          </div>
        }
      />
      <div className="rounded-[30px] border border-slate-200/70 bg-white/95 p-0 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition">
        <DataTable
          rowClick="show"
          className="w-full overflow-hidden rounded-[30px] border-0 shadow-none"
          rowClassName={mensajeRowClass}
        >
          <DataTable.Col
            source="fecha_mensaje"
            label="Fecha / Hora"
            className="w-[160px] min-w-[150px]"
            cellClassName="!whitespace-normal align-top"
          >
            <FechaCell />
          </DataTable.Col>
          <DataTable.Col
            source="contacto_id"
            label="Contacto"
            className="w-[160px] min-w-[140px] max-w-[180px]"
          >
            <ContactoCell />
          </DataTable.Col>
          <DataTable.Col
            source="asunto"
            label="Asunto"
            className="w-[320px] min-w-[280px]"
            cellClassName="!whitespace-normal"
          >
            <AsuntoCell />
          </DataTable.Col>
          <DataTable.Col source="estado" label="Estado" className="w-[100px] min-w-[90px]">
            <EstadoCell />
          </DataTable.Col>
          <DataTable.Col label="Acciones" className="w-[150px] min-w-[140px] justify-center">
            <AccionesCell
              onReplyClick={handleReplyClick}
              onDiscardClick={handleDiscardClick}
              onScheduleClick={handleScheduleClick}
            />
          </DataTable.Col>
        </DataTable>
      </div>
    </div>
      </List>
      <CRMMensajeReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        mensaje={selectedMensaje}
        onSuccess={handleReplySuccess}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        mensaje={scheduleMensaje}
        onSuccess={handleScheduleSuccess}
      />
      <DiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        mensaje={mensajeDescartar}
      />
    </>
  );
};

// ============================================================================
// COMPONENTS - Table Cells
// ============================================================================

// Muestra la fecha, hora, ID y tipo de mensaje
const FechaCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const hasFecha = Boolean(record.fecha_mensaje);
  const date = hasFecha ? new Date(record.fecha_mensaje as string) : null;
  const tipoInfo =
    record.tipo === "salida"
      ? {
          label: "Salida",
          icon: ArrowUpRight,
          chipClass: "bg-sky-50 text-sky-700 border border-sky-100",
        }
      : record.tipo === "entrada"
        ? {
            label: "Entrada",
            icon: ArrowDownLeft,
            chipClass: "bg-emerald-50 text-emerald-700 border border-emerald-100",
          }
        : null;

  const formattedId = record.id != null ? `#${String(record.id).padStart(6, "0")}` : "";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-[12px] text-foreground shadow-sm">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
        <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-700">
          <span className="inline-flex items-center leading-none">
            <span>{formattedId}</span>
            {tipoInfo ? (
              <>
                <span aria-hidden="true">&nbsp;</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-[2px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
                    tipoInfo.chipClass
                  )}
                >
                  <tipoInfo.icon className="h-3 w-3" />
                  {record.canal ? <span className="capitalize">{record.canal}</span> : null}
                </span>
              </>
            ) : record.canal ? (
              <>
                <span aria-hidden="true">&nbsp;</span>
                <span className="inline-flex items-center text-[10px] uppercase leading-none text-slate-600">
                  {record.canal}
                </span>
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-1 text-sm font-semibold leading-tight text-slate-900">
        {hasFecha && date ? (
          <>
            <span className="text-base">{date.toLocaleDateString("es-AR")}</span>
            <span className="text-xs font-medium text-slate-500">·</span>
            <span className="text-sm font-medium text-slate-600">{date.toLocaleTimeString("es-AR")}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-slate-500">Sin fecha</span>
        )}
      </div>
    </div>
  );
};

// Muestra el nombre del contacto, referencia y oportunidad asociada
const ContactoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const contactoNombre =
    record.contacto?.nombre_completo ??
    record.contacto?.nombre ??
    null;

  return (
    <div className="flex flex-col text-sm max-w-[220px]">
      <span className="font-medium leading-tight text-foreground line-clamp-2 break-words">
        {contactoNombre ||
          (record.contacto_id ? `Contacto #${record.contacto_id}` : "No agendado")}
      </span>
      {record.contacto_referencia ? (
        <span className="text-xs text-muted-foreground leading-tight line-clamp-2 break-words">
          {record.contacto_referencia}
        </span>
      ) : null}
      {record.oportunidad_id ? (
        <span className="text-[10px] font-medium text-slate-400 leading-tight">
          Oportunidad #{record.oportunidad_id}
        </span>
      ) : null}
    </div>
  );
};

// Muestra el asunto y un preview del contenido del mensaje
const AsuntoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium line-clamp-1">{record.asunto || "Sin asunto"}</p>
      {record.contenido ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{record.contenido}</p>
      ) : null}
    </div>
  );
};

// Muestra el estado del mensaje con badge colorizado
const EstadoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const estadoClass = record.estado
    ? CRM_MENSAJE_ESTADO_BADGES[record.estado]
    : "bg-slate-200 text-slate-800";
  
  const fechaEstado = record.fecha_estado ? new Date(record.fecha_estado) : null;
  const tiempoTranscurrido = fechaEstado ? getRelativeTime(fechaEstado) : null;
  
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Badge variant="outline" className={`${estadoClass} border-transparent`}>
        {formatMensajeEstado(record.estado)}
      </Badge>
      {tiempoTranscurrido && (
        <span className="text-[10px] text-muted-foreground">
          {tiempoTranscurrido}
        </span>
      )}
    </div>
  );
};

// Calcula el tiempo relativo desde una fecha
const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR");
};

interface AccionesCellProps {
  onReplyClick: (mensaje: CRMMensaje) => void;
  onDiscardClick: (mensaje: CRMMensaje) => void;
  onScheduleClick: (mensaje: CRMMensaje) => void;
}

// Muestra los botones de acción (Responder/Agendar/Descartar)
const AccionesCell = ({ onReplyClick, onDiscardClick, onScheduleClick }: AccionesCellProps) => {
  const record = useRecordContext<CRMMensaje>();

  if (!record) return null;

  const handleReplyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onReplyClick(record);
  };

  const handleDiscardClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDiscardClick(record);
  };

  const handleScheduleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onScheduleClick(record);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={handleReplyClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <MessageCircle className="size-4" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Responder</span>
      </button>
      <button
        type="button"
        onClick={handleScheduleClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <CalendarPlus className="size-4 text-primary" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Agendar</span>
      </button>
      <button
        type="button"
        onClick={handleDiscardClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <Trash2 className="size-4 text-destructive" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Descartar</span>
      </button>
    </div>
  );
};
