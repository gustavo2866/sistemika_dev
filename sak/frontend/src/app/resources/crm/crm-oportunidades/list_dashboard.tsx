"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGetList, useListContext } from "ra-core";

import { CRMOportunidadesDashboard } from "./dashboard";

//#region Helpers del dashboard

const TIPO_OPERACION_STORAGE_KEY = "crm-oportunidades:tipo-operacion";

const getEstadoInValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const getDashboardBaseFilter = (filters: Record<string, unknown>) => {
  const nextFilters = { ...filters };
  delete nextFilters.estado;
  delete nextFilters.estado__in;
  return nextFilters;
};

//#endregion Helpers del dashboard

//#region Componente principal

const useList = () => {
  const { filterValues, setFilters } = useListContext<any>();
  const appliedRef = useRef(false);
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const estadoValue =
    typeof filterValues?.estado === "string" ? filterValues.estado : "";
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion?.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);
  const estadoInValues = useMemo(
    () => getEstadoInValues(filterValues?.estado__in),
    [filterValues?.estado__in],
  );
  const dashboardBaseFilter = useMemo(
    () => getDashboardBaseFilter(filterValues),
    [filterValues],
  );

  const isEnProcesoFilter =
    !estadoValue &&
    estadoInValues.length > 0 &&
    ["1-abierta", "2-visita", "3-cotiza"].every((estado) =>
      estadoInValues.includes(estado),
    );
  const isCerradasFilter =
    !estadoValue &&
    estadoInValues.length > 0 &&
    ["5-ganada", "6-perdida"].every((estado) =>
      estadoInValues.includes(estado),
    );

  const { selectedCardId, selectedBucketKey } = useMemo(() => {
    if (isEnProcesoFilter) {
      return { selectedCardId: "en_proceso", selectedBucketKey: undefined };
    }
    if (isCerradasFilter) {
      return { selectedCardId: "cerradas", selectedBucketKey: undefined };
    }

    switch (estadoValue) {
      case "0-prospect":
        return { selectedCardId: "prospect", selectedBucketKey: "prospect" };
      case "1-abierta":
        return { selectedCardId: "en_proceso", selectedBucketKey: "abierta" };
      case "2-visita":
        return { selectedCardId: "en_proceso", selectedBucketKey: "visita" };
      case "3-cotiza":
        return { selectedCardId: "en_proceso", selectedBucketKey: "cotiza" };
      case "4-reserva":
        return { selectedCardId: "reservas", selectedBucketKey: "reserva" };
      case "5-ganada":
        return { selectedCardId: "cerradas", selectedBucketKey: "ganada" };
      case "6-perdida":
        return { selectedCardId: "cerradas", selectedBucketKey: "perdida" };
      default:
        return { selectedCardId: undefined, selectedBucketKey: undefined };
    }
  }, [estadoValue, isCerradasFilter, isEnProcesoFilter]);

  useEffect(() => {
    if (appliedRef.current) return;

    const currentValue = filterValues?.tipo_operacion_id;
    if (currentValue) {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            TIPO_OPERACION_STORAGE_KEY,
            String(currentValue),
          );
        } catch {}
      }
      appliedRef.current = true;
      return;
    }

    const storedValue =
      typeof window !== "undefined"
        ? (() => {
            try {
              return (
                sessionStorage.getItem(TIPO_OPERACION_STORAGE_KEY) ?? undefined
              );
            } catch {
              return undefined;
            }
          })()
        : undefined;
    const defaultValue = storedValue ?? alquilerId;
    if (!defaultValue) return;

    setFilters({ ...filterValues, tipo_operacion_id: defaultValue }, {});
    appliedRef.current = true;
  }, [alquilerId, filterValues, setFilters]);

  useEffect(() => {
    if (!estadoValue || !estadoInValues.length) return;

    const nextFilters = { ...filterValues };
    if ("estado__in" in nextFilters) {
      delete nextFilters.estado__in;
      setFilters(nextFilters, {});
    }
  }, [estadoInValues.length, estadoValue, filterValues, setFilters]);

  const clearEstadoFilter = () => {
    const nextFilters = { ...filterValues };
    delete nextFilters.estado;
    delete nextFilters.estado__in;
    setFilters(nextFilters, {});
  };

  const applyEstadoFilter = (estado: string) => {
    const nextFilters = { ...filterValues, estado };
    delete nextFilters.estado__in;
    setFilters(nextFilters, {});
  };

  const applyEnProcesoFilter = () => {
    const nextFilters = { ...filterValues };
    delete nextFilters.estado;
    nextFilters.estado__in = ["1-abierta", "2-visita", "3-cotiza"];
    setFilters(nextFilters, {});
  };

  const applyCerradasFilter = () => {
    const nextFilters = { ...filterValues };
    delete nextFilters.estado;
    nextFilters.estado__in = ["5-ganada", "6-perdida"];
    setFilters(nextFilters, {});
  };

  const handleCardClick = ({ cardKey }: { cardKey?: string }) => {
    if (!cardKey) {
      clearEstadoFilter();
      return;
    }

    if (cardKey === "prospect") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEstadoFilter("0-prospect");
      return;
    }

    if (cardKey === "reservas") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEstadoFilter("4-reserva");
      return;
    }

    if (cardKey === "en_proceso") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEnProcesoFilter();
      return;
    }

    if (cardKey === "cerradas") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyCerradasFilter();
    }
  };

  const handleBucketClick = ({
    cardKey,
    bucketKey,
  }: {
    cardKey: string;
    bucketKey?: string;
  }) => {
    if (!bucketKey) {
      clearEstadoFilter();
      return;
    }

    if (cardKey === "en_proceso") {
      const estadoMap: Record<string, string> = {
        abierta: "1-abierta",
        visita: "2-visita",
        cotiza: "3-cotiza",
      };
      const estado = estadoMap[bucketKey];
      if (estado) {
        applyEstadoFilter(estado);
      }
      return;
    }

    if (cardKey === "prospect") {
      applyEstadoFilter("0-prospect");
      return;
    }

    if (cardKey === "reservas") {
      applyEstadoFilter("4-reserva");
      return;
    }

    if (cardKey === "cerradas") {
      const estadoMap: Record<string, string> = {
        ganada: "5-ganada",
        perdida: "6-perdida",
      };
      const estado = estadoMap[bucketKey];
      if (estado) {
        applyEstadoFilter(estado);
      }
    }
  };

  return {
    dashboardBaseFilter,
    selectedCardId,
    selectedBucketKey,
    handleCardClick,
    handleBucketClick,
  };
};

export const CRMOportunidadesListDashboard = () => {
  const {
    dashboardBaseFilter,
    selectedCardId,
    selectedBucketKey,
    handleCardClick,
    handleBucketClick,
  } = useList();

  return (
    <CRMOportunidadesDashboard
      baseFilter={dashboardBaseFilter}
      selectedCardId={selectedCardId}
      selectedBucketKey={selectedBucketKey}
      onCardClick={handleCardClick}
      onBucketClick={handleBucketClick}
    />
  );
};

//#endregion Componente principal
