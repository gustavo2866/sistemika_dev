"use client";

import { useEffect, useState } from "react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { ResourceTitle } from "@/components/resource-title";
import { Badge } from "@/components/ui/badge";
import { SummaryChips, type SummaryChipItem } from "@/components/lists/SummaryChips";
import { cn } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";
import { useListContext, useRecordContext } from "ra-core";
import type { CRMEvento } from "./model";
import { CRM_EVENTO_ESTADO_CHOICES } from "./model";

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "hecho", name: "Hecho" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar eventos" className="w-full" alwaysOn />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput key="estado_evento" source="estado_evento" label="Estado" choices={estadoChoices} emptyText="Todos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMEventoList = () => (
  <List
    title={<ResourceTitle icon={CalendarCheck} text="CRM - Eventos" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "fecha_evento", order: "DESC" }}
    className="space-y-5"
  >
    <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
      <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FechaQuickFilter />
          <EstadoSummaryChips />
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-sm">
        <DataTable rowClick="edit" className="border-0 shadow-none">
          <DataTable.Col source="id" label="ID">
            <TextField source="id" />
          </DataTable.Col>
          <DataTable.Col source="fecha_evento" label="Fecha">
            <TextField source="fecha_evento" />
          </DataTable.Col>
          <DataTable.Col source="titulo" label="Título del evento" className="max-w-[280px]" cellClassName="whitespace-normal">
            <TextField source="titulo" className="line-clamp-2" />
          </DataTable.Col>
          <DataTable.Col source="oportunidad_id" label="Oportunidad">
            <OportunidadCell />
          </DataTable.Col>
          <DataTable.Col source="estado_evento" label="Estado">
            <EstadoCell />
          </DataTable.Col>
          <DataTable.Col source="asignado_a_id" label="Asignado">
            <ReferenceField source="asignado_a_id" reference="users">
              <TextField source="nombre" />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col>
            <EditButton />
          </DataTable.Col>
        </DataTable>
      </div>
    </div>
  </List>
);

type FechaRangeId = "vencida" | "hoy" | "esta_semana" | "proxima_semana" | "futuras";

const fechaRangeOptions: Array<{ id: FechaRangeId; label: string }> = [
  { id: "vencida", label: "Vencidas" },
  { id: "hoy", label: "Hoy" },
  { id: "esta_semana", label: "Esta semana" },
  { id: "proxima_semana", label: "Próxima semana" },
  { id: "futuras", label: "Futuras" },
];

const toISODateTime = (date: Date) => date.toISOString();

const getDateAnchors = () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay(); // 0 domingo
  const diffToMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  nextWeekStart.setHours(0, 0, 0, 0);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);

  const dayAfterNextWeekEnd = new Date(nextWeekEnd);
  dayAfterNextWeekEnd.setDate(nextWeekEnd.getDate() + 1);
  dayAfterNextWeekEnd.setHours(0, 0, 0, 0);

  return {
    todayStart,
    todayEnd,
    tomorrowStart,
    weekEnd,
    nextWeekStart,
    nextWeekEnd,
    dayAfterNextWeekEnd,
  };
};

const getFechaRangeBounds = (range: FechaRangeId) => {
  const { todayStart, todayEnd, tomorrowStart, weekEnd, nextWeekStart, nextWeekEnd, dayAfterNextWeekEnd } =
    getDateAnchors();
  switch (range) {
    case "vencida":
      return { to: toISODateTime(todayStart) };
    case "hoy":
      return { from: toISODateTime(todayStart), to: toISODateTime(todayEnd) };
    case "esta_semana": {
      if (tomorrowStart > weekEnd) {
        return {};
      }
      return { from: toISODateTime(tomorrowStart), to: toISODateTime(weekEnd) };
    }
    case "proxima_semana":
      return { from: toISODateTime(nextWeekStart), to: toISODateTime(nextWeekEnd) };
    case "futuras":
      return { from: toISODateTime(dayAfterNextWeekEnd) };
    default:
      return {};
  }
};

const detectActiveRange = (filters: Record<string, unknown>): FechaRangeId | null => {
  const currentFrom = typeof filters.fecha_evento__gte === "string" ? filters.fecha_evento__gte : undefined;
  const currentTo = typeof filters.fecha_evento__lte === "string" ? filters.fecha_evento__lte : undefined;
  for (const option of fechaRangeOptions) {
    const { from, to } = getFechaRangeBounds(option.id);
    if ((from ?? null) === (currentFrom ?? null) && (to ?? null) === (currentTo ?? null)) {
      return option.id;
    }
  }
  return null;
};

const FechaQuickFilter = () => {
  const { filterValues, setFilters } = useListContext();
  const active = detectActiveRange(filterValues);

  const handleSelect = (range?: FechaRangeId) => {
    const nextFilters = { ...filterValues };
    delete nextFilters.fecha_evento__gte;
    delete nextFilters.fecha_evento__lte;
    if (range) {
      const bounds = getFechaRangeBounds(range);
      if (bounds.from) {
        nextFilters.fecha_evento__gte = bounds.from;
      }
      if (bounds.to) {
        nextFilters.fecha_evento__lte = bounds.to;
      }
    }
    setFilters(nextFilters, {});
  };

  const options: Array<{ id?: FechaRangeId; label: string }> = [
    { id: undefined, label: "Todas" },
    ...fechaRangeOptions,
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-0 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)]">
        {options.map((option, index) => {
          const isActive = option.id ? active === option.id : active === null;
          const isFirst = index === 0;
          const isLast = index === options.length - 1;
          return (
            <button
              key={option.id ?? "all"}
              type="button"
              onClick={() => handleSelect(option.id)}
              aria-pressed={isActive}
              className={cn(
                "min-w-[110px] rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide transition-all duration-200 text-slate-600",
                isActive && "bg-slate-900 text-white shadow-[0_4px_16px_rgba(15,23,42,0.18)]",
                !isActive && "hover:bg-slate-100",
                isFirst ? "rounded-l-full" : "",
                isLast ? "rounded-r-full" : ""
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const estadoChipClass = (estado: string, selected = false) => {
  const base =
    estadoBadgeClasses[estado as keyof typeof estadoBadgeClasses] ?? "bg-slate-200 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-slate-200`
    : `${base} border-transparent`;
};

const EstadoSummaryChips = () => {
  const { filterValues, setFilters } = useListContext();
  const [items, setItems] = useState<SummaryChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(filterValues);

  useEffect(() => {
    let cancel = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        Object.entries(filterValues).forEach(([key, value]) => {
          if (value == null) return;
          if (Array.isArray(value)) {
            if (!value.length) return;
            value.forEach((item) => {
              if (item != null && item !== "") {
                query.append(key, String(item));
              }
            });
            return;
          }
          if (value !== "") {
            query.append(key, String(value));
          }
        });
        const response = await fetch(`${API_URL}/crm/eventos/aggregates/estado?${query.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const raw: Array<{ estado: string; total?: number }> = json?.data ?? json ?? [];
        const totals = new Map<string, number>();
        raw.forEach(({ estado, total }) => {
          totals.set(estado, total ?? 0);
        });
        const mapped: SummaryChipItem[] = CRM_EVENTO_ESTADO_CHOICES.map((choice) => ({
          label: choice.name,
          value: choice.id,
          count: totals.get(choice.id) ?? 0,
          chipClassName: estadoChipClass(choice.id),
          selectedChipClassName: estadoChipClass(choice.id, true),
          countClassName: "text-xs font-semibold bg-white/50 text-slate-700",
          selectedCountClassName: "text-xs font-semibold bg-white/80 text-slate-900",
        }));
        if (!cancel) {
          setItems(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (!cancel) {
          setError(err?.message ?? "No se pudieron cargar los estados");
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      cancel = true;
    };
  }, [signature]);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    if (value) {
      nextFilters.estado_evento = value;
    } else {
      delete nextFilters.estado_evento;
    }
    setFilters(nextFilters, {});
  };

  const currentEstado = typeof filterValues.estado_evento === "string" ? filterValues.estado_evento : undefined;

  return (
    <SummaryChips
      title={null}
      className="mb-0 border-none bg-transparent p-0 shadow-none"
      items={items}
      loading={loading}
      error={error}
      selectedValue={currentEstado}
      onSelect={handleSelect}
    />
  );
};

const OportunidadCell = () => {
  const record = useRecordContext<CRMEvento>();
  if (!record?.oportunidad_id) {
    return <span className="text-sm text-muted-foreground">Sin oportunidad</span>;
  }
  return (
    <div className="flex flex-col text-sm leading-tight">
      <span className="font-semibold text-foreground">#{record.oportunidad_id}</span>
      <ReferenceField source="oportunidad_id" reference="crm/oportunidades" link={false}>
        <TextField
          source="descripcion_estado"
          className="text-xs text-muted-foreground line-clamp-2"
        />
      </ReferenceField>
    </div>
  );
};

const estadoBadgeClasses: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  hecho: "bg-emerald-100 text-emerald-800",
};

const EstadoCell = () => {
  const record = useRecordContext<CRMEvento>();
  if (!record) return null;
  const estado = record.estado_evento ?? "desconocido";
  const badgeClass =
    estadoBadgeClasses[estado as keyof typeof estadoBadgeClasses] ??
    "bg-slate-200 text-slate-800";
  return (
    <Badge className={`text-xs font-semibold ${badgeClass}`} variant="outline">
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </Badge>
  );
};
