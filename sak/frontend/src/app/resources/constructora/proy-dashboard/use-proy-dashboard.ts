"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl, dataProvider } from "@/lib/dataProvider";
import {
  buildAlertItems,
  buildDefaultFilters,
  DEFAULT_PROY_PERIOD,
  type AlertKey,
  type PeriodType,
  type ProyDashboardDetalleResponse,
  type ProyDashboardFilters,
  type ProyDashboardResponse,
  type ProyDashboardSelectorsResponse,
  type SelectOption,
  PROY_DASHBOARD_DETAIL_PAGE_SIZE,
  serializeFiltersToParams,
} from "./model";

const buildAuthenticatedHeaders = () => {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const fetchJsonWithAuth = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: buildAuthenticatedHeaders() });
  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(rawBody || `Error HTTP ${response.status}`);
  }

  return JSON.parse(rawBody) as T;
};

type CatalogItem = {
  id?: string | number;
  nombre?: string | null;
  full_name?: string | null;
};

const parseCatalogOptions = (
  rawItems: CatalogItem[] | undefined,
  resolveLabel: (item: CatalogItem) => string,
): SelectOption[] => [
  { value: "todos", label: "Todos" },
  ...((rawItems ?? []).map((item) => ({
    value: String(item.id),
    label: resolveLabel(item),
  }))),
];

export const useProyDashboard = () => {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_PROY_PERIOD);
  const [filters, setFilters] = useState<ProyDashboardFilters>(() => buildDefaultFilters(DEFAULT_PROY_PERIOD));
  const [dashboardData, setDashboardData] = useState<ProyDashboardResponse | null>(null);
  const [selectorData, setSelectorData] = useState<ProyDashboardSelectorsResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [detailData, setDetailData] = useState<ProyDashboardDetalleResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [showKpis, setShowKpis] = useState(false);
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertKey | null>(null);
  const [proyectoOptions, setProyectoOptions] = useState<SelectOption[]>([
    { value: "todos", label: "Todos" },
  ]);

  const dashboardRequestKey = useMemo(
    () => JSON.stringify({ filters, periodType }),
    [filters, periodType],
  );

  const detailRequestKey = useMemo(
    () => JSON.stringify({ filters, detailPage, selectedAlertKey, periodType }),
    [detailPage, filters, periodType, selectedAlertKey],
  );

  const estadoOptions = useMemo<SelectOption[]>(() => {
    const estados = Object.entries(selectorData?.por_estado ?? {})
      .sort((left, right) => left[0].localeCompare(right[0], "es"))
      .map(([value, count]) => ({
        value,
        label: `${value} (${count})`,
      }));
    return [{ value: "todos", label: "Todos" }, ...estados];
  }, [selectorData]);

  const fetchDashboardBundle = useCallback(async () => {
    const params = serializeFiltersToParams(filters, periodType);
    const selectorParams = serializeFiltersToParams(
      { ...filters, estado: "todos" },
      periodType,
    );
    params.set("limitTop", "5");

    const [dashboard, selectors] = await Promise.all([
      fetchJsonWithAuth<ProyDashboardResponse>(`${apiUrl}/api/dashboard/proyectos?${params.toString()}`),
      fetchJsonWithAuth<ProyDashboardSelectorsResponse>(
        `${apiUrl}/api/dashboard/proyectos/selectors?${selectorParams.toString()}`,
      ),
    ]);

    return { dashboard, selectors };
  }, [filters, periodType]);

  const fetchDetailPage = useCallback(
    async (page: number) => {
      const params = serializeFiltersToParams(filters, periodType);
      params.set("page", String(page));
      params.set("perPage", String(PROY_DASHBOARD_DETAIL_PAGE_SIZE));
      params.set("orderBy", "nombre");
      params.set("orderDir", "asc");

      if (selectedAlertKey) {
        params.set("alertKey", selectedAlertKey);
        return fetchJsonWithAuth<ProyDashboardDetalleResponse>(
          `${apiUrl}/api/dashboard/proyectos/detalle-alerta?${params.toString()}`,
        );
      }

      params.set("kpiKey", "todos");
      return fetchJsonWithAuth<ProyDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/proyectos/detalle?${params.toString()}`,
      );
    },
    [filters, periodType, selectedAlertKey],
  );

  useEffect(() => {
    let cancelled = false;
    setDashboardLoading(true);

    fetchDashboardBundle()
      .then(({ dashboard, selectors }) => {
        if (cancelled) return;
        setDashboardData(dashboard);
        setSelectorData(selectors);
      })
      .catch((error) => console.error("No se pudo cargar el dashboard de proyectos", error))
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardRequestKey, fetchDashboardBundle]);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);

    fetchDetailPage(detailPage)
      .then((data) => {
        if (cancelled) return;
        setDetailData((prev) => {
          if (detailPage <= 1 || !prev) {
            return data;
          }

          const seen = new Set(prev.data.map((item) => String(item.proyecto?.id)));
          const nextRows = data.data.filter((item) => !seen.has(String(item.proyecto?.id)));
          return {
            ...data,
            data: [...prev.data, ...nextRows],
          };
        });
      })
      .catch((error) => console.error("No se pudo cargar el detalle del dashboard de proyectos", error))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailPage, detailRequestKey, fetchDetailPage]);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const projectsResponse = await dataProvider.getList("proyectos", {
            pagination: { page: 1, perPage: 250 },
            sort: { field: "nombre", order: "ASC" },
            filter: {},
          });

        if (cancelled) return;

        setProyectoOptions(
          parseCatalogOptions(projectsResponse.data as CatalogItem[], (item) =>
            item.nombre?.trim() || `Proyecto ${item.id}`,
          ),
        );
      } catch (error) {
        console.error("No se pudieron cargar los filtros del dashboard de proyectos", error);
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterChange = <K extends keyof ProyDashboardFilters>(
    field: K,
    value: ProyDashboardFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setDetailPage(1);
  };

  const applyRange = (range: { startDate: string; endDate: string }, type: PeriodType) => {
    const normalizedType = type === "cuatrimestre" ? "trimestre" : type;
    setFilters((prev) => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
    setPeriodType(normalizedType);
    setDetailPage(1);
  };

  const selectAlert = (key: AlertKey) => {
    setSelectedAlertKey((current) => (current === key ? null : key));
    setDetailPage(1);
  };

  const alertItems = useMemo(() => buildAlertItems(dashboardData), [dashboardData]);
  const hasMoreDetail = detailData ? detailData.data.length < detailData.total : false;

  return {
    periodType,
    filters,
    dashboardData,
    selectorData,
    dashboardLoading,
    detailData,
    detailLoading,
    detailPage,
    showKpis,
    selectedAlertKey,
    proyectoOptions,
    estadoOptions,
    alertItems,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setSelectedAlertKey,
    setShowKpis,
    selectAlert,
  };
};
