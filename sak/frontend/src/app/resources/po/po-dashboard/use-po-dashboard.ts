"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiUrl, dataProvider } from "@/lib/dataProvider";
import {
  buildAlertItems,
  buildDefaultFilters,
  DEFAULT_PO_PERIOD,
  PO_DASHBOARD_DETAIL_PAGE_SIZE,
  getKpiData,
  findActiveAlert,
  serializeFiltersToParams,
  type PoDashboardAlertKey,
  type PoDashboardDetalleItem,
  type PoDashboardDetalleResponse,
  type PoDashboardFilters,
  type PoDashboardKpiKey,
  type PoDashboardResponse,
  type PeriodType,
  type SelectOption,
} from "./model";
import {
  clearDashboardReturnMarker,
  DASHBOARD_RETURN_TTL_MS,
  loadDashboardReturnMarker,
} from "./return-state";
import { TIPO_COMPRA_CHOICES } from "../po-orders/model";
import {
  type DashboardAlertItemCheckResponse,
  type DashboardCatalogItem,
  type DashboardPatchedRecord,
  buildComparableRecordFromDetailItem,
  buildComparableRecordFromOrder,
  evaluateDashboardRefresh,
  fetchJsonWithAuth,
  getDashboardRequestKey,
  getDetailRequestKey,
  getStoredShowKpis,
  idsMatch,
  isNotFoundError,
  loadDashboardSnapshot,
  saveDashboardSnapshot,
  SHOW_KPIS_STORAGE_KEY,
} from "./state-helpers";

const DASHBOARD_SNAPSHOT_TTL_MS = DASHBOARD_RETURN_TTL_MS;

type PoDashboardBundleResponse = {
  current: PoDashboardResponse;
  previous: PoDashboardResponse;
  trend: Array<{ label: string; amount: number; count: number }>;
};

const normalizeVisibleDetailKpi = (
  value: PoDashboardKpiKey | null | undefined,
): PoDashboardKpiKey => (value === "pendientes" ? "solicitadas" : (value ?? "solicitadas"));

export const usePoDashboard = () => {
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
  const hasHydratedSnapshot = Boolean(initialSnapshot);
  const initialDashboardRequestKey = hasHydratedSnapshot
    ? getDashboardRequestKey(
        initialSnapshot?.periodType ?? DEFAULT_PO_PERIOD,
        initialSnapshot?.filters ?? buildDefaultFilters(DEFAULT_PO_PERIOD),
      )
    : null;
  const initialDetailRequestKey = hasHydratedSnapshot
    ? getDetailRequestKey({
        filters: initialSnapshot?.filters ?? buildDefaultFilters(DEFAULT_PO_PERIOD),
        detailKpi: normalizeVisibleDetailKpi(initialSnapshot?.detailKpi),
        detailPage: initialSnapshot?.detailPage ?? 1,
        selectedAlertKey: initialSnapshot?.selectedAlertKey ?? null,
      })
    : null;

  const processingReturnMarkerRef = useRef<string | null>(null);
  const initialDashboardRequestKeyRef = useRef(initialDashboardRequestKey);
  const initialDetailRequestKeyRef = useRef(initialDetailRequestKey);

  const [periodType, setPeriodType] = useState<PeriodType>(
    initialSnapshot?.periodType ?? DEFAULT_PO_PERIOD,
  );
  const [filters, setFilters] = useState<PoDashboardFilters>(
    () => initialSnapshot?.filters ?? buildDefaultFilters(DEFAULT_PO_PERIOD),
  );
  const [dashboardData, setDashboardData] = useState<PoDashboardResponse | null>(
    initialSnapshot?.dashboardData ?? null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [detailKpi, setDetailKpi] = useState<PoDashboardKpiKey>(
    normalizeVisibleDetailKpi(initialSnapshot?.detailKpi),
  );
  const [detailData, setDetailData] = useState<PoDashboardDetalleResponse | null>(
    initialSnapshot?.detailData ?? null,
  );
  const detailDataRef = useRef<PoDashboardDetalleResponse | null>(
    initialSnapshot?.detailData ?? null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(initialSnapshot?.detailPage ?? 1);
  const [showKpis, setShowKpis] = useState(getStoredShowKpis);
  const [selectedAlertKey, setSelectedAlertKey] = useState<PoDashboardAlertKey | null>(
    initialSnapshot?.selectedAlertKey ?? null,
  );
  const [fastSelectorData, setFastSelectorData] = useState<
    Record<PoDashboardKpiKey, { count: number; amount: number }> | null
  >(() => initialSnapshot?.fastSelectorData ?? null);

  const [previousPeriodData, setPreviousPeriodData] = useState<PoDashboardResponse | null>(
    initialSnapshot?.previousPeriodData ?? null,
  );
  const [periodTrendData, setPeriodTrendData] = useState<
    Array<{ label: string; amount: number; count: number }>
  >(initialSnapshot?.periodTrendData ?? []);
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(
    initialSnapshot?.showAdditionalFilters ?? false,
  );

  const [solicitanteOptions, setSolicitanteOptions] = useState<SelectOption[]>(
    initialSnapshot?.solicitanteOptions ?? [{ value: "todos", label: "Todos" }],
  );
  const [proveedorOptions, setProveedorOptions] = useState<SelectOption[]>(
    initialSnapshot?.proveedorOptions ?? [{ value: "todos", label: "Todos" }],
  );
  const [tipoSolicitudOptions, setTipoSolicitudOptions] = useState<SelectOption[]>(
    initialSnapshot?.tipoSolicitudOptions ?? [{ value: "todos", label: "Todos" }],
  );
  const [departamentoOptions, setDepartamentoOptions] = useState<SelectOption[]>(
    initialSnapshot?.departamentoOptions ?? [{ value: "todos", label: "Todos" }],
  );
  const [tipoCompraOptions] = useState<SelectOption[]>(
    initialSnapshot?.tipoCompraOptions ?? [
      { value: "todos", label: "Todos" },
      ...TIPO_COMPRA_CHOICES.map((choice) => ({
        value: choice.id,
        label: choice.name,
      })),
    ],
  );

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
    return fetchJsonWithAuth<Record<PoDashboardKpiKey, { count: number; amount: number }>>(
      `${apiUrl}/api/dashboard/po/selectors?${params.toString()}`,
    );
  }, [filters]);

  const fetchDashboardBundle = useCallback(async () => {
    const params = serializeFiltersToParams(filters);
    params.set("limitTop", "8");
    params.set("periodType", periodType);
    params.set("trendSteps", "-3,-2,-1,0");
    params.set("previousStep", "-1");
    const bundle = await fetchJsonWithAuth<PoDashboardBundleResponse>(
      `${apiUrl}/api/dashboard/po/bundle?${params.toString()}`,
    );
    return {
      currentData: bundle.current,
      previousData: bundle.previous,
      trendData: bundle.trend,
    };
  }, [filters, periodType]);

  const fetchDashboardDetailPage = useCallback(
    async (page: number) => {
      const params = serializeFiltersToParams(filters);
      params.set("kpiKey", detailKpi);
      params.set("page", page.toString());
      params.set("perPage", PO_DASHBOARD_DETAIL_PAGE_SIZE.toString());
      params.set("orderBy", "created_at");
      params.set("orderDir", "desc");
      return fetchJsonWithAuth<PoDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/po/detalle?${params.toString()}`,
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
          perPage: PO_DASHBOARD_DETAIL_PAGE_SIZE,
        } satisfies PoDashboardDetalleResponse;
      }
      const params = serializeFiltersToParams(filters);
      params.set("alertKey", selectedAlertKey);
      params.set("page", page.toString());
      params.set("perPage", PO_DASHBOARD_DETAIL_PAGE_SIZE.toString());
      params.set("orderBy", "created_at");
      params.set("orderDir", "desc");
      return fetchJsonWithAuth<PoDashboardDetalleResponse>(
        `${apiUrl}/api/dashboard/po/detalle-alerta?${params.toString()}`,
      );
    },
    [filters, selectedAlertKey],
  );

  const fetchAlertItemStatus = useCallback(
    async (orderId: string | number, alertKey: PoDashboardAlertKey) => {
      const params = serializeFiltersToParams(filters);
      params.set("id", String(orderId));
      params.set("alertKey", alertKey);
      return fetchJsonWithAuth<DashboardAlertItemCheckResponse>(
        `${apiUrl}/api/dashboard/po/alerta-item?${params.toString()}`,
      );
    },
    [filters],
  );

  const fetchDetailPage = useCallback(
    async (page: number) =>
      selectedAlertKey ? fetchAlertDetailPage(page) : fetchDashboardDetailPage(page),
    [fetchAlertDetailPage, fetchDashboardDetailPage, selectedAlertKey],
  );

  const fetchDetailSnapshot = useCallback(async () => {
    if (detailPage <= 1) return fetchDetailPage(1);

    const collected: PoDashboardDetalleItem[] = [];
    let total = 0;
    let perPage = PO_DASHBOARD_DETAIL_PAGE_SIZE;

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
    const parsedMonto = Number(record.total);
    const nextMonto = Number.isFinite(parsedMonto) ? parsedMonto : null;

    setDetailData((prev) => {
      if (!prev) return prev;
      let updated = false;
      const nextRows = prev.data.map((item) => {
        if (!idsMatch(item.order?.id, record.id)) return item;
        updated = true;
        return {
          ...item,
          order: {
            ...item.order,
            ...record,
          },
          estado:
            typeof record.order_status?.nombre === "string"
              ? record.order_status.nombre
              : item.estado,
          monto: nextMonto ?? item.monto,
          fecha_estado:
            typeof record.updated_at === "string"
              ? record.updated_at
              : item.fecha_estado,
        };
      });
      return updated ? { ...prev, data: nextRows } : prev;
    });
  }, []);

  const removeDetailItemAndDecrementAlert = useCallback(
    (orderId: string | number, alertKey: PoDashboardAlertKey) => {
      const hadItem =
        detailDataRef.current?.data.some((item) => idsMatch(item.order?.id, orderId)) ?? false;
      if (!hadItem) return false;

      setDetailData((prev) => {
        if (!prev) return prev;
        const nextRows = prev.data.filter((item) => !idsMatch(item.order?.id, orderId));
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
    if (initialDashboardRequestKeyRef.current === dashboardRequestKey) return;
    initialDashboardRequestKeyRef.current = null;
    let cancelled = false;

    fetchSelectors()
      .then((data) => {
        if (!cancelled) setFastSelectorData(data);
      })
      .catch(() => {});

    setDashboardLoading(true);
    fetchDashboardBundle()
      .then(({ currentData, previousData, trendData }) => {
        if (cancelled) return;
        setDashboardData(currentData);
        setPreviousPeriodData(previousData);
        setPeriodTrendData(trendData);
      })
      .catch((error) => console.error("No se pudo cargar el dashboard PO", error))
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardRequestKey, fetchDashboardBundle, fetchSelectors]);

  useEffect(() => {
    if (initialDetailRequestKeyRef.current === detailRequestKey) return;
    initialDetailRequestKeyRef.current = null;
    let cancelled = false;
    setDetailLoading(true);

    fetchDetailPage(detailPage)
      .then((data) => {
        if (cancelled) return;
        setDetailData((prev) => {
          if (detailPage <= 1 || !prev) return data;
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
      .catch((error) => console.error("No se pudo cargar el detalle PO", error))
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
        const [usersJson, proveedoresJson, tiposJson, departamentosJson] = await Promise.all([
          fetchJsonWithAuth<unknown>(`${apiUrl}/users?perPage=100`),
          fetchJsonWithAuth<unknown>(`${apiUrl}/proveedores?perPage=100`),
          fetchJsonWithAuth<unknown>(`${apiUrl}/tipos-solicitud?perPage=100`),
          fetchJsonWithAuth<unknown>(`${apiUrl}/departamentos?perPage=100`),
        ]);

        if (cancelled) return;

        setSolicitanteOptions([
          { value: "todos", label: "Todos" },
          ...parseCatalogList(usersJson).map((item) => ({
            value: String(item.id),
            label: item.nombre ?? `Usuario ${item.id}`,
          })),
        ]);

        setProveedorOptions([
          { value: "todos", label: "Todos" },
          ...parseCatalogList(proveedoresJson).map((item) => ({
            value: String(item.id),
            label: item.nombre ?? `Proveedor ${item.id}`,
          })),
        ]);

        setTipoSolicitudOptions([
          { value: "todos", label: "Todos" },
          ...parseCatalogList(tiposJson).map((item) => ({
            value: String(item.id),
            label: item.nombre ?? `Tipo ${item.id}`,
          })),
        ]);

        setDepartamentoOptions([
          { value: "todos", label: "Todos" },
          ...parseCatalogList(departamentosJson).map((item) => ({
            value: String(item.id),
            label: item.nombre ?? `Departamento ${item.id}`,
          })),
        ]);
      } catch (error) {
        console.error("No se pudieron cargar los filtros del dashboard PO", error);
      }
    };

    void load();
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
      previousPeriodData,
      periodTrendData,
      detailKpi,
      detailData,
      detailPage,
      selectedAlertKey,
      fastSelectorData,
      showAdditionalFilters,
      solicitanteOptions,
      proveedorOptions,
      tipoSolicitudOptions,
      departamentoOptions,
      tipoCompraOptions,
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
    showAdditionalFilters,
    solicitanteOptions,
    proveedorOptions,
    tipoSolicitudOptions,
    departamentoOptions,
    tipoCompraOptions,
  ]);

  const fetchDetailSnapshotRef = useRef(fetchDetailSnapshot);
  fetchDetailSnapshotRef.current = fetchDetailSnapshot;

  useEffect(() => {
    if (!pendingReturnMarker?.savedAt) return;

    const markerKey = `${pendingReturnMarker.savedAt}:${pendingReturnMarker.orderId ?? ""}:${pendingReturnMarker.refreshAll ? "all" : "partial"}`;
    if (processingReturnMarkerRef.current === markerKey) return;
    processingReturnMarkerRef.current = markerKey;

    if (!hasHydratedSnapshot) {
      processingReturnMarkerRef.current = null;
      clearDashboardReturnMarker(returnTo);
      return;
    }

    let cancelled = false;

    const syncDashboardFromReturn = async () => {
      try {
        if (pendingReturnMarker.refreshAll || pendingReturnMarker.deleted) {
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
            fetchSelectors()
              .then((data) => {
                if (!cancelled) setFastSelectorData(data);
              })
              .catch(() => {}),
            fetchDetailPage(1).then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]);
          return;
        }

        if (pendingReturnMarker.orderId == null) {
          processingReturnMarkerRef.current = null;
          clearDashboardReturnMarker(returnTo);
          return;
        }

        let currentRecord: DashboardPatchedRecord;
        try {
          const response = await dataProvider.getOne("po-orders", {
            id: pendingReturnMarker.orderId,
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
            fetchSelectors()
              .then((data) => {
                if (!cancelled) setFastSelectorData(data);
              })
              .catch(() => {}),
            fetchDetailSnapshotRef.current().then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]);
          return;
        }

        const previousItem = detailDataRef.current?.data.find((item) =>
          idsMatch(item.order?.id, pendingReturnMarker.orderId),
        );
        const refreshDecision = evaluateDashboardRefresh(
          buildComparableRecordFromDetailItem(previousItem),
          buildComparableRecordFromOrder(currentRecord),
        );

        let removedFromActiveAlert = false;
        if (selectedAlertKey) {
          const alertStatus = await fetchAlertItemStatus(
            pendingReturnMarker.orderId,
            selectedAlertKey,
          );
          if (cancelled) return;
          if (!alertStatus.hasAlert) {
            removedFromActiveAlert = removeDetailItemAndDecrementAlert(
              pendingReturnMarker.orderId,
              selectedAlertKey,
            );
          }
        }

        const shouldRefreshDashboardBundle =
          refreshDecision.refreshSelector || refreshDecision.refreshKpis;
        const shouldRefreshList = refreshDecision.refreshList;
        const shouldRefreshLine = refreshDecision.refreshLine && !shouldRefreshList;

        if (
          !shouldRefreshDashboardBundle &&
          !shouldRefreshList &&
          !shouldRefreshLine &&
          !removedFromActiveAlert
        ) {
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
            fetchSelectors()
              .then((data) => {
                if (!cancelled) setFastSelectorData(data);
              })
              .catch(() => {}),
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
        console.error("No se pudo sincronizar el dashboard PO al volver desde editar", error);
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
            fetchSelectors()
              .then((data) => {
                if (!cancelled) setFastSelectorData(data);
              })
              .catch(() => {}),
            fetchDetailSnapshotRef.current().then((detailSnapshot) => {
              if (cancelled) return;
              setDetailData(detailSnapshot);
              setDetailLoading(false);
            }),
          ]).catch((refreshError) => {
            console.error("No se pudo refrescar completo el dashboard PO", refreshError);
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
    fetchAlertItemStatus,
    fetchDashboardBundle,
    fetchDetailPage,
    fetchSelectors,
    hasHydratedSnapshot,
    patchDetailItem,
    pendingReturnMarker,
    removeDetailItemAndDecrementAlert,
    returnTo,
    selectedAlertKey,
  ]);

  const handleFilterChange = <K extends keyof PoDashboardFilters>(
    field: K,
    value: PoDashboardFilters[K],
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
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
    setDetailPage(1);
  };

  const resetFilters = () => {
    setFilters(buildDefaultFilters(periodType));
    setSelectedAlertKey(null);
    setDetailKpi("solicitadas");
    setDetailPage(1);
    setShowAdditionalFilters(false);
  };

  const selectAlert = (key: PoDashboardAlertKey) => {
    setSelectedAlertKey(key);
    setDetailPage(1);
  };

  const selectDetailKpi = (key: PoDashboardKpiKey) => {
    setSelectedAlertKey(null);
    setDetailKpi(key);
    setDetailPage(1);
  };

  const alertItems = useMemo(() => buildAlertItems(dashboardData), [dashboardData]);
  const activeAlert = useMemo(
    () => findActiveAlert(alertItems, selectedAlertKey),
    [alertItems, selectedAlertKey],
  );
  const kpiData = useMemo(() => getKpiData(dashboardData), [dashboardData]);
  const selectorData = fastSelectorData ?? kpiData ?? null;
  const totalPages = detailData
    ? Math.max(1, Math.ceil(detailData.total / PO_DASHBOARD_DETAIL_PAGE_SIZE))
    : 1;
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
    showAdditionalFilters,
    solicitanteOptions,
    proveedorOptions,
    tipoSolicitudOptions,
    departamentoOptions,
    tipoCompraOptions,
    alertItems,
    activeAlert,
    kpiData,
    selectorData,
    totalPages,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowAdditionalFilters,
    setShowKpis,
    resetFilters,
    selectAlert,
    selectDetailKpi,
  };
};
