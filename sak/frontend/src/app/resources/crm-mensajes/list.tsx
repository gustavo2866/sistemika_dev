"use client";

import { useEffect, useState } from "react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { Badge } from "@/components/ui/badge";
import { useListContext, useRecordContext } from "ra-core";
import { SummaryChips, type SummaryChipItem } from "@/components/lists/SummaryChips";
import { ResourceTitle } from "@/components/resource-title";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CRMMensaje } from "./model";
import {
  CRM_MENSAJE_TIPO_CHOICES,
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_PRIORIDAD_CHOICES,
  CRM_MENSAJE_ESTADO_BADGES,
  CRM_MENSAJE_PRIORIDAD_BADGES,
  formatMensajeTipo,
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajePrioridad,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

const setTipoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.tipo = values;
  } else {
    delete filters.tipo;
  }
};

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

const setEstadoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.estado = values;
  } else {
    delete filters.estado;
  }
};

const estadoChipClass = (estado: string, selected = false) => {
  const base =
    CRM_MENSAJE_ESTADO_BADGES[estado as keyof typeof CRM_MENSAJE_ESTADO_BADGES] ??
    "bg-slate-100 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

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
  <SelectInput
    key="prioridad"
    source="prioridad"
    label="Prioridad"
    choices={CRM_MENSAJE_PRIORIDAD_CHOICES}
    emptyText="Todas"
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

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const TipoDualToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const current = currentTipos[0];

  const handleToggle = (next?: string) => {
    const newFilters = { ...filterValues };
    setTipoFilterValue(newFilters, next ? [next] : []);
    setFilters(newFilters, {});
  };

  const options = [
    { id: undefined, label: "Todos" },
    { id: "entrada", label: "Entrada" },
    { id: "salida", label: "Salida" },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-1 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      {options.map(({ id, label }, index) => {
        const isActive = current === id || (!id && !current);
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isActive}
            data-active={isActive}
            onClick={() => handleToggle(id)}
            className={cn(
              "min-w-[92px] rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-all duration-200",
              isFirst ? "rounded-l-full" : "",
              isLast ? "rounded-r-full" : "",
              isActive
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
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
        const response = await fetch(
          `${API_URL}/crm/mensajes/aggregates/estado?${query.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const raw: Array<{ estado: string; total?: number }> =
          json?.data ?? json ?? [];
        const totals = new Map<string, number>();
        raw.forEach(({ estado, total }) => {
          totals.set(estado, total ?? 0);
        });
        const mapped: SummaryChipItem[] = CRM_MENSAJE_ESTADO_CHOICES.map(
          (choice) => ({
            label: choice.name,
            value: choice.id,
            count: totals.get(choice.id as string) ?? 0,
            chipClassName: estadoChipClass(choice.id),
            selectedChipClassName: estadoChipClass(choice.id, true),
            countClassName: "text-xs font-semibold bg-slate-100 text-slate-600",
            selectedCountClassName:
              "text-xs font-semibold bg-white/70 text-slate-900",
          })
        );
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

  const currentEstados = normalizeEstadoFilter(filterValues.estado);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    setEstadoFilterValue(nextFilters, value ? [value] : []);
    setFilters(nextFilters, {});
  };

  return (
    <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex justify-start">
          <TipoDualToggle />
        </div>
        <SummaryChips
          className="mb-0 border-none bg-transparent p-0 shadow-none"
          title={null}
          items={items}
          loading={loading}
          error={error}
          selectedValue={currentEstados[0]}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
};

export const CRMMensajeList = () => (
  <List
    title={<ResourceTitle icon={Mail} text="CRM - Mensajes" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "fecha_mensaje", order: "DESC" }}
  >
    <EstadoSummaryChips />
    <DataTable rowClick="show">
      <DataTable.Col source="id" label="ID">
        <IdCell />
      </DataTable.Col>
      <DataTable.Col
        source="fecha_mensaje"
        label="Fecha/Hora"
        className="w-[150px] min-w-[140px]"
        cellClassName="!whitespace-normal"
      >
        <FechaCell />
      </DataTable.Col>
      <DataTable.Col source="contacto_id" label="Contacto" className="max-w-[220px]">
        <ContactoCell />
      </DataTable.Col>
      <DataTable.Col
        source="asunto"
        label="Asunto"
        className="w-[440px] min-w-[360px]"
        cellClassName="!whitespace-normal"
      >
        <AsuntoCell />
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo / Canal" className="w-[140px] min-w-[120px]">
        <TipoCanalCell />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado / Prioridad">
        <EstadoPrioridadCell />
      </DataTable.Col>
      <DataTable.Col source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="oportunidad_id" label="Oportunidad">
        <OportunidadCell />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);

const IdCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return <span className="text-sm font-semibold">#{record.id}</span>;
};

const FechaCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record?.fecha_mensaje) {
    return <span className="text-sm text-muted-foreground">Sin fecha</span>;
  }
  const date = new Date(record.fecha_mensaje);
  return (
    <div className="flex flex-col text-sm">
      <span>{date.toLocaleDateString("es-AR")}</span>
      <span className="text-muted-foreground text-xs">{date.toLocaleTimeString("es-AR")}</span>
    </div>
  );
};

const ContactoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="flex flex-col text-sm">
      {record.contacto ? (
        <span className="font-medium">{record.contacto.nombre_completo || record.contacto.nombre}</span>
      ) : record.contacto_id ? (
        <span className="font-medium">Contacto #{record.contacto_id}</span>
      ) : (
        <span className="font-medium text-muted-foreground">Sin contacto</span>
      )}
      {record.contacto_referencia ? (
        <span className="text-xs text-muted-foreground">{record.contacto_referencia}</span>
      ) : null}
    </div>
  );
};

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


const TipoCanalCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Badge variant="outline" className="w-fit border-transparent bg-slate-100 text-slate-800">
        {formatMensajeTipo(record.tipo)}
      </Badge>
      <Badge variant="outline" className="w-fit border-transparent bg-muted text-foreground">
        {formatMensajeCanal(record.canal)}
      </Badge>
    </div>
  );
};

const EstadoPrioridadCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const estadoClass = record.estado
    ? CRM_MENSAJE_ESTADO_BADGES[record.estado]
    : "bg-slate-200 text-slate-800";
  const prioridadClass = record.prioridad
    ? CRM_MENSAJE_PRIORIDAD_BADGES[record.prioridad]
    : "bg-slate-200 text-slate-800";
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Badge variant="outline" className={`${estadoClass} border-transparent`}>
        {formatMensajeEstado(record.estado)}
      </Badge>
      <Badge variant="outline" className={`${prioridadClass} border-transparent`}>
        {formatMensajePrioridad(record.prioridad)}
      </Badge>
    </div>
  );
};

const OportunidadCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record?.oportunidad_id && !record?.oportunidad) {
    return <span className="text-sm text-muted-foreground">Sin asignar</span>;
  }
  return (
    <div className="flex flex-col text-sm">
      <span className="font-medium">
        Oportunidad #{record.oportunidad?.id ?? record.oportunidad_id}
      </span>
      {record.oportunidad?.nombre ? (
        <span className="text-xs text-foreground">{record.oportunidad.nombre}</span>
      ) : null}
      {record.oportunidad?.descripcion_estado ? (
        <span className="text-xs text-muted-foreground">
          {record.oportunidad.descripcion_estado}
        </span>
      ) : null}
    </div>
  );
};
