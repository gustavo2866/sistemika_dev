"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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
import {
  clearDashboardReturnMarker,
  DASHBOARD_RETURN_TTL_MS,
  loadDashboardReturnMarker,
} from "./return-state";
import {
  type DashboardCatalogItem,
  fetchJsonWithAuth,
  getDashboardRequestKey,
  getDetailRequestKey,
  getStoredShowKpis,
  loadDashboardSnapshot,
  saveDashboardSnapshot,
  SHOW_KPIS_STORAGE_KEY,
} from "./state-helpers";

const parseCatalogOptions = (
  rawItems: DashboardCatalogItem[] | undefined,
  resolveLabel: (item: DashboardCatalogItem) => string,
): SelectOption[] => [
  { value: "todos", label: "Todos" },
  ...((rawItems ?? []).map((item) => ({
    value: String(item.id),
    label: resolveLabel(item),
  }))),
];

export const useProyDashboard = () => {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const pendingReturnMarker = useMemo(
    () => loadDashboardReturnMarker(returnTo, DASHBOARD_RETURN_TTL_MS),
    [returnTo],
  );
  const hasPendingReturn = Boolean(pendingReturnMarker);
  const initialSnapshot = useMemo(
    () => loadDashboardSnapshot(returnTo, hasPendingReturn, DASHBOARD_RETURN_TTL_MS),
    [returnTo, hasPendingReturn],
  );
  const shouldSkipInitialFetch = Boolean(initialSnapshot || pendingReturnMarker);
  const initialPeriodType =
    pendingReturnMarker?.periodType ?? initialSnapshot?.periodType ?? DEFAULT_PROY_PERIOD;
  const initialFilters =
    pendingReturnMarker?.filters ??
    initialSnapshot?.filters ??
    buildDefaultFilters(initialPeriodType);
  const initialActiveSelectorKey =
    pendingReturnMarker?.activeSelectorKey ??
    initialSnapshot?.activeSelectorKey ??
    (initialFilters.estado !== "todos" ? initialFilters.estado : null);
  const initialSelectedAlertKey =
    pendingReturnMarker?.selectedAlertKey ?? initialSnapshot?.selectedAlertKey ?? null;
  const initialDashboardRequestKey = shouldSkipInitialFetch
    ? `0:${getDashboardRequestKey(initialPeriodType, initialFilters)}`
    : null;
  const initialDetailRequestKey = shouldSkipInitialFetch
    ? `0:${getDetailRequestKey({
        filters: initialFilters,
        detailPage: initialSnapshot?.detailPage ?? 1,
        selectedAlertKey: initialSelectedAlertKey,
        periodType: initialPeriodType,
      })}`
    : null;
  const processingReturnMarkerRef = useRef<string | null>(null);
  const initialDashboardRequestKeyRef = useRef(initialDashboardRequestKey);
  const initialDetailRequestKeyRef = useRef(initialDetailRequestKey);

  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
  const [filters, setFilters] = useState<ProyDashboardFilters>(() => initialFilters);
  const [dashboardData, setDashboardData] = useState<ProyDashboardResponse | null>(
    initialSnapshot?.dashboardData ?? null,
  );
  const [selectorData, setSelectorData] = useState<ProyDashboardSelectorsResponse | null>(
    initialSnapshot?.selectorData ?? null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [detailData, setDetailData] = useState<ProyDashboardDetalleResponse | null>(
    initialSnapshot?.detailData ?? null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(initialSnapshot?.detailPage ?? 1);
  const [showKpis, setShowKpis] = useState(
    pendingReturnMarker?.showKpis ?? getStoredShowKpis,
  );
  const [activeSelectorKey, setActiveSelectorKey] = useState<string | null>(
    initialActiveSelectorKey,
  );
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertKey | null>(
    initialSelectedAlertKey,
  );
  const [proyectoOptions, setProyectoOptions] = useState<SelectOption[]>([
    { value: "todos", label: "Todos" },
  ]);
  const [refreshSeq, setRefreshSeq] = useState(0);

  const dashboardRequestKey = useMemo(
    () => `${refreshSeq}:${getDashboardRequestKey(periodType, filters)}`,
    [filters, periodType, refreshSeq],
  );

  const detailRequestKey = useMemo(
    () =>
      `${refreshSeq}:${getDetailRequestKey({
        filters,
        detailPage,
        selectedAlertKey,
        periodType,
      })}`,
    [detailPage, filters, periodType, refreshSeq, selectedAlertKey],
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
    if (initialDashboardRequestKeyRef.current === dashboardRequestKey) {
      return;
    }
    initialDashboardRequestKeyRef.current = null;
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
    if (initialDetailRequestKeyRef.current === detailRequestKey) {
      return;
    }
    initialDetailRequestKeyRef.current = null;
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
          parseCatalogOptions(projectsResponse.data as DashboardCatalogItem[], (item) =>
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SHOW_KPIS_STORAGE_KEY, String(showKpis));
  }, [showKpis]);

  useEffect(() => {
    saveDashboardSnapshot(returnTo, {
      savedAt: Date.now(),
      periodType,
      filters,
      dashboardData,
      selectorData,
      detailData,
      detailPage,
      activeSelectorKey,
      selectedAlertKey,
    });
  }, [
    activeSelectorKey,
    dashboardData,
    detailData,
    detailPage,
    filters,
    periodType,
    returnTo,
    selectedAlertKey,
    selectorData,
  ]);

  useEffect(() => {
    if (!pendingReturnMarker?.savedAt) return;

    const markerKey = String(pendingReturnMarker.savedAt);
    if (processingReturnMarkerRef.current === markerKey) return;
    processingReturnMarkerRef.current = markerKey;

    let cancelled = false;

    const refreshFromReturn = async () => {
      try {
        setDashboardLoading(true);
        setDetailLoading(true);
        setDetailPage(1);

        const [{ dashboard, selectors }, detail] = await Promise.all([
          fetchDashboardBundle(),
          fetchDetailPage(1),
        ]);
        if (cancelled) return;

        setDashboardData(dashboard);
        setSelectorData(selectors);
        setDetailData(detail);
      } catch (error) {
        console.error("No se pudo sincronizar el dashboard de proyectos al volver", error);
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
          setDetailLoading(false);
          processingReturnMarkerRef.current = null;
          clearDashboardReturnMarker(returnTo);
        }
      }
    };

    void refreshFromReturn();

    return () => {
      cancelled = true;
      if (processingReturnMarkerRef.current === markerKey) {
        processingReturnMarkerRef.current = null;
      }
    };
  }, [fetchDashboardBundle, fetchDetailPage, pendingReturnMarker, returnTo]);

  const handleFilterChange = <K extends keyof ProyDashboardFilters>(
    field: K,
    value: ProyDashboardFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    if (field === "estado") {
      setActiveSelectorKey(value === "todos" ? null : String(value));
      setSelectedAlertKey(null);
    }
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
    setActiveSelectorKey(null);
    setFilters((prev) =>
      prev.estado === "todos"
        ? prev
        : {
            ...prev,
            estado: "todos",
          },
    );
    setDetailPage(1);
  };

  const selectEstado = (estado: string) => {
    const nextEstado = activeSelectorKey === estado && !selectedAlertKey ? "todos" : estado;
    setSelectedAlertKey(null);
    setActiveSelectorKey(nextEstado === "todos" ? null : nextEstado);
    setFilters((prev) => ({
      ...prev,
      estado: nextEstado,
    }));
    setDetailPage(1);
  };

  const refreshDashboard = () => {
    setDetailPage(1);
    setRefreshSeq((current) => current + 1);
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
    showKpis,
    activeSelectorKey,
    selectedAlertKey,
    proyectoOptions,
    estadoOptions,
    alertItems,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowKpis,
    refreshDashboard,
    selectAlert,
    selectEstado,
  };
};
