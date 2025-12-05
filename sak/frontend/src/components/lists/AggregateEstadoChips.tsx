"use client";

import { useEffect, useState } from "react";
import { useListContext } from "ra-core";
import { SummaryChips, type SummaryChipItem } from "./SummaryChips";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Choice {
  id: string;
  name: string;
}

interface AggregateEstadoChipsProps {
  /** Endpoint relativo para el aggregate (ej: "crm/mensajes/aggregates/estado") */
  endpoint: string;
  /** Array de opciones de estado */
  choices: Choice[];
  /** Record con colores de badges para cada estado */
  badges: Record<string, string>;
  /** Nombre del filtro (default: "estado") */
  filterKey?: string;
  /** Función para obtener el className del chip */
  getChipClassName?: (estado: string, selected?: boolean) => string;
  /** Función para filtrar choices según otros filtros activos */
  filterChoices?: (choices: Choice[], filterValues: Record<string, unknown>) => Choice[];
  /** Slot para componentes adicionales (ej: TipoDualToggle) */
  leftSlot?: React.ReactNode;
  /** Clase CSS del contenedor principal */
  className?: string;
  /** Layout compacto */
  dense?: boolean;
}

const defaultChipClass = (estado: string, badges: Record<string, string>, selected = false) => {
  const base = badges[estado] ?? "bg-slate-100 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

const normalizeFilter = (value: unknown): string[] => {
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

const setFilterValue = (filters: Record<string, unknown>, key: string, values: string[]) => {
  if (values.length) {
    filters[key] = values;
  } else {
    delete filters[key];
  }
};

export const AggregateEstadoChips = ({
  endpoint,
  choices,
  badges,
  filterKey = "estado",
  getChipClassName,
  filterChoices,
  leftSlot,
  className = "rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur-md",
  dense = false,
}: AggregateEstadoChipsProps) => {
  const { filterValues, setFilters } = useListContext();
  const [items, setItems] = useState<SummaryChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(filterValues);

  const chipClassFn = getChipClassName || ((estado: string, selected = false) => 
    defaultChipClass(estado, badges, selected)
  );

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
          `${API_URL}/${endpoint}?${query.toString()}`
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

        // Apply filterChoices if provided
        const filteredChoices = filterChoices 
          ? filterChoices(choices, filterValues)
          : choices;

        const mapped: SummaryChipItem[] = filteredChoices.map((choice) => ({
          label: choice.name,
          value: choice.id,
          count: totals.get(choice.id) ?? 0,
          chipClassName: chipClassFn(choice.id, false),
          selectedChipClassName: chipClassFn(choice.id, true),
          countClassName: "text-xs font-semibold bg-slate-100 text-slate-600",
          selectedCountClassName: "text-xs font-semibold bg-white/70 text-slate-900",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const currentValues = normalizeFilter(filterValues[filterKey]);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    setFilterValue(nextFilters, filterKey, value ? [value] : []);
    setFilters(nextFilters, {});
  };

  const wrapperClass = dense
    ? "flex flex-wrap items-center justify-between gap-2"
    : "flex flex-col gap-2 md:flex-row md:items-center md:justify-between";

  const leftSlotClass = dense
    ? "flex flex-wrap items-center gap-2"
    : "flex justify-center lg:justify-start lg:flex-shrink-0";

  const chipsWrapperClass = dense
    ? "flex flex-1 justify-end"
    : "flex w-full justify-center lg:flex-1 lg:justify-end";

  return (
    <div className={className}>
      <div className={wrapperClass}>
        {leftSlot && <div className={leftSlotClass}>{leftSlot}</div>}
        <div className={chipsWrapperClass}>
          <SummaryChips
            className="mb-0 border-none bg-transparent p-0 shadow-none"
            title={null}
            items={items}
            loading={loading}
            error={error}
            selectedValue={currentValues[0]}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
};
