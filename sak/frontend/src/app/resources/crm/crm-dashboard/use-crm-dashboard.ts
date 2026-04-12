"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiUrl, dataProvider } from "@/lib/dataProvider";
import {
  buildAlertItems,
  buildDefaultFilters,
  CRM_DASHBOARD_DETAIL_PAGE_SIZE,
  DEFAULT_CRM_PERIOD,
  findActiveAlert,
  getKpiData,
  type AlertKey,
  type CrmDashboardDetalleItem,
  type CrmDashboardDetalleResponse,
  type CrmDashboardFilters,
  type CrmDashboardResponse,
  type KpiKey,
  type PeriodType,
  type SelectOption,
  serializeFiltersToParams,
} from "./model";
import {
  clearDashboardReturnMarker,
  DASHBOARD_RETURN_TTL_MS,
  loadDashboardReturnMarker,
} from "./return-state";
import {
  type DashboardAlertItemCheckResponse,
  type DashboardCatalogItem,
  type DashboardPatchedRecord,
  buildComparableRecordFromDetailItem,
  buildComparableRecordFromOportunidad,
  evaluateDashboardRefresh,
  fetchJsonWithAuth,
  getDashboardRequestKey,
  getDetailRequestKey,
  getStoredShowKpis,
  SHOW_KPIS_STORAGE_KEY,
  idsMatch,
  isNotFoundError,
  loadDashboardSnapshot,
  saveDashboardSnapshot,
} from "./state-helpers";

const DASHBOARD_SNAPSHOT_TTL_MS = DASHBOARD_RETURN_TTL_MS;

export const useCrmDashboard = () => {
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
  const initialPeriodType = pendingReturnMarker?.periodType ?? initialSnapshot?.periodType ?? DEFAULT_CRM_PERIOD;
  const initialFilters =
    pendingReturnMarker?.filters ??
    initialSnapshot?.filters ??
    buildDefaultFilters(initialPeriodType);
  const hasHydratedSnapshot = Boolean(initialSnapshot);
  const hasHydratedReturnContext = hasHydratedSnapshot || Boolean(pendingReturnMarker?.filters);
  const initialDashboardRequestKey = hasHydratedSnapshot
    ? getDashboardRequestKey(
        initialPeriodType,
        initialFilters,
      )
    : null;
  const initialDetailRequestKey = hasHydratedSnapshot
    ? getDetailRequestKey({
        filters: initialFilters,
        detailKpi: initialSnapshot?.detailKpi ?? "proceso",
        detailPage: initialSnapshot?.detailPage ?? 1,
        selectedAlertKey: initialSnapshot?.selectedAlertKey ?? null,
      })
    : null;
  const processingReturnMarkerRef = useRef<string | null>(null);
  const initialDashboardRequestKeyRef = useRef(initialDashboardRequestKey);
  const initialDetailRequestKeyRef = useRef(initialDetailRequestKey);

  const [periodType, setPeriodType] = useState<PeriodType>(
    initialPeriodType,
  );
  const [filters, setFilters] = useState<CrmDashboardFilters>(
    () => initialFilters,
  );
  const [dashboardData, setDashboardData] = useState<CrmDashboardResponse | null>(
    initialSnapshot?.dashboardData ?? null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [detailKpi, setDetailKpi] = useState<KpiKey>(
    initialSnapshot?.detailKpi ?? "proceso",
  );
  const [detailData, setDetailData] = useState<CrmDashboardDetalleResponse | null>(
    initialSnapshot?.detailData ?? null,
  );
  const detailDataRef = useRef<CrmDashboardDetalleResponse | null>(initialSnapshot?.detailData ?? null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(initialSnapshot?.detailPage ?? 1);
  const [showKpis, setShowKpis] = useState(getStoredShowKpis);
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertKey | null>(
    initialSnapshot?.selectedAlertKey ?? null,
  );
  const [fastSelectorData, setFastSelectorData] = useState<Record<KpiKey, { count: number; amount: number }> | null>(
    () => initialSnapshot?.fastSelectorData ?? null,
  );

  const [previousPeriodData, setPreviousPeriodData] = useState<CrmDashboardResponse | null>(
    initialSnapshot?.previousPeriodData ?? null,
  );
  const [periodTrendData, setPeriodTrendData] = useState<
    Array<{ label: string; total: number; nuevas: number; ganadas: number }>
  >(initialSnapshot?.periodTrendData ?? []);
  const [tipoOperacionInitialized, setTipoOperacionInitialized] = useState(hasHydratedReturnContext);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<SelectOption[]>([{ value: "todos", label: "Todos" }]);
  const dashboardRequestKey = useMemo(
    () => getDashboardRequestKey(periodType, filters),
    [filters, periodType],
  );
  const detailRequestKey = useMemo(
    () =>
      getDetailRequestKey({
        filters,
        detailKpi,
        detailPage,
        selectedAlertKey,
      }),
    [detailKpi, detailPage, filters, selectedAlertKey],
  );

  const fetchSelectors = useCallback(async () => {
    const params = serializeFiltersToParams(filters);
    return fetchJsonWithAuth<Record<KpiKey, { count: number; amount: number }>>(
      `${apiUrl}/api/dashboard/crm/selectors?${params.toString()}`,
    );
  }, [filters]);

  const fetchDashboardBundle = useCallback(async () => {
    const params = serializeFiltersToParams(filters);
    params.set("limitTop", "5");
    params.set("periodType", periodType);
    params.set("trendSteps", "-3,-2,-1,0");
    params.set("previousStep", "-1");
    const bundle = await fetchJsonWithAuth<{
      current: CrmDashboardResponse;
      previous: CrmDashboardResponse;
      trend: Array<{ label: string; total: number; nuevas: number; ganadas: number }>;
    }>(`${apiUrl}/api/dashboard/crm/bundle?${params.toString()}`);
    return { currentData: bundle.current, previousData: bundle.previous, trendData: bundle.trend };
  }, [filters, periodType]);

  const fetchDashboardDetailPage = useCallback(
    async (page: number) => {
      const params = serializeFiltersToParams(filters);
      params.set("kpiKey", detailKpi);
      params.set("page", page.toString());
      params.set("perPage", CRM_DASHBOARD_DETAIL_PAGE_SIZE.toString());
      params.set("orderBy", "estado");
      params.set("orderDir", "asc");
      return fetchJsonWithAuth<CrmDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/crm/detalle?${params.toString()}`,
      );
    },
    [detailKpi, filters],
  );

  const fetchAlertDetailPage = useCallback(
    async (page: number) => {
      if (!selectedAlertKey) {
        return {
          data: [],
          total: 0,
          page,
          perPage: CRM_DASHBOARD_DETAIL_PAGE_SIZE,
        } satisfies CrmDashboardDetalleResponse;
      }
      const params = serializeFiltersToParams(filters);
      params.set("alertKey", selectedAlertKey);
      params.set("page", page.toString());
      params.set("perPage", CRM_DASHBOARD_DETAIL_PAGE_SIZE.toString());
      params.set("orderBy", "estado");
      params.set("orderDir", "asc");
      return fetchJsonWithAuth<CrmDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/crm/detalle-alerta?${params.toString()}`,
      );
    },
    [filters, selectedAlertKey],
  );

  const fetchAlertItemStatus = useCallback(
    async (oportunidadId: string | number, alertKey: AlertKey) =>
      fetchJsonWithAuth<DashboardAlertItemCheckResponse>(
        `${apiUrl}/api/dashboard/crm/alerta-item?id=${encodeURIComponent(String(oportunidadId))}&alertKey=${encodeURIComponent(alertKey)}`,
      ),
    [],
  );

  const fetchDetailPage = useCallback(
    async (page: number) =>
      selectedAlertKey ? fetchAlertDetailPage(page) : fetchDashboardDetailPage(page),
    [fetchAlertDetailPage, fetchDashboardDetailPage, selectedAlertKey],
  );

  const fetchDetailSnapshot = useCallback(async () => {
    if (detailPage <= 1) return fetchDetailPage(1);

    const collected: CrmDashboardDetalleItem[] = [];
    let total = 0;
    let perPage = CRM_DASHBOARD_DETAIL_PAGE_SIZE;

    for (let page = 1; page <= detailPage; page += 1) {
      const response = await fetchDetailPage(page);
      collected.push(...response.data);
      total = response.total;
      perPage = response.perPage;
      if (response.data.length === 0) break;
    }

    return {
      data: collected,
      total,
      page: detailPage,
      perPage,
    };
  }, [detailPage, fetchDetailPage]);

  const patchDetailItem = useCallback((record: DashboardPatchedRecord | undefined) => {
    if (!record?.id) return;
    const parsedMonto = Number(record.monto);
    const nextMonto = Number.isFinite(parsedMonto) ? parsedMonto : null;
    setDetailData((prev) => {
      if (!prev) return prev;
      let updated = false;
      const nextRows = prev.data.map((item) => {
        if (!idsMatch(item.oportunidad?.id, record.id)) return item;
        updated = true;
        const nextOportunidad = {
          ...item.oportunidad,
          ...record,
          contacto:
            record.contacto_id !== undefined
              ? (record.contacto ?? null)
              : item.oportunidad?.contacto,
        };
        return {
          ...item,
          oportunidad: nextOportunidad,
          estado_al_corte: typeof record.estado === "string" ? record.estado : item.estado_al_corte,
          monto: nextMonto ?? item.monto,
          moneda: record?.moneda?.codigo ?? item.moneda,
        };
      });
      return updated ? { ...prev, data: nextRows } : prev;
    });
  }, []);

  const removeDetailItemAndDecrementAlert = useCallback(
    (oportunidadId: string | number, alertKey: AlertKey) => {
      const hadItem =
        detailDataRef.current?.data.some((item) => idsMatch(item.oportunidad?.id, oportunidadId)) ?? false;

      if (!hadItem) return false;

      setDetailData((prev) => {
        if (!prev) return prev;
        const nextRows = prev.data.filter((item) => !idsMatch(item.oportunidad?.id, oportunidadId));
        if (nextRows.length === prev.data.length) return prev;
        return {
          ...prev,
          data: nextRows,
          total: Math.max(0, prev.total - 1),
        };
      });

      setDashboardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: {
            ...prev.alerts,
            [alertKey]: Math.max(0, (prev.alerts?.[alertKey] ?? 0) - 1),
          },
        };
      });

      return true;
    },
    [],
  );

  useEffect(() => {
    detailDataRef.current = detailData;
  }, [detailData]);

  useEffect(() => {
    if (initialDashboardRequestKeyRef.current === dashboardRequestKey) {
      return;
    }
    initialDashboardRequestKeyRef.current = null;
    let cancelled = false;

    // Fetch selector counts immediately (fast query, no logs)
    fetchSelectors()
      .then((data) => { if (!cancelled) setFastSelectorData(data); })
      .catch(() => { /* non-critical, full bundle will populate selectors */ });

    setDashboardLoading(true);
    fetchDashboardBundle()
      .then(({ currentData, previousData, trendData }) => {
        if (cancelled) return;
        setDashboardData(currentData);
        setPreviousPeriodData(previousData);
        setPeriodTrendData(trendData);
      })
      .catch((error) => console.error("No se pudo cargar el dashboard CRM", error))
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
          const seen = new Set(
            prev.data.map((item) => `${item.oportunidad?.id ?? "x"}-${item.fecha_creacion}`),
          );
          const nextRows = data.data.filter(
            (item) => !seen.has(`${item.oportunidad?.id ?? "x"}-${item.fecha_creacion}`),
          );
          return {
            ...data,
            data: [...prev.data, ...nextRows],
          };
        });
      })
      .catch((error) => console.error("No se pudo cargar el detalle CRM", error))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailPage, detailRequestKey, fetchDetailPage]);

  useEffect(() => {
    let cancelled = false;
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
    const load = async () => {
      try {
        const tiposJson = await fetchJsonWithAuth<unknown>(
          `${apiUrl}/crm/catalogos/tipos-operacion?perPage=100`,
        );
        if (!cancelled) {
          const catalogItems = parseCatalogList(tiposJson);
          const tipoOptions = catalogItems.map((item) => ({
            value: String(item.id),
            label: item.nombre ?? `Tipo ${item.id}`,
          }));
          setTipoOperacionOptions([{ value: "todos", label: "Todos" }, ...tipoOptions]);
          if (!tipoOperacionInitialized) {
            const alquilerOption = catalogItems.find((item) => {
              const codigo = String(item.codigo ?? "").toLowerCase();
              const nombre = String(item.nombre ?? "").toLowerCase();
              return codigo === "alquiler" || nombre === "alquiler";
            });
            if (alquilerOption && (filters.tipoOperacionId === "todos" || !filters.tipoOperacionId)) {
              setFilters((prev) => ({ ...prev, tipoOperacionId: String(alquilerOption.id) }));
            }
            setTipoOperacionInitialized(true);
          }
        }
      } catch (error) {
        console.error("No se pudieron cargar los filtros", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.tipoOperacionId, tipoOperacionInitialized]);

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
      previousPeriodData,
      periodTrendData,
      detailKpi,
      detailData,
      detailPage,
      selectedAlertKey,
      fastSelectorData,
    });
  }, [
    returnTo,
    periodType,
    filters,
    dashboardData,
    previousPeriodData,
    periodTrendData,
    detailKpi,
    detailData,
    detailPage,
    selectedAlertKey,
    fastSelectorData,
  ]);

  const fetchDetailSnapshotRef = useRef(fetchDetailSnapshot);
  fetchDetailSnapshotRef.current = fetchDetailSnapshot;

  useEffect(() => {
    if (!pendingReturnMarker?.savedAt) return;

    const markerKey = `${pendingReturnMarker.savedAt}:${pendingReturnMarker.oportunidadId ?? ""}:${pendingReturnMarker.refreshAll ? "all" : "partial"}`;
    if (processingReturnMarkerRef.current === markerKey) return;
    processingReturnMarkerRef.current = markerKey;

    let cancelled = false;

    const syncDashboardFromReturn = async () => {
      try {
        if (pendingReturnMarker.refreshAll || pendingReturnMarker.deleted || !hasHydratedSnapshot) {
          setDashboardLoading(true);
          setDetailLoading(true);
          setDetailPage(1);
          await Promise.all([
            fetchDashboardBundle().then((dashboardBundle) => {
              if (cancelled) return;
              setDashboardData(dashboardBundle.currentData);
              setPreviousPeriodData(dashboardBundle.previousData);
              setPeriodTrendData(dashboardBundle.trendData);
            }),
            fetchSelectors().then((data) => { if (!cancelled) setFastSelectorData(data); }).catch(() => {}),
            fetchDetailPage(1).then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]);
          return;
        }

        if (pendingReturnMarker.oportunidadId == null) {
          processingReturnMarkerRef.current = null;
          clearDashboardReturnMarker(returnTo);
          return;
        }

        let currentRecord: DashboardPatchedRecord;
        try {
          const response = await dataProvider.getOne("crm/oportunidades", {
            id: pendingReturnMarker.oportunidadId!,
          });
          if (cancelled) return;
          currentRecord = response.data as DashboardPatchedRecord;
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
          if (cancelled) return;
          setDashboardLoading(true);
          setDetailLoading(true);
          await Promise.all([
            fetchDashboardBundle().then((dashboardBundle) => {
              if (cancelled) return;
              setDashboardData(dashboardBundle.currentData);
              setPreviousPeriodData(dashboardBundle.previousData);
              setPeriodTrendData(dashboardBundle.trendData);
            }),
            fetchSelectors().then((data) => { if (!cancelled) setFastSelectorData(data); }).catch(() => {}),
            fetchDetailSnapshotRef.current().then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]);
          return;
        }

        const previousItem = detailDataRef.current?.data.find(
          (item) => idsMatch(item.oportunidad?.id, pendingReturnMarker.oportunidadId),
        );
        const refreshDecision = evaluateDashboardRefresh(
          buildComparableRecordFromDetailItem(previousItem),
          buildComparableRecordFromOportunidad(currentRecord),
        );
        let removedFromActiveAlert = false;
        if (selectedAlertKey) {
          const alertStatus = await fetchAlertItemStatus(
            pendingReturnMarker.oportunidadId,
            selectedAlertKey,
          );
          if (cancelled) return;
          if (!alertStatus.hasAlert) {
            removedFromActiveAlert = removeDetailItemAndDecrementAlert(
              pendingReturnMarker.oportunidadId,
              selectedAlertKey,
            );
          }
        }
        const shouldRefreshDashboardBundle =
          refreshDecision.refreshSelector || refreshDecision.refreshKpis;
        const shouldRefreshList = refreshDecision.refreshList;
        const shouldRefreshLine =
          refreshDecision.refreshLine && !shouldRefreshList;

        if (!shouldRefreshDashboardBundle && !shouldRefreshList && !shouldRefreshLine && !removedFromActiveAlert) {
          processingReturnMarkerRef.current = null;
          clearDashboardReturnMarker(returnTo);
          return;
        }

        if (shouldRefreshDashboardBundle) {
          setDashboardLoading(true);
        }
        if (shouldRefreshList) {
          setDetailLoading(true);
        }

        const tasks: Promise<void>[] = [];

        if (shouldRefreshDashboardBundle) {
          tasks.push(
            fetchDashboardBundle().then((dashboardBundle) => {
              if (cancelled) return;
              setDashboardData(dashboardBundle.currentData);
              setPreviousPeriodData(dashboardBundle.previousData);
              setPeriodTrendData(dashboardBundle.trendData);
            }),
          );
          tasks.push(
            fetchSelectors().then((data) => { if (!cancelled) setFastSelectorData(data); }).catch(() => {}),
          );
        }

        if (shouldRefreshList) {
          tasks.push(
            fetchDetailSnapshotRef.current().then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          );
        } else if (shouldRefreshLine) {
          patchDetailItem(currentRecord);
        }

        await Promise.all(tasks);
      } catch (error) {
        console.error("No se pudo sincronizar el dashboard CRM al volver desde editar", error);
        if (!cancelled) {
          setDashboardLoading(true);
          setDetailLoading(true);
          await Promise.all([
            fetchDashboardBundle().then((dashboardBundle) => {
              if (cancelled) return;
              setDashboardData(dashboardBundle.currentData);
              setPreviousPeriodData(dashboardBundle.previousData);
              setPeriodTrendData(dashboardBundle.trendData);
            }),
            fetchSelectors().then((data) => { if (!cancelled) setFastSelectorData(data); }).catch(() => {}),
            fetchDetailSnapshotRef.current().then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]).catch((refreshError) => {
            console.error("No se pudo refrescar completo el dashboard CRM", refreshError);
          });
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
          setDetailLoading(false);
          processingReturnMarkerRef.current = null;
          clearDashboardReturnMarker(returnTo);
        }
      }
    };

    void syncDashboardFromReturn();

    return () => {
      cancelled = true;
      if (processingReturnMarkerRef.current === markerKey) {
        processingReturnMarkerRef.current = null;
      }
    };
  }, [
    fetchDashboardBundle,
    fetchAlertItemStatus,
    fetchDetailPage,
    fetchSelectors,
    hasHydratedSnapshot,
    pendingReturnMarker,
    patchDetailItem,
    removeDetailItemAndDecrementAlert,
    returnTo,
    selectedAlertKey,
  ]);

  const handleFilterChange = <K extends keyof CrmDashboardFilters>(field: K, value: CrmDashboardFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setDetailPage(1);
  };

  const applyRange = (range: { startDate: string; endDate: string }, type: PeriodType) => {
    setFilters((prev) => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    setPeriodType(type);
    setDetailPage(1);
  };

  const selectAlert = (key: AlertKey) => {
    setSelectedAlertKey(key);
    setDetailPage(1);
  };

  const selectDetailKpi = (key: KpiKey) => {
    setSelectedAlertKey(null);
    setDetailKpi(key);
    setDetailPage(1);
  };

  const alertItems = useMemo(() => buildAlertItems(dashboardData), [dashboardData]);
  const activeAlert = useMemo(() => findActiveAlert(alertItems, selectedAlertKey), [alertItems, selectedAlertKey]);
  const kpiData = useMemo(() => getKpiData(dashboardData), [dashboardData]);
  const selectorData = fastSelectorData ?? null;
  const totalPages = detailData ? Math.max(1, Math.ceil(detailData.total / CRM_DASHBOARD_DETAIL_PAGE_SIZE)) : 1;
  const hasMoreDetail = detailData ? detailData.data.length < detailData.total : false;

  return {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    previousPeriodData,
    detailKpi,
    detailData,
    detailLoading,
    detailPage,
    showKpis,
    periodTrendData,
    selectedAlertKey,
    tipoOperacionOptions,
    alertItems,
    activeAlert,
    kpiData,
    selectorData,
    totalPages,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailKpi,
    setDetailPage,
    setShowKpis,
    setSelectedAlertKey,
    selectAlert,
    selectDetailKpi,
  };
};
