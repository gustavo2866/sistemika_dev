"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useListContext } from "ra-core";

import {
  DashboardCard,
  type DashboardCardBucket,
} from "@/components/forms/form_order";

//#region Tipos y constantes del dashboard

export const FECHA_ESTADO_FILTER_KEY = "fecha_estado_quick";

type FechaEstadoFilterOption = "todos" | "hoy" | "semana";
type EntradaBucketKey = "nuevo" | "descartado" | "semana" | "todos";
type SalidaBucketKey = FechaEstadoFilterOption;

type MensajesDashboardCounts = {
  nuevos: number;
  entrada_descartados: number;
  entrada: number;
  entrada_semana: number;
  salida: number;
  salida_hoy: number;
  salida_semana: number;
};

const MENSAJES_DASHBOARD_DEFAULT_COUNTS: MensajesDashboardCounts = {
  nuevos: 0,
  entrada_descartados: 0,
  entrada: 0,
  entrada_semana: 0,
  salida: 0,
  salida_hoy: 0,
  salida_semana: 0,
};

//#endregion Tipos y constantes del dashboard

//#region Helpers de filtros

// Normaliza el valor de un filtro a un array de strings.
const normalizeArrayFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : String(entry ?? "")))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
};

// Actualiza un filtro de tipo array dentro del objeto de filtros.
const setArrayFilterValue = (
  filters: Record<string, unknown>,
  key: string,
  values: string[],
) => {
  if (values.length) {
    filters[key] = values;
  } else {
    delete filters[key];
  }
};

// Devuelve el rango ISO correspondiente al filtro rapido de fecha.
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

// Elimina los filtros de rango por fecha de estado.
const removeFechaEstadoBounds = (filters: Record<string, unknown>) => {
  const nextFilters = { ...filters };
  delete nextFilters.fecha_estado__gte;
  delete nextFilters.fecha_estado__lte;
  return nextFilters;
};

// Aplica el filtro rapido de fecha manteniendo el resto del contexto.
const applyFechaEstadoFilterOption = (
  filters: Record<string, unknown>,
  option: FechaEstadoFilterOption,
  skipBounds = false,
) => {
  const nextFilters: Record<string, unknown> = {
    ...filters,
    [FECHA_ESTADO_FILTER_KEY]: option,
  };

  delete nextFilters.fecha_estado__gte;
  delete nextFilters.fecha_estado__lte;

  if (!skipBounds && option !== "todos") {
    const bounds = getFechaEstadoBounds(option);
    if (bounds.from) nextFilters.fecha_estado__gte = bounds.from;
    if (bounds.to) nextFilters.fecha_estado__lte = bounds.to;
  }

  return nextFilters;
};

// Devuelve el valor seleccionado del filtro rapido de fecha.
const getFechaEstadoOption = (
  filters: Record<string, unknown>,
): FechaEstadoFilterOption => {
  const storedOption = filters[FECHA_ESTADO_FILTER_KEY];

  if (
    storedOption === "hoy" ||
    storedOption === "semana" ||
    storedOption === "todos"
  ) {
    return storedOption;
  }

  return "hoy";
};

// Aplica uno de los subfiltros propios del bucket de entrada.
const applyEntradaBucketFilters = (
  bucketKey: EntradaBucketKey,
  currentFilters: Record<string, unknown>,
): Record<string, unknown> => {
  let nextFilters = { ...currentFilters };
  setArrayFilterValue(nextFilters, "tipo", ["entrada"]);

  if (bucketKey === "nuevo") {
    setArrayFilterValue(nextFilters, "estado", ["nuevo"]);
    return removeFechaEstadoBounds(nextFilters);
  }

  if (bucketKey === "descartado") {
    setArrayFilterValue(nextFilters, "estado", ["descartado"]);
    return removeFechaEstadoBounds(nextFilters);
  }

  delete nextFilters.estado;
  nextFilters = removeFechaEstadoBounds(nextFilters);

  if (bucketKey === "semana") {
    return applyFechaEstadoFilterOption(nextFilters, "semana");
  }

  nextFilters[FECHA_ESTADO_FILTER_KEY] = "todos";
  return nextFilters;
};

// Deriva el bucket activo dentro de la tarjeta de entrada.
const getEntradaSelectedBucket = (
  filters: Record<string, unknown>,
): EntradaBucketKey | undefined => {
  const currentTipos = normalizeArrayFilter(filters.tipo);
  const currentEstados = normalizeArrayFilter(filters.estado);

  if (currentTipos[0] !== "entrada") return undefined;
  if (currentEstados[0] === "nuevo") return "nuevo";
  if (currentEstados[0] === "descartado") return "descartado";

  const activeOption = getFechaEstadoOption(filters);
  if (activeOption === "semana") return "semana";
  if (activeOption === "todos") return "todos";
  return undefined;
};

// Aplica uno de los subfiltros propios del bucket de salida.
const applySalidaBucketFilters = (
  bucketKey: SalidaBucketKey,
  currentFilters: Record<string, unknown>,
): Record<string, unknown> => {
  let nextFilters = { ...currentFilters };
  setArrayFilterValue(nextFilters, "tipo", ["salida"]);
  delete nextFilters.estado;
  nextFilters = removeFechaEstadoBounds(nextFilters);
  return applyFechaEstadoFilterOption(nextFilters, bucketKey);
};

// Deriva el bucket activo dentro de la tarjeta de salida.
const getSalidaSelectedBucket = (
  filters: Record<string, unknown>,
): SalidaBucketKey | undefined => {
  const currentTipos = normalizeArrayFilter(filters.tipo);
  if (currentTipos[0] !== "salida") return undefined;
  return getFechaEstadoOption(filters);
};

// Limpia tipo, estado y rango de fecha para construir conteos neutrales.
const getDashboardBaseFilter = (filters: Record<string, unknown>) => {
  const nextFilters = { ...filters };
  delete nextFilters.tipo;
  delete nextFilters.estado;
  delete nextFilters[FECHA_ESTADO_FILTER_KEY];
  delete nextFilters.fecha_estado__gte;
  delete nextFilters.fecha_estado__lte;
  return nextFilters;
};

//#endregion Helpers de filtros

//#region Componente principal

// Renderiza el dashboard superior de mensajes y maneja sus buckets de filtrado.
export const CRMMensajesListDashboard = () => {
  const dataProvider = useDataProvider();
  const { filterValues, setFilters } = useListContext();
  const [counts, setCounts] = useState<MensajesDashboardCounts>(
    MENSAJES_DASHBOARD_DEFAULT_COUNTS,
  );
  const [loading, setLoading] = useState(false);

  const entradaSelectedBucket = getEntradaSelectedBucket(filterValues);
  const salidaSelectedBucket = getSalidaSelectedBucket(filterValues);
  const dashboardBaseFilter = useMemo(
    () => getDashboardBaseFilter(filterValues),
    [filterValues],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const fetchCount = async (filter: Record<string, unknown>) => {
        const response = await dataProvider.getList("crm/mensajes", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
          filter,
        });

        const total = response?.total;
        if (typeof total === "number") return total;
        return Array.isArray(response?.data) ? response.data.length : 0;
      };

      try {
        const [
          nuevos,
          entradaDescartados,
          entrada,
          entradaSemana,
          salida,
          salidaHoy,
          salidaSemana,
        ] = await Promise.all([
          fetchCount({
            ...dashboardBaseFilter,
            tipo: ["entrada"],
            estado: ["nuevo"],
          }),
          fetchCount({
            ...dashboardBaseFilter,
            tipo: ["entrada"],
            estado: ["descartado"],
          }),
          fetchCount({ ...dashboardBaseFilter, tipo: ["entrada"] }),
          fetchCount(
            applyFechaEstadoFilterOption(
              { ...dashboardBaseFilter, tipo: ["entrada"] },
              "semana",
            ),
          ),
          fetchCount({ ...dashboardBaseFilter, tipo: ["salida"] }),
          fetchCount(
            applyFechaEstadoFilterOption(
              { ...dashboardBaseFilter, tipo: ["salida"] },
              "hoy",
            ),
          ),
          fetchCount(
            applyFechaEstadoFilterOption(
              { ...dashboardBaseFilter, tipo: ["salida"] },
              "semana",
            ),
          ),
        ]);

        if (!cancelled) {
          setCounts({
            nuevos,
            entrada_descartados: entradaDescartados,
            entrada,
            entrada_semana: entradaSemana,
            salida,
            salida_hoy: salidaHoy,
            salida_semana: salidaSemana,
          });
        }
      } catch (error) {
        console.error("No se pudieron cargar los contadores de mensajes", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [dataProvider, dashboardBaseFilter]);

  const cardSummary = (value: number) => (
    <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
      {loading ? "..." : value}
    </span>
  );

  const entradaBuckets: DashboardCardBucket[] = [
    {
      key: "nuevo",
      label: "Nuevo",
      value: counts.nuevos,
      tone: "info",
      labelClassName: "text-blue-700",
      valueClassName: "text-blue-700",
    },
    {
      key: "descartado",
      label: "Descartados",
      value: counts.entrada_descartados,
      tone: "muted",
      labelClassName: "text-slate-600",
      valueClassName: "text-slate-600",
    },
    {
      key: "semana",
      label: "Semana",
      value: counts.entrada_semana,
      tone: "success",
      labelClassName: "text-emerald-700",
      valueClassName: "text-emerald-700",
    },
    {
      key: "todos",
      label: "Todos",
      value: counts.entrada,
      tone: "muted",
      labelClassName: "text-slate-600",
      valueClassName: "text-slate-600",
    },
  ];

  const salidaBuckets: DashboardCardBucket[] = [
    {
      key: "hoy",
      label: "Hoy",
      value: counts.salida_hoy,
      tone: "warning",
      labelClassName: "text-amber-700",
      valueClassName: "text-amber-700",
    },
    {
      key: "semana",
      label: "Semana",
      value: counts.salida_semana,
      tone: "warning",
      labelClassName: "text-amber-700",
      valueClassName: "text-amber-700",
    },
    {
      key: "todos",
      label: "Todos",
      value: counts.salida,
      tone: "muted",
      labelClassName: "text-slate-600",
      valueClassName: "text-slate-600",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-2 sm:grid-cols-2">
        <DashboardCard
          id="entrada"
          title="Entrada"
          summary={cardSummary(counts.entrada)}
          dotTone="success"
          selectedId={entradaSelectedBucket ? "entrada" : undefined}
          selectedBucketKey={entradaSelectedBucket}
          onSelect={(value) => {
            if (!value) return;
            setFilters(applyEntradaBucketFilters("todos", filterValues), {});
          }}
          buckets={entradaBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Msgs</span>
            </>
          }
          onBucketSelect={(payload) => {
            const bucketKey = payload.bucketKey as EntradaBucketKey | undefined;
            if (!bucketKey) {
              setFilters(applyEntradaBucketFilters("todos", filterValues), {});
              return;
            }

            setFilters(applyEntradaBucketFilters(bucketKey, filterValues), {});
          }}
          bucketColumnsClassName="grid-cols-[1fr_auto]"
          defaultBucketsOpen={false}
        />
        <DashboardCard
          id="salida"
          title="Salida"
          summary={cardSummary(counts.salida)}
          dotTone="warning"
          selectedId={salidaSelectedBucket ? "salida" : undefined}
          selectedBucketKey={salidaSelectedBucket}
          onSelect={(value) => {
            if (!value) return;
            setFilters(applySalidaBucketFilters("todos", filterValues), {});
          }}
          buckets={salidaBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Msgs</span>
            </>
          }
          onBucketSelect={(payload) => {
            const bucketKey = payload.bucketKey as SalidaBucketKey | undefined;
            if (!bucketKey) {
              setFilters(applySalidaBucketFilters("todos", filterValues), {});
              return;
            }

            setFilters(applySalidaBucketFilters(bucketKey, filterValues), {});
          }}
          bucketColumnsClassName="grid-cols-[1fr_auto]"
          defaultBucketsOpen={false}
        />
      </div>
    </div>
  );
};

//#endregion Componente principal
