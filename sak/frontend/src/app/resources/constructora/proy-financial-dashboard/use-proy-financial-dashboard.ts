"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";
import { fetchJsonWithAuth } from "../proy-dashboard/state-helpers";
import {
  buildDefaultFilters,
  DEFAULT_FINANCIAL_PERIOD,
  serializeFiltersToParams,
  type FinancialDashboardFilters,
  type FinancialDashboardResponse,
  type PeriodType,
  type SelectOption,
} from "./model";

const defaultOptions: SelectOption[] = [{ value: "todos", label: "Todos" }];

export const useProyFinancialDashboard = () => {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_FINANCIAL_PERIOD);
  const [filters, setFilters] = useState<FinancialDashboardFilters>(() =>
    buildDefaultFilters(DEFAULT_FINANCIAL_PERIOD),
  );
  const [dashboardData, setDashboardData] = useState<FinancialDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshSeq, setRefreshSeq] = useState(0);

  const requestKey = useMemo(() => {
    const params = serializeFiltersToParams(filters, periodType);
    return `${refreshSeq}:${params.toString()}`;
  }, [filters, periodType, refreshSeq]);

  const fetchDashboard = useCallback(async () => {
    const params = serializeFiltersToParams(filters, periodType);
    return fetchJsonWithAuth<FinancialDashboardResponse>(
      `${apiUrl}/api/dashboard/proyectos-financiero?${params.toString()}`,
    );
  }, [filters, periodType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchDashboard()
      .then((data) => {
        if (!cancelled) setDashboardData(data);
      })
      .catch((error) => console.error("No se pudo cargar el dashboard financiero", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDashboard, requestKey]);

  const proyectoOptions = useMemo<SelectOption[]>(() => {
    const projects = dashboardData?.selectors?.proyectos ?? [];
    return [
      ...defaultOptions,
      ...projects.map((project) => ({
        value: String(project.id),
        label: project.nombre,
      })),
    ];
  }, [dashboardData]);

  const estadoOptions = useMemo<SelectOption[]>(() => {
    const estados = dashboardData?.selectors?.estados ?? [];
    return [
      ...defaultOptions,
      ...estados.map((estado) => ({
        value: estado.value,
        label: `${estado.label} (${estado.total})`,
      })),
    ];
  }, [dashboardData]);

  const applyRange = (range: { startDate: string; endDate: string }, type: PeriodType) => {
    const normalizedType = type === "cuatrimestre" ? "trimestre" : type;
    setPeriodType(normalizedType);
    setFilters((current) => ({
      ...current,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
  };

  const handleFilterChange = <K extends keyof FinancialDashboardFilters>(
    field: K,
    value: FinancialDashboardFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const refreshDashboard = () => setRefreshSeq((current) => current + 1);

  return {
    periodType,
    filters,
    dashboardData,
    loading,
    proyectoOptions,
    estadoOptions,
    applyRange,
    handleFilterChange,
    refreshDashboard,
  };
};
