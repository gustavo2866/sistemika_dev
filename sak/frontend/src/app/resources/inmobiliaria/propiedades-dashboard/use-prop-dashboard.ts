"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiUrl } from "@/lib/dataProvider";
import { excludeMantenimientoTipoOperacion } from "../propiedades/model";
import {
  DEFAULT_PROP_PERIOD,
  PROP_DASHBOARD_DETAIL_PAGE_SIZE,
  buildAlertItems,
  buildDefaultFilters,
  serializeBaseFiltersToParams,
  serializeFiltersToParams,
  type PeriodType,
  type PropDashboardAlertKey,
  type PropDashboardBundleResponse,
  type PropDashboardCurrentData,
  type PropDashboardDetalleResponse,
  type PropDashboardFilters,
  type PropDashboardResponse,
  type PropDashboardSelectorKey,
  type PropDashboardSelectorResponse,
  type SelectOption,
} from "./model";
import {
  DASHBOARD_RETURN_TTL_MS,
  clearDashboardReturnMarker,
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

const DASHBOARD_SNAPSHOT_TTL_MS = DASHBOARD_RETURN_TTL_MS;

const parseCatalogList = (json: unknown): DashboardCatalogItem[] => {
  if (Array.isArray(json)) return json as DashboardCatalogItem[];
  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    Array.isArray((json as { data?: unknown }).data)
  ) {
    return (json as { data: DashboardCatalogItem[] }).data;
  }
  return [];
};

export const usePropDashboard = () => {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const pendingReturnMarker = useMemo(
    () => loadDashboardReturnMarker(returnTo, DASHBOARD_SNAPSHOT_TTL_MS),
    [returnTo],
  );
  const hasPendingReturn = Boolean(pendingReturnMarker);
  const initialSnapshot = useMemo(
    () => loadDashboardSnapshot(returnTo, hasPendingReturn, DASHBOARD_SNAPSHOT_TTL_MS),
    [returnTo, hasPendingReturn],
  );
  const initialPeriodType =
    pendingReturnMarker?.periodType ?? initialSnapshot?.periodType ?? DEFAULT_PROP_PERIOD;
  const initialFilters =
    pendingReturnMarker?.filters ??
    initialSnapshot?.filters ??
    buildDefaultFilters(initialPeriodType);
  const initialActiveSelectorKey =
    pendingReturnMarker?.activeSelectorKey ??
    initialSnapshot?.activeSelectorKey ??
    "disponible";
  const initialActiveSubBucket =
    pendingReturnMarker?.activeSubBucket ?? initialSnapshot?.activeSubBucket ?? null;
  const initialActiveAlertKey =
    pendingReturnMarker?.activeAlertKey ?? initialSnapshot?.activeAlertKey ?? null;
  const shouldSkipInitialFetch = Boolean(initialSnapshot || pendingReturnMarker);
  const shouldApplyDefaultTipoOperacionRef = useRef(
    !pendingReturnMarker && !initialSnapshot,
  );
  const defaultTipoOperacionAppliedRef = useRef(false);
  const initialDashboardRequestKey = shouldSkipInitialFetch
    ? `0:${getDashboardRequestKey(initialPeriodType, initialFilters)}`
    : null;
  const initialDetailRequestKey = shouldSkipInitialFetch
    ? `0:${getDetailRequestKey({
        filters: initialFilters,
        activeSelectorKey: initialActiveSelectorKey,
        activeSubBucket: initialActiveSubBucket,
        detailPage: initialSnapshot?.detailPage ?? 1,
        activeAlertKey: initialActiveAlertKey,
      })}`
    : null;
  const processingReturnMarkerRef = useRef<string | null>(null);
  const initialDashboardRequestKeyRef = useRef(initialDashboardRequestKey);
  const initialDetailRequestKeyRef = useRef(initialDetailRequestKey);

  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
  const [filters, setFilters] = useState<PropDashboardFilters>(() => initialFilters);
  const [dashboardData, setDashboardData] = useState<PropDashboardCurrentData | null>(
    initialSnapshot?.dashboardData ?? null,
  );
  const [previousPeriodData] = useState<PropDashboardResponse | null>(
    initialSnapshot?.previousPeriodData ?? null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [detailData, setDetailData] = useState<PropDashboardDetalleResponse | null>(
    initialSnapshot?.detailData ?? null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(initialSnapshot?.detailPage ?? 1);
  const [activeSelectorKey, setActiveSelectorKey] =
    useState<PropDashboardSelectorKey | null>(initialActiveSelectorKey);
  const [activeSubBucket, setActiveSubBucket] = useState<string | null>(initialActiveSubBucket);
  const [selectedAlertKey, setSelectedAlertKey] =
    useState<PropDashboardAlertKey | null>(initialActiveAlertKey);
  const [fastSelectorData, setFastSelectorData] = useState<PropDashboardSelectorResponse | null>(
    initialSnapshot?.fastSelectorData ?? null,
  );
  const [periodTrendData, setPeriodTrendData] = useState<
    Array<{
      label: string;
      total: number;
      countVacantes: number;
    }>
  >(initialSnapshot?.periodTrendData ?? []);
  const [showKpis, setShowKpis] = useState(getStoredShowKpis);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<SelectOption[]>([
    { value: "todos", label: "Todos" },
  ]);
  const [emprendimientoOptions, setEmprendimientoOptions] = useState<SelectOption[]>([
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
        activeSelectorKey,
        activeSubBucket,
        detailPage,
        activeAlertKey: selectedAlertKey,
      })}`,
    [activeSelectorKey, activeSubBucket, detailPage, filters, refreshSeq, selectedAlertKey],
  );

  const fetchSelectors = useCallback(async () => {
    const params = serializeBaseFiltersToParams(filters);
    return fetchJsonWithAuth<PropDashboardSelectorResponse>(
      `${apiUrl}/api/dashboard/propiedades/selectors?${params.toString()}`,
    );
  }, [filters]);

  const fetchDashboardBundle = useCallback(async () => {
    const params = serializeFiltersToParams(filters);
    params.set("periodType", periodType);
    params.set("trendSteps", "-3,-2,-1,0");
    params.set("previousStep", "-1");
    return fetchJsonWithAuth<PropDashboardBundleResponse>(
      `${apiUrl}/api/dashboard/propiedades/bundle?${params.toString()}`,
    );
  }, [filters, periodType]);

  const fetchDetailPage = useCallback(
    async (page: number) => {
      if (selectedAlertKey) {
        const params = serializeBaseFiltersToParams(filters);
        params.set("alertKey", selectedAlertKey);
        params.set("page", page.toString());
        params.set("pageSize", PROP_DASHBOARD_DETAIL_PAGE_SIZE.toString());
        return fetchJsonWithAuth<PropDashboardDetalleResponse>(
          `${apiUrl}/api/dashboard/propiedades/detalle-alerta?${params.toString()}`,
        );
      }

      if (!activeSelectorKey) {
        return {
          data: [],
          total: 0,
          page,
          perPage: PROP_DASHBOARD_DETAIL_PAGE_SIZE,
        } satisfies PropDashboardDetalleResponse;
      }

      const params = serializeFiltersToParams(filters);
      params.set("selectorKey", activeSelectorKey);
      if (activeSubBucket) params.set("subBucket", activeSubBucket);
      params.set("page", page.toString());
      params.set("pageSize", PROP_DASHBOARD_DETAIL_PAGE_SIZE.toString());
      return fetchJsonWithAuth<PropDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/propiedades/detalle?${params.toString()}`,
      );
    },
    [activeSelectorKey, activeSubBucket, filters, selectedAlertKey],
  );

  useEffect(() => {
    if (initialDashboardRequestKeyRef.current === dashboardRequestKey) {
      return;
    }
    initialDashboardRequestKeyRef.current = null;
    let cancelled = false;

    fetchSelectors()
      .then((data) => {
        if (!cancelled) setFastSelectorData(data);
      })
      .catch(() => {});

    setDashboardLoading(true);
    fetchDashboardBundle()
      .then((bundle) => {
        if (cancelled) return;
        setDashboardData(bundle.current);
        setPeriodTrendData(
          bundle.trend.map((item) => ({
            label: item.bucket,
            total: item.dias_total,
            countVacantes: item.count_vacantes,
          })),
        );
      })
      .catch((error) => console.error("No se pudo cargar el dashboard de propiedades", error))
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardRequestKey, fetchDashboardBundle, fetchSelectors]);

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
          const seen = new Set(prev.data.map((item) => `${item.propiedad_id}-${item.vacancia_fecha ?? "x"}`));
          const nextRows = data.data.filter(
            (item) => !seen.has(`${item.propiedad_id}-${item.vacancia_fecha ?? "x"}`),
          );
          return {
            ...data,
            data: [...prev.data, ...nextRows],
          };
        });
      })
      .catch((error) => console.error("No se pudo cargar el detalle de propiedades", error))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailPage, detailRequestKey, fetchDetailPage]);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      try {
        const [tiposJson, emprendimientosJson] = await Promise.all([
          fetchJsonWithAuth<unknown>(`${apiUrl}/crm/catalogos/tipos-operacion?perPage=100`),
          fetchJsonWithAuth<unknown>(`${apiUrl}/emprendimientos?perPage=100`),
        ]);
        if (cancelled) return;

        const tipoItems = parseCatalogList(tiposJson).filter(excludeMantenimientoTipoOperacion);
        const emprendimientoItems = parseCatalogList(emprendimientosJson);

        const alquiler = tipoItems.find(
          (item) =>
            item?.codigo?.toLowerCase().includes("alquiler") ||
            item?.nombre?.toLowerCase().includes("alquiler") ||
            item?.name?.toLowerCase().includes("alquiler"),
        );
        const alquilerId = alquiler?.id ? String(alquiler.id) : null;

        setTipoOperacionOptions([
          { value: "todos", label: "Todos" },
          ...tipoItems.map((item) => ({
            value: String(item.id),
            label: item.nombre ?? item.name ?? `Tipo ${item.id}`,
          })),
        ]);
        setEmprendimientoOptions([
          { value: "todos", label: "Todos" },
          ...emprendimientoItems.map((item) => ({
            value: String(item.id),
            label: item.nombre ?? item.name ?? `Empr. ${item.id}`,
          })),
        ]);

        if (
          shouldApplyDefaultTipoOperacionRef.current &&
          !defaultTipoOperacionAppliedRef.current &&
          alquilerId &&
          filters.tipoOperacionId === "todos"
        ) {
          defaultTipoOperacionAppliedRef.current = true;
          setFilters((prev) =>
            prev.tipoOperacionId === "todos"
              ? {
                  ...prev,
                  tipoOperacionId: alquilerId,
                }
              : prev,
          );
        }
      } catch (error) {
        console.error("No se pudieron cargar los filtros del dashboard de propiedades", error);
      }
    };

    void loadFilters();

    return () => {
      cancelled = true;
    };
  }, [filters.tipoOperacionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SHOW_KPIS_STORAGE_KEY, String(showKpis));
  }, [showKpis]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDashboardRefresh = () => {
      setDetailPage(1);
      setRefreshSeq((current) => current + 1);
    };

    window.addEventListener("propiedades-dashboard-refresh", handleDashboardRefresh);
    return () => {
      window.removeEventListener("propiedades-dashboard-refresh", handleDashboardRefresh);
    };
  }, []);

  useEffect(() => {
    saveDashboardSnapshot(returnTo, {
      savedAt: Date.now(),
      periodType,
      filters,
      dashboardData,
      previousPeriodData,
      periodTrendData,
      activeSelectorKey,
      activeSubBucket,
      activeAlertKey: selectedAlertKey,
      detailData,
      detailPage,
      fastSelectorData,
    });
  }, [
    returnTo,
    periodType,
    filters,
    dashboardData,
    previousPeriodData,
    periodTrendData,
    activeSelectorKey,
    activeSubBucket,
    selectedAlertKey,
    detailData,
    detailPage,
    fastSelectorData,
  ]);

  useEffect(() => {
    if (!pendingReturnMarker?.savedAt) return;

    const markerKey = `${pendingReturnMarker.savedAt}:${pendingReturnMarker.propiedadId ?? ""}`;
    if (processingReturnMarkerRef.current === markerKey) return;
    processingReturnMarkerRef.current = markerKey;

    let cancelled = false;

    const refreshFromReturn = async () => {
      try {
        setDashboardLoading(true);
        setDetailLoading(true);
        setDetailPage(1);

        const [selectors, bundle, detail] = await Promise.all([
          fetchSelectors(),
          fetchDashboardBundle(),
          fetchDetailPage(1),
        ]);
        if (cancelled) return;

        setFastSelectorData(selectors);
        setDashboardData(bundle.current);
        setPeriodTrendData(
          bundle.trend.map((item) => ({
            label: item.bucket,
            total: item.dias_total,
            countVacantes: item.count_vacantes,
          })),
        );
        setDetailData(detail);
      } catch (error) {
        console.error("No se pudo sincronizar el dashboard de propiedades al volver", error);
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
  }, [fetchDashboardBundle, fetchDetailPage, fetchSelectors, pendingReturnMarker, returnTo]);

  const handleFilterChange = <K extends keyof PropDashboardFilters>(
    field: K,
    value: PropDashboardFilters[K],
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setDetailPage(1);
  };

  const applyRange = (range: { startDate: string; endDate: string }, type: PeriodType) => {
    setFilters((prev) => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
    setPeriodType(type);
    setDetailPage(1);
  };

  const selectAlert = (key: PropDashboardAlertKey) => {
    setSelectedAlertKey((current) => (current === key ? null : key));
    setActiveSelectorKey(null);
    setActiveSubBucket(null);
    setDetailPage(1);
  };

  const selectDetailSelector = (key: PropDashboardSelectorKey, subBucket?: string | null) => {
    const nextSubBucket = subBucket ?? null;
    const isSameSelection =
      activeSelectorKey === key &&
      activeSubBucket === nextSubBucket &&
      !selectedAlertKey;
    setSelectedAlertKey(null);
    setDetailPage(1);
    if (isSameSelection) {
      setActiveSelectorKey(null);
      setActiveSubBucket(null);
      return;
    }
    setActiveSelectorKey(key);
    setActiveSubBucket(nextSubBucket);
  };

  const selectorData = fastSelectorData ?? null;
  const alertItems = useMemo(() => buildAlertItems(selectorData), [selectorData]);
  const hasMoreDetail = detailData ? detailData.data.length < detailData.total : false;

  return {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    previousPeriodData,
    detailData,
    detailLoading,
    detailPage,
    selectedAlertKey,
    activeSelectorKey,
    activeSubBucket,
    tipoOperacionOptions,
    emprendimientoOptions,
    alertItems,
    selectorData,
    hasMoreDetail,
    showKpis,
    periodTrendData,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowKpis,
    selectAlert,
    selectDetailSelector,
  };
};
