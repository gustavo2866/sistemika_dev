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
import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
  CRMOportunidad,
  type CRMOportunidadEstado,
} from "./model";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useListContext, useRecordContext } from "ra-core";
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
    <SoloActivasToggle />
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

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
      title="Oportunidades por estado"
      items={items}
      loading={loading}
      error={error}
      selectedValue={currentEstados[0]}
      onSelect={handleSelect}
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
  >
    <EstadoSummaryChips />
    <DataTable rowClick="edit">
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
        <ReferenceField source="propiedad_id" reference="propiedades">
          <TextField
            source="nombre"
            className="block text-sm leading-tight line-clamp-2 break-words"
          />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <EstadoBadge />
      </DataTable.Col>
      <DataTable.Col source="tipo_operacion_id" label="Operación">
        <ReferenceField source="tipo_operacion_id" reference="crm/catalogos/tipos-operacion">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Monto">
        <MontoMonedaCell />
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

const MontoMonedaCell = () => {
  const record = useRecordContext<
    CRMOportunidad & { moneda?: { codigo?: string | null }; moneda_codigo?: string | null }
  >();
  if (!record) return null;
  const codigo =
    record.moneda?.codigo ??
    (record as unknown as { moneda_codigo?: string | null })?.moneda_codigo ??
    "";
  const montoFormatted =
    typeof record.monto === "number"
      ? record.monto.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "-";

  return (
    <span className="text-sm font-medium">
      {codigo ? `${codigo} ${montoFormatted}` : montoFormatted}
    </span>
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
