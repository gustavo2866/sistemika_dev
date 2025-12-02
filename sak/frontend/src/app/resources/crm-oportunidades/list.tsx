"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
  CRMOportunidad,
  type CRMOportunidadEstado,
} from "./model";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGetList, useListContext, useRecordContext } from "ra-core";
import { SummaryChips, SummaryChipItem } from "@/components/lists/SummaryChips";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" className="w-full" alwaysOn />,
  <SelectInput key="estado" source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <TextInput key="propiedad.tipo" source="propiedad.tipo" label="Tipo de propiedad" />,
  <ReferenceInput key="emprendimiento_id" source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

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

const ACTIVE_ESTADOS = ["1-abierta", "2-visita", "3-cotiza", "4-reserva"];

const SoloActivasToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const isSoloActivas = Boolean(filterValues.solo_activas);

  const handleToggle = (checked: boolean) => {
    const nextFilters = { ...filterValues };
    if (checked) {
      nextFilters.solo_activas = true;
      setEstadoFilterValue(nextFilters, [...ACTIVE_ESTADOS]);
    } else {
      delete nextFilters.solo_activas;
      setEstadoFilterValue(nextFilters, []);
    }
    setFilters(nextFilters, {});
  };

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
      <Switch id="solo-activas" checked={isSoloActivas} onCheckedChange={handleToggle} />
      <Label htmlFor="solo-activas" className="text-sm font-medium">
        Solo activas
      </Label>
    </div>
  );
};

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const OperacionToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const { data: tipos } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { ventaId, alquilerId } = useMemo(() => {
    const findMatch = (term: string) =>
      tipos?.find((tipo: any) =>
        tipo?.codigo?.toLowerCase().includes(term) || tipo?.nombre?.toLowerCase().includes(term)
      );
    const venta = findMatch("venta");
    const alquiler = findMatch("alquiler");
    return {
      ventaId: venta?.id ? String(venta.id) : undefined,
      alquilerId: alquiler?.id ? String(alquiler.id) : undefined,
    };
  }, [tipos]);

  const currentId = filterValues.tipo_operacion_id
    ? String(filterValues.tipo_operacion_id)
    : undefined;

  const currentMode = currentId === ventaId ? "venta" : currentId === alquilerId ? "alquiler" : "todas";

  const handleSelect = (mode: "todas" | "venta" | "alquiler") => {
    const nextFilters = { ...filterValues };
    if (mode === "venta" && ventaId) {
      nextFilters.tipo_operacion_id = ventaId;
    } else if (mode === "alquiler" && alquilerId) {
      nextFilters.tipo_operacion_id = alquilerId;
    } else {
      delete nextFilters.tipo_operacion_id;
    }
    setFilters(nextFilters, {});
  };

  const buttons: Array<{ id: "todas" | "venta" | "alquiler"; label: string; disabled?: boolean }> = [
    { id: "todas", label: "Todas" },
    { id: "venta", label: "Venta", disabled: !ventaId },
    { id: "alquiler", label: "Alquiler", disabled: !alquilerId },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-1 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)]">
      {buttons.map(({ id, label, disabled }) => {
        const active = currentMode === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(id)}
            className={cn(
              "min-w-[88px] rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide transition-all",
              active
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100 enabled:cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

const oportunidadRowClass = () =>
  cn("transition-colors hover:bg-slate-50/70 odd:bg-white even:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60");

const EstadoSummaryChips = () => {
  const { filterValues, setFilters } = useListContext();
  const [items, setItems] = useState<SummaryChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterSignature = JSON.stringify(filterValues);

  useEffect(() => {
    let cancel = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        Object.entries(filterValues).forEach(([key, value]) => {
          if (value == null) {
            return;
          }
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
          `${API_URL}/crm/oportunidades/aggregates/estado?${query.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const raw: Array<{
          estado: CRMOportunidadEstado;
          total?: number;
        }> = json?.data ?? json ?? [];
        const totals = new Map<string, number>();
        raw.forEach(({ estado, total }) => {
          totals.set(estado, total ?? 0);
        });
        const normalized: SummaryChipItem[] =
          CRM_OPORTUNIDAD_ESTADO_CHOICES.map((choice) => {
            const total = totals.get(choice.id as string) ?? 0;
            return {
              label: formatEstadoOportunidad(choice.id as CRMOportunidadEstado),
              value: choice.id,
              count: total,
              chipClassName: cnBadge(choice.id as CRMOportunidadEstado),
              selectedChipClassName: cnBadge(
                choice.id as CRMOportunidadEstado,
                true
              ),
              countClassName: "text-sm font-semibold bg-muted/70",
              selectedCountClassName:
                "text-base font-bold bg-background/90 text-foreground",
            };
          });
        if (!cancel) {
          setItems(normalized);
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
  }, [filterSignature]);

  const currentEstados = normalizeEstadoFilter(filterValues.estado);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    setEstadoFilterValue(nextFilters, value ? [value] : []);
    setFilters(nextFilters, {});
  };
  return (
    <SummaryChips
      title={null}
      items={items}
      loading={loading}
      error={error}
      selectedValue={currentEstados[0]}
      onSelect={handleSelect}
      className="mb-0 border-none bg-transparent p-0 shadow-none"
    />
  );
};

export const CRMOportunidadList = () => (
  <List
    title={<ResourceTitle icon={Target} text="CRM - Oportunidades" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "created_at", order: "DESC" }}
    className="space-y-5"
  >
    <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/85 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <OperacionToggle />
            <SoloActivasToggle />
          </div>
          <div className="flex justify-end">
            <EstadoSummaryChips />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-sm">
        <DataTable rowClick="edit" className="border-0 shadow-none" rowClassName={oportunidadRowClass}>
          <DataTable.Col source="id" label="ID">
            <IdCell />
          </DataTable.Col>
          <DataTable.Col source="created_at" label="Fecha">
            <FechaCreacionCell />
          </DataTable.Col>
          <DataTable.Col
            source="contacto_id"
            label="Contacto"
            className="max-w-[220px] whitespace-normal"
            cellClassName="align-top whitespace-normal"
          >
            <ReferenceField source="contacto_id" reference="crm/contactos">
              <TextField
                source="nombre_completo"
                className="block text-sm leading-tight line-clamp-2 break-words"
              />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col
            source="propiedad_id"
            label="Propiedad"
            className="max-w-[220px] whitespace-normal"
            cellClassName="align-top whitespace-normal"
          >
            <PropiedadCell />
          </DataTable.Col>
          <DataTable.Col
            source="descripcion_estado"
            label="Descripción"
            className="w-[360px] min-w-[320px] whitespace-normal"
            cellClassName="align-top whitespace-normal"
          >
            <DescripcionCell />
          </DataTable.Col>
          <DataTable.Col source="estado" label="Estado">
            <EstadoBadge />
          </DataTable.Col>
          <DataTable.Col source="tipo_operacion_id" label="Operaci?n">
            <ReferenceField source="tipo_operacion_id" reference="crm/catalogos/tipos-operacion">
              <TextField source="nombre" />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col source="responsable_id" label="Responsable">
            <ReferenceField source="responsable_id" reference="users">
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

const IdCell = () => {
  const record = useRecordContext<CRMOportunidad>();
  if (!record) return null;
  return (
    <span className="text-sm font-semibold leading-tight">#{record.id}</span>
  );
};

const FechaCreacionCell = () => {
  const record = useRecordContext<CRMOportunidad & { created_at?: string | null }>();
  if (!record) return null;
  return (
    <div className="text-sm text-muted-foreground">
      {formatShortDate(record.created_at)}
    </div>
  );
};

const EstadoBadge = () => {
  const record = useRecordContext<CRMOportunidad>();
  if (!record) return null;
  const className =
    CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ??
    "bg-slate-200 text-slate-800";
  return (
    <div className="flex flex-col gap-1">
      <Badge className={className} variant="outline">
        {formatEstadoOportunidad(record.estado)}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {formatShortDate(record.fecha_estado)}
      </span>
    </div>
  );
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
};

const cnBadge = (estado: CRMOportunidadEstado, selected = false) => {
  const base =
    CRM_OPORTUNIDAD_ESTADO_BADGES[estado] ??
    "bg-slate-200 text-slate-800";
  return selected
    ? `${base} border-transparent shadow-sm ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

const DescripcionCell = () => {
  const record = useRecordContext<CRMOportunidad>();
  if (!record) return null;
  const descripcion = record.descripcion_estado?.trim();
  if (!descripcion) {
    return <span className="text-sm text-muted-foreground">Sin descripción</span>;
  }
  const texto =
    descripcion.length > 80 ? `${descripcion.slice(0, 80)}...` : descripcion;
  return (
    <p className="text-sm text-muted-foreground line-clamp-3 break-words">
      {texto}
    </p>
  );
};

const PropiedadCell = () => {
  const record = useRecordContext<CRMOportunidad>();
  if (!record) return null;
  return (
    <div className="flex flex-col text-sm">
      <ReferenceField
        source="propiedad_id"
        reference="propiedades"
        record={record}
      >
        <TextField
          source="nombre"
          className="font-medium leading-tight line-clamp-2 break-words"
        />
      </ReferenceField>
      <ReferenceField
        source="emprendimiento_id"
        reference="emprendimientos"
        record={record}
        link={false}
        empty="Sin emprendimiento"
      >
        <TextField
          source="nombre"
          className="text-xs text-muted-foreground line-clamp-2 break-words"
        />
      </ReferenceField>
    </div>
  );
};


