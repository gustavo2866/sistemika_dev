"use client";

import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { TextInput } from "@/components/text-input";
import { ResourceTitle } from "@/components/resource-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarCheck, Flag } from "lucide-react";
import { useDataProvider, useGetIdentity, useNotify, useRecordContext, useRefresh } from "ra-core";
import type { CRMEvento } from "./model";

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "hecho", name: "Hecho" },
];

const fechaBadgeClasses: Record<string, string> = {
  vencido: "bg-rose-100 text-rose-800",
  hoy: "bg-emerald-100 text-emerald-800",
  manana: "bg-sky-100 text-sky-800",
  semana: "bg-amber-100 text-amber-800",
  siguientes: "bg-slate-100 text-slate-700",
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar eventos" className="w-full" alwaysOn />,
  <ReferenceInput
    key="asignado_a_id"
    source="asignado_a_id"
    reference="users"
    label="Responsable"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
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
      perPage={10}
      sort={{ field: "fecha_evento", order: "DESC" }}
      className="space-y-5"
    >
      <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
        <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-sm">
          <DataTable rowClick="edit" className="border-0 shadow-none">
          <DataTable.Col label="Estado">
            <FechaEstadoCell />
          </DataTable.Col>
          <DataTable.Col source="fecha_evento" label="Fecha y hora">
            <TextField source="fecha_evento" />
          </DataTable.Col>
          <DataTable.Col source="contacto_id" label="Contacto">
            <ContactoCell />
          </DataTable.Col>
          <DataTable.Col source="titulo" label="Titulo" className="max-w-[280px]" cellClassName="whitespace-normal">
            <TextField source="titulo" className="line-clamp-2" />
          </DataTable.Col>
          <DataTable.Col label="Tipo">
            <TipoEventoCell />
          </DataTable.Col>
          <DataTable.Col source="asignado_a_id" label="Responsable">
            <ReferenceField source="asignado_a_id" reference="users">
              <TextField source="nombre" />
            </ReferenceField>
          </DataTable.Col>
            <DataTable.Col label="Seguimiento" className="w-[110px] text-right">
              <SeguimientoMenu />
            </DataTable.Col>
          </DataTable>
        </div>
      </div>
    </List>
  );
};

type SeguimientoOptionId = "manana" | "proxima_semana" | "semana_siguiente" | "futuro";

const seguimientoOptions: Array<{ id: SeguimientoOptionId; label: string; daysToAdd: number }> = [
  { id: "manana", label: "Mañana", daysToAdd: 1 },
  { id: "proxima_semana", label: "Próxima semana", daysToAdd: 7 },
  { id: "semana_siguiente", label: "Semana siguiente", daysToAdd: 14 },
  { id: "futuro", label: "Futuro (15 días)", daysToAdd: 15 },
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

const SeguimientoMenu = () => {
  const record = useRecordContext<CRMEvento>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  if (!record) {
    return null;
  }

  const stopRowClick = (event: ReactMouseEvent) => {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopRowClick} disabled={loading}>
          <Flag className="h-4 w-4" />
          <span className="sr-only">Opciones de seguimiento</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {seguimientoOptions.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={(event) => handleSelection(option.id, event)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const getFechaBucketLabel = (fecha?: string | null) => {
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

const FechaEstadoCell = () => {
  const record = useRecordContext<CRMEvento>();
  if (!record) return null;
  const label = getFechaBucketLabel(record.fecha_evento);
  const labelText = {
    vencido: "vencido",
    hoy: "hoy",
    manana: "mañana",
    semana: "semana",
    siguientes: "siguientes",
  }[label];
  const badgeClass =
    fechaBadgeClasses[label as keyof typeof fechaBadgeClasses] ??
    "bg-slate-100 text-slate-700";
  return (
    <Badge className={`text-xs font-semibold ${badgeClass}`} variant="outline">
      {labelText ?? label}
    </Badge>
  );
};

const ContactoCell = () => {
  const record = useRecordContext<CRMEvento>();
  const contacto = record?.contacto;
  const nombre =
    contacto?.nombre_completo?.trim() ||
    contacto?.nombre?.trim() ||
    "";

  if (nombre) {
    return <span className="text-sm">{nombre}</span>;
  }

  if (record?.contacto_id) {
    return (
      <ReferenceField source="contacto_id" reference="crm/contactos">
        <TextField source="nombre_completo" />
      </ReferenceField>
    );
  }

  return <span className="text-sm text-muted-foreground">Sin contacto</span>;
};

const TipoEventoCell = () => {
  const record = useRecordContext<CRMEvento>();
  const value =
    record?.tipo_evento?.trim() ||
    record?.tipo_catalogo?.nombre?.trim() ||
    "Sin tipo";
  return <span className="text-sm">{value}</span>;
};
