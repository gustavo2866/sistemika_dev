"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";
import {
  buildAlertItems,
  buildBucketOptions,
  buildDefaultFilters,
  buildEvolutionData,
  buildPropiedadRanking,
  buildStageOptions,
  DEFAULT_CRM_PERIOD,
  exportDetalleCsv,
  findActiveAlert,
  getAdditionalFiltersActiveCount,
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

const DETAIL_PAGE_SIZE = 10;

export const useCrmDashboard = () => {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_CRM_PERIOD);
  const [filters, setFilters] = useState<CrmDashboardFilters>(() => buildDefaultFilters(DEFAULT_CRM_PERIOD));
  const [dashboardData, setDashboardData] = useState<CrmDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [detailKpi, setDetailKpi] = useState<KpiKey>("pendientes");
  const [detailData, setDetailData] = useState<CrmDashboardDetalleResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [bucketFilter, setBucketFilter] = useState("todos");
  const [stageFilter, setStageFilter] = useState("todos");
  const [propSort, setPropSort] = useState<"perdidas" | "antiguedad">("perdidas");
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertKey | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [tipoOperacionInitialized, setTipoOperacionInitialized] = useState(false);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<SelectOption[]>([{ value: "todos", label: "Todos" }]);
  const [emprendimientoOptions, setEmprendimientoOptions] = useState<SelectOption[]>([{ value: "todos", label: "Todos" }]);

  useEffect(() => {
    let cancelled = false;
    const params = serializeFiltersToParams(filters);
    params.set("limitTop", "5");
    setDashboardLoading(true);
    const timeout = setTimeout(() => {
      fetch(`${apiUrl}/api/dashboard/crm?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
          return response.json() as Promise<CrmDashboardResponse>;
        })
        .then((data) => {
          if (!cancelled) setDashboardData(data);
        })
        .catch((error) => console.error("No se pudo cargar el dashboard CRM", error))
        .finally(() => {
          if (!cancelled) setDashboardLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    const params = serializeFiltersToParams(filters);
    params.set("kpiKey", detailKpi);
    params.set("page", detailPage.toString());
    params.set("perPage", DETAIL_PAGE_SIZE.toString());
    params.set("orderBy", "monto");
    params.set("orderDir", "desc");
    if (selectedAlertKey) params.set("alertKey", selectedAlertKey);
    if (bucketFilter !== "todos") params.set("bucket", bucketFilter);
    if (stageFilter !== "todos") params.set("stage", stageFilter);

    const timeout = setTimeout(() => {
      fetch(`${apiUrl}/api/dashboard/crm/detalle?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
          return response.json() as Promise<CrmDashboardDetalleResponse>;
        })
        .then((data) => {
          if (!cancelled) setDetailData(data);
        })
        .catch((error) => console.error("No se pudo cargar el detalle CRM", error))
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filters, detailKpi, detailPage, bucketFilter, selectedAlertKey, stageFilter]);

  useEffect(() => {
    let cancelled = false;
    const parseList = (json: any) => {
      if (Array.isArray(json)) return json;
      if (json?.data && Array.isArray(json.data)) return json.data;
      return [];
    };
    const load = async () => {
      try {
        const [tiposRes, emprRes] = await Promise.all([
          fetch(`${apiUrl}/crm/catalogos/tipos-operacion?perPage=100`),
          fetch(`${apiUrl}/emprendimientos?perPage=100`),
        ]);
        if (!tiposRes.ok || !emprRes.ok) throw new Error("Error obteniendo catalogos");
        const [tiposJson, emprJson] = await Promise.all([tiposRes.json(), emprRes.json()]);
        if (!cancelled) {
          const tipoOptions = parseList(tiposJson).map((item: any) => ({
            value: String(item.id),
            label: item.nombre ?? `Tipo ${item.id}`,
          }));
          const emprOptions = parseList(emprJson).map((item: any) => ({
            value: String(item.id),
            label: item.nombre ?? `Emprendimiento ${item.id}`,
          }));
          setTipoOperacionOptions([{ value: "todos", label: "Todos" }, ...tipoOptions]);
          setEmprendimientoOptions([{ value: "todos", label: "Todos" }, ...emprOptions]);
          if (!tipoOperacionInitialized) {
            const alquilerOption = parseList(tiposJson).find((item: any) => {
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

  const openDetailSection = () => {
    setOpenSections((current) => (current.includes("detalle") ? current : [...current, "detalle"]));
  };

  const resetFilters = () => {
    setFilters(buildDefaultFilters(periodType));
    setDetailPage(1);
    setBucketFilter("todos");
    setStageFilter("todos");
  };

  const selectAlert = (key: AlertKey) => {
    setSelectedAlertKey(key);
    setDetailPage(1);
    openDetailSection();
  };

  const selectDetailKpi = (key: KpiKey) => {
    setSelectedAlertKey(null);
    setDetailKpi(key);
    setDetailPage(1);
    openDetailSection();
  };

  const clearActiveAlert = () => {
    setSelectedAlertKey(null);
    setDetailPage(1);
  };

  const handleExportDetalle = async () => {
    if (!detailData) return;
    const params = serializeFiltersToParams(filters);
    params.set("kpiKey", detailKpi);
    if (bucketFilter !== "todos") params.set("bucket", bucketFilter);
    if (stageFilter !== "todos") params.set("stage", stageFilter);
    params.set("perPage", "200");

    const collected: CrmDashboardDetalleItem[] = [];
    let page = 1;
    try {
      while (true) {
        params.set("page", String(page));
        const response = await fetch(`${apiUrl}/api/dashboard/crm/detalle?${params.toString()}`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const json: CrmDashboardDetalleResponse = await response.json();
        collected.push(...json.data);
        if (collected.length >= json.total || json.data.length === 0) break;
        page += 1;
      }
      exportDetalleCsv(collected);
    } catch (error) {
      console.error("No se pudo exportar detalle CRM", error);
    }
  };

  const bucketOptions = useMemo(() => buildBucketOptions(dashboardData), [dashboardData]);
  const stageOptions = useMemo(() => buildStageOptions(dashboardData), [dashboardData]);
  const evolutionData = useMemo(() => buildEvolutionData(dashboardData), [dashboardData]);
  const propiedadRanking = useMemo(() => buildPropiedadRanking(dashboardData, propSort), [dashboardData, propSort]);
  const alertItems = useMemo(() => buildAlertItems(dashboardData), [dashboardData]);
  const activeAlert = useMemo(() => findActiveAlert(alertItems, selectedAlertKey), [alertItems, selectedAlertKey]);
  const kpiData = useMemo(() => getKpiData(dashboardData), [dashboardData]);
  const totalPages = detailData ? Math.max(1, Math.ceil(detailData.total / DETAIL_PAGE_SIZE)) : 1;
  const additionalFiltersActiveCount = useMemo(() => getAdditionalFiltersActiveCount(filters), [filters]);

  return {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    detailKpi,
    detailData,
    detailLoading,
    detailPage,
    bucketFilter,
    stageFilter,
    propSort,
    showAdditionalFilters,
    showCharts,
    selectedAlertKey,
    openSections,
    tipoOperacionOptions,
    emprendimientoOptions,
    bucketOptions,
    stageOptions,
    funnelData: dashboardData?.funnel ?? [],
    evolutionData,
    propiedadRanking,
    alertItems,
    activeAlert,
    kpiData,
    totalPages,
    additionalFiltersActiveCount,
    applyRange,
    handleFilterChange,
    setDetailKpi,
    setDetailPage,
    setBucketFilter,
    setStageFilter,
    setPropSort,
    setShowAdditionalFilters,
    setShowCharts,
    setSelectedAlertKey,
    setOpenSections,
    resetFilters,
    selectAlert,
    selectDetailKpi,
    clearActiveAlert,
    handleExportDetalle,
  };
};
