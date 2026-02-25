"use client";

import { useEffect, useMemo, useState } from "react";
import { ListBase, useGetList, useListContext } from "ra-core";
import { Home } from "lucide-react";
import { ListView } from "@/components/list";
import { ListPaginator } from "@/components/forms/form_order";
import { PropiedadesDashboard } from "./dashboard";
import { AccionesLista, LIST_FILTERS, PropiedadesListContent } from "./List";

export const PropiedadesPanel = () => (
  <ListBase
    debounce={300}
    perPage={10}
    sort={{ field: "id", order: "DESC" }}
  >
    <PropiedadesPanelContent />
  </ListBase>
);

const PropiedadesPanelContent = () => {
  const { filterValues, setFilters } = useListContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: estados = [] } = useGetList("propiedades-status", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "orden", order: "ASC" },
  });

  const normalizeEstado = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getEstadoKeyFromNombre = (estado: string) => {
    const key = normalizeEstado(estado);
    if (key.includes("recibida")) return "recibida";
    if (key.includes("reparacion")) return "en_reparacion";
    if (key.includes("disponible")) return "disponible";
    if (key.includes("realizada")) return "realizada";
    if (key.includes("retirada")) return "retirada";
    return undefined;
  };

  const estadoMap = useMemo(() => {
    const map = new Map<string, string>();
    estados.forEach((estado: any) => {
      if (!estado?.nombre || estado?.id == null) return;
      map.set(normalizeEstado(String(estado.nombre)), String(estado.id));
    });
    return map;
  }, [estados]);

  const getEstadoId = (estadoKey: string) => {
    const normalizedKey = normalizeEstado(estadoKey);
    for (const [name, id] of estadoMap.entries()) {
      if (name.includes(normalizedKey)) {
        return id;
      }
    }
    return undefined;
  };

  const selectedEstadoKey = useMemo(() => {
    const selectedId = filterValues.propiedad_status_id;
    if (!selectedId) return undefined;
    const estado = estados.find(
      (item: any) => String(item?.id) === String(selectedId),
    );
    if (!estado?.nombre) return undefined;
    return getEstadoKeyFromNombre(String(estado.nombre));
  }, [filterValues.propiedad_status_id, estados]);

  const formatDate = (value: Date) => value.toISOString().slice(0, 10);
  const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const getSelectedBucketKey = () => {
    const today = new Date();
    const plus60 = formatDate(addDays(today, 60));
    const minus30 = formatDate(addDays(today, -30));

    const vencLt = filterValues.vencimiento_contrato__lt;
    const vencGte = filterValues.vencimiento_contrato__gte;
    if (vencLt === plus60 && vencGte === formatDate(today)) return "vencimiento_lt_60";

    const renovLt = filterValues.fecha_renovacion__lt;
    const renovGte = filterValues.fecha_renovacion__gte;
    if (renovLt === plus60 && renovGte === formatDate(today)) return "renovacion_lt_60";

    const estadoGte = filterValues.estado_fecha__gte;
    const estadoLt = filterValues.estado_fecha__lt;
    if (estadoGte === minus30) return "lt_30";
    if (estadoLt === minus30) return "gt_30";

    return undefined;
  };

  const selectedBucketKey = useMemo(() => getSelectedBucketKey(), [filterValues]);

  const clearRangeFilters = (filters: Record<string, any>) => {
    const next = { ...filters };
    [
      "vencimiento_contrato__lt",
      "vencimiento_contrato__lte",
      "vencimiento_contrato__gt",
      "vencimiento_contrato__gte",
      "fecha_renovacion__lt",
      "fecha_renovacion__lte",
      "fecha_renovacion__gt",
      "fecha_renovacion__gte",
      "estado_fecha__lt",
      "estado_fecha__lte",
      "estado_fecha__gt",
      "estado_fecha__gte",
    ].forEach((key) => {
      if (key in next) delete next[key];
    });
    return next;
  };

  const clearEstadoFilter = () => {
    const next = clearRangeFilters({ ...filterValues });
    if ("propiedad_status_id" in next) {
      delete next.propiedad_status_id;
    }
    setFilters(next, {});
  };

  const applyEstadoFilter = (
    estadoKey: string,
    extra: Record<string, any> = {},
  ) => {
    const estadoId = getEstadoId(estadoKey);
    if (!estadoId) return;
    const next = clearRangeFilters({ ...filterValues });
    Object.assign(next, extra);
    next.propiedad_status_id = estadoId;
    setFilters(next, {});
  };

  const handleCardClick = (payload: { estadoKey?: string }) => {
    if (!payload.estadoKey) {
      clearEstadoFilter();
      return;
    }
    if (selectedEstadoKey === payload.estadoKey && !selectedBucketKey) {
      clearEstadoFilter();
      return;
    }
    applyEstadoFilter(payload.estadoKey);
  };

  const handleBucketClick = (payload: {
    estadoKey: string;
    bucketKey?: string;
  }) => {
    if (!payload.bucketKey) {
      clearEstadoFilter();
      return;
    }
    if (
      selectedEstadoKey === payload.estadoKey &&
      selectedBucketKey === payload.bucketKey
    ) {
      clearEstadoFilter();
      return;
    }
    const today = new Date();
    if (payload.estadoKey === "realizada") {
      if (payload.bucketKey === "vencimiento_lt_60") {
        applyEstadoFilter(payload.estadoKey, {
          vencimiento_contrato__gte: formatDate(today),
          vencimiento_contrato__lt: formatDate(addDays(today, 60)),
        });
        return;
      }
      if (payload.bucketKey === "renovacion_lt_60") {
        applyEstadoFilter(payload.estadoKey, {
          fecha_renovacion__gte: formatDate(today),
          fecha_renovacion__lt: formatDate(addDays(today, 60)),
        });
        return;
      }
    }
    if (payload.estadoKey === "retirada") {
      if (payload.bucketKey === "lt_30") {
        applyEstadoFilter(payload.estadoKey, {
          estado_fecha__gte: formatDate(addDays(today, -30)),
        });
        return;
      }
      if (payload.bucketKey === "gt_30") {
        applyEstadoFilter(payload.estadoKey, {
          estado_fecha__lt: formatDate(addDays(today, -30)),
        });
        return;
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener("propiedades-dashboard-refresh", handler);
    return () => {
      window.removeEventListener("propiedades-dashboard-refresh", handler);
    };
  }, []);

  return (
    <>
      <ListView
        title={
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <span>Propiedades Panel</span>
          </div>
        }
        actions={<AccionesLista />}
        filters={LIST_FILTERS}
        topContent={
          <div className="mb-4">
            <PropiedadesDashboard
              tipoOperacionId={String(filterValues.tipo_operacion_id ?? "")}
              onCardClick={handleCardClick}
              onBucketClick={handleBucketClick}
              selectedEstadoKey={selectedEstadoKey}
              selectedBucketKey={selectedBucketKey}
              refreshKey={refreshKey}
            />
          </div>
        }
        containerClassName="max-w-[980px] w-full mr-auto"
        pagination={<ListPaginator />}
      >
        <PropiedadesListContent />
      </ListView>
    </>
  );
};
