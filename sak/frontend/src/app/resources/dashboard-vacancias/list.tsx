"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeriodRangeNavigator, type PeriodRange, type PeriodType } from "@/components/forms/period-range-navigator";
import type { Propiedad } from "../propiedades/model";
import { ESTADOS_PROPIEDAD_OPTIONS } from "../propiedades/model";
import { ResourceContextProvider } from "ra-core";
import { PropiedadActionsMenu } from "../propiedades/list";
import { apiUrl } from "@/lib/dataProvider";
import {
  DashboardKpiCard,
  KpiMetric,
  KpiMetricsRow,
  KpiDetails,
  KpiDetail,
  KpiAlert,
  DashboardRanking,
  RankingItem,
} from "@/components/dashboard";
import {
  type DashboardResponse,
  type DashboardDetalleResponse,
  type CalculatedVacancia,
  type KpiStats,
  DEFAULT_PERIOD,
  buildDefaultFilters,
  formatInteger,
  formatDecimal,
  formatCurrency,
  getVacanciaCost,
  getVacanciaEstadoLabel,
  exportRanking,
  mapDashboardItemToCalculated,
  sortBuckets,
} from "./model";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import VacanciaShow from "./show";

const EMPTY_STATS: KpiStats = { count: 0, propiedades: 0, dias: 0, costo: 0, promedio: 0 };

export default function DashboardVacanciasList() {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_PERIOD);
  const [filters, setFilters] = useState(() => buildDefaultFilters(DEFAULT_PERIOD));
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [detalleData, setDetalleData] = useState<DashboardDetalleResponse | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [longestFilter, setLongestFilter] = useState<
    "todos" | "activas" | "recibida" | "en_reparacion" | "disponible" | "alquilada" | "retirada"
  >("activas");
  const [rankingBucket, setRankingBucket] = useState<string>("todos");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPerPage] = useState(20);
  const [selectedVacancia, setSelectedVacancia] = useState<CalculatedVacancia | null>(null);

  const resetPage = () => setDetailPage(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          limitTop: "5",
        });
        if (filters.estadoPropiedad) params.set("estadoPropiedad", filters.estadoPropiedad);
        if (filters.propietario) params.set("propietario", filters.propietario);
        if (filters.ambientes) params.set("ambientes", filters.ambientes);
        const response = await fetch(`${apiUrl}/api/dashboard/vacancias?${params.toString()}`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const json: DashboardResponse = await response.json();
        if (!cancelled) setDashboardData(json);
      } catch (error) {
        console.error("No se pudo cargar el dashboard de vacancias", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      load();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const loadDetalle = async () => {
      setRankingLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: detailPage.toString(),
          perPage: detailPerPage.toString(),
          orderBy: "dias_totales",
          orderDir: "desc",
        });
        const estadoVacancia = longestFilter === "todos" ? "" : longestFilter;
        if (estadoVacancia) params.set("estadoVacancia", estadoVacancia);
        if (rankingBucket !== "todos") params.set("bucket", rankingBucket);
        if (filters.estadoPropiedad) params.set("estadoPropiedad", filters.estadoPropiedad);
        if (filters.propietario) params.set("propietario", filters.propietario);
        if (filters.ambientes) params.set("ambientes", filters.ambientes);

        const response = await fetch(`${apiUrl}/api/dashboard/vacancias/detalle?${params.toString()}`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const json: DashboardDetalleResponse = await response.json();
        if (!cancelled) setDetalleData(json);
      } catch (error) {
        console.error("No se pudo cargar el detalle de vacancias", error);
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      loadDetalle();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [filters, longestFilter, rankingBucket, detailPage, detailPerPage]);

  const kpiCards = useMemo(() => {
    const cards = dashboardData?.kpi_cards;
    return [
      { id: "totales" as const, title: "Vacancias totales", stats: cards?.totales ?? EMPTY_STATS },
      { id: "activas" as const, title: "Vacancias activas", stats: cards?.activas ?? EMPTY_STATS },
      { id: "disponible" as const, title: "Vacancias disponible", stats: cards?.disponible ?? EMPTY_STATS },
      { id: "reparacion" as const, title: "Vacancias en reparacion", stats: cards?.reparacion ?? EMPTY_STATS },
    ];
  }, [dashboardData]);

  const areaData = useMemo(() => {
    if (!dashboardData?.buckets) return [];
    const sorted = sortBuckets(dashboardData.buckets);
    return sorted.map((bucket) => ({
      month: bucket.bucket,
      dias_totales: bucket.dias_totales,
      dias_reparacion: bucket.dias_reparacion,
      dias_disponible: bucket.dias_disponible,
    }));
  }, [dashboardData]);

  const estadoFinalData = useMemo(() => {
    const buckets = dashboardData?.estados_finales ?? { alquilada: 0, retirada: 0, activo: 0 };
    const activosDetalle = dashboardData?.activos_detalle ?? { disponible: 0, reparacion: 0 };

    return [
      { name: "alquilada", disponible: buckets.alquilada, reparacion: 0, total: buckets.alquilada },
      { name: "retirada", disponible: buckets.retirada, reparacion: 0, total: buckets.retirada },
      {
        name: "activo",
        disponible: activosDetalle.disponible,
        reparacion: activosDetalle.reparacion,
        total: activosDetalle.disponible + activosDetalle.reparacion,
      },
    ];
  }, [dashboardData]);

  const rankingItems = useMemo<CalculatedVacancia[]>(() => {
    if (!detalleData?.data) return [];
    return detalleData.data.map(mapDashboardItemToCalculated);
  }, [detalleData]);

  const bucketOptions = useMemo(() => {
    if (!dashboardData?.buckets) return ["todos"];
    return ["todos", ...sortBuckets(dashboardData.buckets).map((bucket) => bucket.bucket)];
  }, [dashboardData]);

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    resetPage();
  };

  const applyRange = (range: PeriodRange, type: PeriodType) => {
    setFilters((prev) => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    setPeriodType(type);
    resetPage();
  };

  const cardToRankingFilter = (id: "totales" | "disponible" | "reparacion" | "activas") => {
    switch (id) {
      case "totales":
        return "todos" as const;
      case "disponible":
        return "disponible" as const;
      case "reparacion":
        return "en_reparacion" as const;
      case "activas":
      default:
        return "activas" as const;
    }
  };

  const totalPages = Math.max(1, Math.ceil((detalleData?.total ?? 0) / detailPerPage));

  const handleExport = async () => {
    try {
      const collected: CalculatedVacancia[] = [];
      let page = 1;
      // Obtener todas las paginas usando el endpoint paginado
      while (true) {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: page.toString(),
          perPage: "200",
          orderBy: "dias_totales",
          orderDir: "desc",
        });
        const estadoVacancia = longestFilter === "todos" ? "" : longestFilter;
        if (estadoVacancia) params.set("estadoVacancia", estadoVacancia);
        if (rankingBucket !== "todos") params.set("bucket", rankingBucket);
        if (filters.estadoPropiedad) params.set("estadoPropiedad", filters.estadoPropiedad);
        if (filters.propietario) params.set("propietario", filters.propietario);
        if (filters.ambientes) params.set("ambientes", filters.ambientes);

        const response = await fetch(`${apiUrl}/api/dashboard/vacancias/detalle?${params.toString()}`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const json: DashboardDetalleResponse = await response.json();
        collected.push(...json.data.map(mapDashboardItemToCalculated));
        if (collected.length >= json.total || json.data.length === 0) break;
        page += 1;
      }
      exportRanking(collected);
    } catch (error) {
      console.error("No se pudo exportar el ranking de vacancias", error);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <section className="flex flex-wrap gap-2 items-end">
        <PeriodRangeNavigator
          value={{ startDate: filters.startDate, endDate: filters.endDate }}
          periodType={periodType}
          onChange={(range, type) => applyRange(range, type)}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Filtros</Label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
            <Input
              placeholder="Filtrar por propietario"
              value={filters.propietario}
              onChange={(event) => handleFilterChange("propietario", event.target.value)}
              className="h-8 w-[200px]"
            />
            <Input
              placeholder="Ej: 2"
              type="number"
              value={filters.ambientes}
              onChange={(event) => handleFilterChange("ambientes", event.target.value)}
              className="h-8 w-[120px]"
            />
            <Button
              variant="outline"
              className="h-8"
              onClick={() => {
                const resetRange = buildDefaultFilters(DEFAULT_PERIOD);
                setPeriodType(DEFAULT_PERIOD);
                setFilters(resetRange);
                resetPage();
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.id}
            title={card.title}
            stats={card.stats}
            onSelect={() => {
              setLongestFilter(cardToRankingFilter(card.id));
              resetPage();
            }}
            risk={card.accent === "risk"}
          />
        ))}
        <DashboardKpiCard
          title="% retiro"
          onSelect={() => {
            setLongestFilter("retirada");
            resetPage();
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-[32px] font-semibold leading-none whitespace-nowrap">
                  {formatInteger(dashboardData?.estados_finales.retirada ?? 0)}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Retiradas</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[32px] font-semibold leading-none whitespace-nowrap">
                  {formatInteger(dashboardData?.kpis.totalVacancias ?? 0)}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">Vacancias totales</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Ciclos cerrados sin alquilar
                </span>
                <span className="font-semibold whitespace-nowrap">{`${dashboardData?.kpis.porcentajeRetiro ?? 0}%`}</span>
              </div>
            </div>
          </div>
        </DashboardKpiCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolucion mensual</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="dias_totales" name="Dias totales" stroke="#2563eb" fill="#dbeafe" />
                  <Area type="monotone" dataKey="dias_reparacion" name="Dias reparacion" stroke="#f97316" fill="#ffedd5" />
                  <Area type="monotone" dataKey="dias_disponible" name="Dias disponible" stroke="#16a34a" fill="#dcfce7" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Vacancia por estados</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={estadoFinalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="disponible" stackId="a" fill="#6366f1">
                    <LabelList content={(props) => {
                      const { x = 0, y = 0, width = 0, height = 0, value, payload } = props as any;
                      const total = (payload?.disponible ?? 0) + (payload?.reparacion ?? 0);
                      const labelValue = total || value;
                      if (!labelValue) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="#fff"
                          fontSize={12}
                          fontWeight={600}
                          textAnchor="middle"
                        >
                          {labelValue}
                        </text>
                      );
                    }} />
                  </Bar>
                  <Bar dataKey="reparacion" stackId="a" fill="#ef4444">
                    <LabelList content={(props) => {
                      const { x = 0, y = 0, width = 0, height = 0, payload } = props as any;
                      const total = (payload?.disponible ?? 0) + (payload?.reparacion ?? 0);
                      if (!total) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="#fff"
                          fontSize={12}
                          fontWeight={600}
                          textAnchor="middle"
                        >
                          {total}
                        </text>
                      );
                    }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-2">
          <DashboardRanking
            title="Ranking de vacancias"
            items={rankingItems}
            loading={rankingLoading}
            emptyMessage="No hay vacancias para este filtro."
            height="100%"
            maxScrollHeight="540px"
            renderItem={(item) => (
              <VacanciaRankingItem
                key={item.vacancia.id}
                item={item}
                setFilters={setFilters}
                onShowDetails={() => setSelectedVacancia(item)}
              />
            )}
            filters={{
              primary: {
                label: "Vacancia",
                value: longestFilter,
                options: [
                  { value: "todos", label: "Todos" },
                  { value: "activas", label: "Activas" },
                  { value: "recibida", label: "Recibida" },
                  { value: "en_reparacion", label: "En reparacion" },
                  { value: "disponible", label: "Disponible" },
                  { value: "alquilada", label: "Alquilada" },
                  { value: "retirada", label: "Retirada" },
                ],
                onChange: (value) => {
                  setLongestFilter(value as typeof longestFilter);
                  resetPage();
                },
              },
              secondary: {
                label: "Periodo",
                value: rankingBucket,
                options: bucketOptions.map((opt) => ({
                  value: opt,
                  label: opt === "todos" ? "Todos" : opt === "Historico" ? "Historico" : opt,
                })),
                onChange: (value) => {
                  setRankingBucket(value);
                  resetPage();
                },
              },
            }}
            onExport={handleExport}
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Pagina {detailPage} de {totalPages} ({detalleData?.total ?? 0} vacancias)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={detailPage <= 1 || rankingLoading} onClick={() => setDetailPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={detailPage >= totalPages || rankingLoading} onClick={() => setDetailPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </section>

      {selectedVacancia && (
        <VacanciaShow
          vacancia={selectedVacancia}
          onClose={() => setSelectedVacancia(null)}
        />
      )}
    </div>
  );
}

type KpiCardProps = {
  title: string;
  stats: KpiStats;
  onSelect: () => void;
  risk?: boolean;
};

const KpiCard = ({ title, stats, onSelect, risk }: KpiCardProps) => (
  <DashboardKpiCard
    title={title}
    variant={risk ? "danger" : "default"}
    onSelect={onSelect}
    className="min-w-[180px]"
  >
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[26px] font-semibold leading-none whitespace-nowrap">
            {formatInteger(stats.count)}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Vacancias</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[26px] font-semibold leading-none whitespace-nowrap">
            {formatInteger(stats.dias)}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Dias</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px]">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Costo</span>
          <span className="font-semibold whitespace-nowrap text-sm">{formatCurrency(stats.costo)}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Dias promedio</span>
          <span className="font-semibold whitespace-nowrap text-sm">{formatDecimal(stats.promedio)}</span>
        </div>
      </div>
    </div>
  </DashboardKpiCard>
);

const VacanciaRankingItem = ({
  item,
  setFilters,
  onShowDetails,
}: {
  item: CalculatedVacancia;
  setFilters: React.Dispatch<React.SetStateAction<ReturnType<typeof buildDefaultFilters>>>;
  onShowDetails: () => void;
}) => {
  const costo = getVacanciaCost(item.vacancia, item.diasTotales);
  const ambientes = item.vacancia.propiedad?.ambientes;
  const propietario = item.vacancia.propiedad?.propietario ?? "Sin propietario";
  const estadoPropiedad = item.vacancia.propiedad?.estado;
  const estadoInfo = ESTADOS_PROPIEDAD_OPTIONS.find(e => e.value === estadoPropiedad);
  
  const actionRecord: Propiedad = item.vacancia.propiedad ?? {
    id: item.vacancia.propiedad_id,
    estado: "1-recibida",
    nombre: `Propiedad ${item.vacancia.propiedad_id}`,
    tipo: "",
    propietario,
    estado_fecha: "",
  };

  return (
    <RankingItem
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="text-lg font-semibold whitespace-nowrap">{item.diasTotales} dias</div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onShowDetails();
              }}
            >
              Mostrar
            </Button>
            <ResourceContextProvider value="propiedades">
              <PropiedadActionsMenu 
                propiedad={actionRecord} 
                onChanged={() => setFilters((prev) => ({ ...prev }))} // refrescar filtros para re-cargar lista
              />
            </ResourceContextProvider>
          </div>
        </div>
      }
    >
      <div className="space-y-1">
        <p className="font-semibold leading-snug">{item.vacancia.propiedad?.nombre ?? `Propiedad ${item.vacancia.propiedad_id}`}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Ciclo #{item.vacancia.id} - {getVacanciaEstadoLabel(item.estadoCorte)}
          </p>
          {estadoInfo && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoInfo.badgeColor}`}>
              {estadoInfo.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {propietario} - {ambientes ?? "s/amb"} ambientes - Costo: {formatCurrency(costo)}
        </p>
      </div>
    </RankingItem>
  );
};

