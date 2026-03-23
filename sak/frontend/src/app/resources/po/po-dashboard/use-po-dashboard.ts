"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";
import {
  buildAlertItems,
  buildBucketOptions,
  buildDefaultFilters,
  DEFAULT_PO_PERIOD,
  formatTrendLabel,
  serializeFiltersToParams,
  shiftDashboardFilters,
  type PoDashboardAlertKey,
  type PoDashboardDetailResponse,
  type PoDashboardFilters,
  type PoDashboardKpiKey,
  type PoDashboardResponse,
  type PeriodType,
  type SelectOption,
} from "./model";

const DETAIL_PAGE_SIZE = 5;
const SHOW_KPIS_STORAGE_KEY = "po-dashboard:show-kpis";

const getStoredShowKpis = () => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SHOW_KPIS_STORAGE_KEY);
  if (stored == null) return true;
  return stored !== "false";
};

const parseList = (json: any) => {
  if (Array.isArray(json)) return json;
  if (json?.data && Array.isArray(json.data)) return json.data;
  return [];
};

export const usePoDashboard = () => {
  const [periodType, setPeriodType] =
    useState<PeriodType>(DEFAULT_PO_PERIOD);
  const [filters, setFilters] = useState<PoDashboardFilters>(() =>
    buildDefaultFilters(DEFAULT_PO_PERIOD),
  );
  const [dashboardData, setDashboardData] =
    useState<PoDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [detailKpi, setDetailKpi] =
    useState<PoDashboardKpiKey>("solicitadas");
  const [detailData, setDetailData] =
    useState<PoDashboardDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [selectedBucket, setSelectedBucket] = useState("todos");
  const [selectedAlertKey, setSelectedAlertKey] =
    useState<PoDashboardAlertKey | null>(null);
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false);
  const [showKpis, setShowKpis] = useState(getStoredShowKpis);
  const [previousPeriodData, setPreviousPeriodData] =
    useState<PoDashboardResponse | null>(null);
  const [periodTrendData, setPeriodTrendData] = useState<
    Array<{ label: string; amount: number; count: number }>
  >([]);

  const [solicitanteOptions, setSolicitanteOptions] = useState<SelectOption[]>([
    { value: "todos", label: "Todos" },
  ]);
  const [proveedorOptions, setProveedorOptions] = useState<SelectOption[]>([
    { value: "todos", label: "Todos" },
  ]);
  const [tipoSolicitudOptions, setTipoSolicitudOptions] = useState<
    SelectOption[]
  >([{ value: "todos", label: "Todos" }]);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async (requestFilters: PoDashboardFilters) => {
      const params = serializeFiltersToParams(requestFilters);
      params.set("limitTop", "8");
      const response = await fetch(`${apiUrl}/api/dashboard/po?${params.toString()}`);
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
      return response.json() as Promise<PoDashboardResponse>;
    };

    setDashboardLoading(true);
    const timeout = setTimeout(() => {
      Promise.all([
        fetchDashboard(filters),
        fetchDashboard(shiftDashboardFilters(filters, periodType, -1)),
        Promise.all(
          [-3, -2, -1, 0].map(async (step) => {
            const trendFilters = shiftDashboardFilters(filters, periodType, step);
            const data = await fetchDashboard(trendFilters);
            return {
              label: formatTrendLabel(trendFilters.startDate, periodType),
              amount: data.compras_periodo.amount,
              count: data.compras_periodo.count,
            };
          }),
        ),
      ])
        .then(([currentData, previousData, trendData]) => {
          if (cancelled) return;
          setDashboardData(currentData);
          setPreviousPeriodData(previousData);
          setPeriodTrendData(trendData);
        })
        .catch((error) =>
          console.error("No se pudo cargar el dashboard PO", error),
        )
        .finally(() => {
          if (!cancelled) setDashboardLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filters, periodType]);

  useEffect(() => {
    let cancelled = false;
    const params = serializeFiltersToParams(filters);
    params.set("kpiKey", detailKpi);
    params.set("page", detailPage.toString());
    params.set("perPage", DETAIL_PAGE_SIZE.toString());
    params.set("orderBy", "created_at");
    params.set("orderDir", "desc");
    if (selectedAlertKey) params.set("alertKey", selectedAlertKey);
    if (selectedBucket !== "todos") params.set("bucket", selectedBucket);

    setDetailLoading(true);
    const timeout = setTimeout(() => {
      fetch(`${apiUrl}/api/dashboard/po/detalle?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
          return response.json() as Promise<PoDashboardDetailResponse>;
        })
        .then((data) => {
          if (cancelled) return;
          setDetailData((prev) => {
            if (detailPage <= 1 || !prev) {
              return data;
            }
            const seen = new Set(
              prev.data.map((item) => `${item.order?.id ?? "x"}-${item.fecha_creacion}`),
            );
            const nextRows = data.data.filter(
              (item) => !seen.has(`${item.order?.id ?? "x"}-${item.fecha_creacion}`),
            );
            return {
              ...data,
              data: [...prev.data, ...nextRows],
            };
          });
        })
        .catch((error) =>
          console.error("No se pudo cargar el detalle PO", error),
        )
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filters, detailKpi, detailPage, selectedAlertKey, selectedBucket]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SHOW_KPIS_STORAGE_KEY, String(showKpis));
  }, [showKpis]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [usersRes, provRes, tiposRes] = await Promise.all([
          fetch(`${apiUrl}/users?perPage=100`),
          fetch(`${apiUrl}/proveedores?perPage=100`),
          fetch(`${apiUrl}/tipos-solicitud?perPage=100`),
        ]);
        if (!usersRes.ok || !provRes.ok || !tiposRes.ok) {
          throw new Error("Error obteniendo catalogos");
        }
        const [usersJson, provJson, tiposJson] = await Promise.all([
          usersRes.json(),
          provRes.json(),
          tiposRes.json(),
        ]);

        if (cancelled) return;

        setSolicitanteOptions([
          { value: "todos", label: "Todos" },
          ...parseList(usersJson).map((item: any) => ({
            value: String(item.id),
            label: item.nombre ?? `Usuario ${item.id}`,
          })),
        ]);
        setProveedorOptions([
          { value: "todos", label: "Todos" },
          ...parseList(provJson).map((item: any) => ({
            value: String(item.id),
            label: item.nombre ?? `Proveedor ${item.id}`,
          })),
        ]);
        setTipoSolicitudOptions([
          { value: "todos", label: "Todos" },
          ...parseList(tiposJson).map((item: any) => ({
            value: String(item.id),
            label: item.nombre ?? `Tipo ${item.id}`,
          })),
        ]);
      } catch (error) {
        console.error("No se pudieron cargar los filtros del dashboard PO", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterChange = <K extends keyof PoDashboardFilters>(
    field: K,
    value: PoDashboardFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setDetailPage(1);
  };

  const applyRange = (
    range: { startDate: string; endDate: string },
    type: PeriodType,
  ) => {
    setFilters((prev) => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
    setPeriodType(type);
    setSelectedBucket("todos");
    setDetailPage(1);
  };

  const resetFilters = () => {
    setFilters(buildDefaultFilters(periodType));
    setSelectedBucket("todos");
    setSelectedAlertKey(null);
    setDetailKpi("solicitadas");
    setDetailPage(1);
    setShowAdditionalFilters(false);
  };

  const selectAlert = (key: PoDashboardAlertKey) => {
    setSelectedAlertKey(key);
    setDetailPage(1);
  };

  const clearActiveAlert = () => {
    setSelectedAlertKey(null);
    setDetailPage(1);
  };

  const selectDetailKpi = (key: PoDashboardKpiKey) => {
    setSelectedAlertKey(null);
    setDetailKpi(key);
    setDetailPage(1);
  };

  const bucketOptions = useMemo(
    () => buildBucketOptions(dashboardData),
    [dashboardData],
  );
  const alertItems = useMemo(
    () => buildAlertItems(dashboardData),
    [dashboardData],
  );
  const totalPages = detailData
    ? Math.max(1, Math.ceil(detailData.total / DETAIL_PAGE_SIZE))
    : 1;
  const hasMoreDetail = detailData ? detailData.data.length < detailData.total : false;

  return {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    detailKpi,
    detailData,
    detailLoading,
    detailPage,
    selectedBucket,
    selectedAlertKey,
    showAdditionalFilters,
    showKpis,
    previousPeriodData,
    periodTrendData,
    solicitanteOptions,
    proveedorOptions,
    tipoSolicitudOptions,
    bucketOptions,
    alertItems,
    totalPages,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setSelectedBucket,
    setShowAdditionalFilters,
    setShowKpis,
    resetFilters,
    selectAlert,
    clearActiveAlert,
    selectDetailKpi,
  };
};
