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
  type CalculatedVacancia,
  type KpiStats,
  DEFAULT_PERIOD,
  buildDefaultFilters,
  formatInteger,
  formatDecimal,
  formatCurrency,
  getVacanciaCost,
  calculateStats,
  calculatePorcentajeRetiro,
  getVacanciaEstadoLabel,
  exportRanking,
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

export default function DashboardVacanciasList() {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_PERIOD);
  const [filters, setFilters] = useState(() => buildDefaultFilters(DEFAULT_PERIOD));
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [longestFilter, setLongestFilter] = useState<
    "todos" | "activas" | "recibida" | "en_reparacion" | "disponible" | "alquilada" | "retirada"
  >("activas");
  const [rankingBucket, setRankingBucket] = useState<string>("todos");
  const [selectedVacancia, setSelectedVacancia] = useState<CalculatedVacancia | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          limitTop: "5",
          includeItems: "true",
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
    
    // Debounce: esperar 300ms antes de hacer el fetch
    const timeoutId = setTimeout(() => {
      load();
    }, 300);
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [filters]);

  const calculatedVacancias = useMemo<CalculatedVacancia[]>(() => {
    if (!dashboardData?.items) return [];
    return dashboardData.items.map((item) => ({
      vacancia: item.vacancia,
      diasTotales: item.dias_totales,
      diasReparacion: item.dias_reparacion,
      diasDisponible: item.dias_disponible,
      estadoCorte: item.estado_corte,
      bucket: item.bucket,
    }));
  }, [dashboardData]);

  const subsetActivas = useMemo(
    () =>
      calculatedVacancias.filter(
        (item) =>
          item.estadoCorte === "Activo" &&
          item.vacancia.propiedad?.estado !== "4-alquilada" &&
          item.vacancia.propiedad?.estado !== "5-retirada"
      ),
    [calculatedVacancias],
  );
  const subsetDisponible = useMemo(
    () => calculatedVacancias.filter((item) => item.vacancia.propiedad?.estado === "3-disponible"),
    [calculatedVacancias],
  );
  const subsetReparacion = useMemo(
    () => calculatedVacancias.filter((item) => item.vacancia.propiedad?.estado === "2-en_reparacion"),
    [calculatedVacancias],
  );
  const subsetRetiradas = useMemo(
    () => calculatedVacancias.filter((item) => item.estadoCorte === "Retirada"),
    [calculatedVacancias],
  );

  const kpiCards = [
    { id: "totales" as const, title: "Vacancias totales", items: calculatedVacancias },
    { id: "disponible" as const, title: "Vacancias disponible", items: subsetDisponible },
    { id: "reparacion" as const, title: "Vacancias en reparacion", items: subsetReparacion },
    { id: "activas" as const, title: "Vacancias activas", items: subsetActivas, accent: "risk" as const },
  ].map((card) => ({
    ...card,
    stats: calculateStats(card.items),
  }));

  const areaData = useMemo(() => {
    if (!dashboardData?.buckets) return [];
    const sorted = [...dashboardData.buckets].sort((a, b) => {
      if (a.bucket === "Historico") return -1;
      if (b.bucket === "Historico") return 1;
      return a.bucket.localeCompare(b.bucket);
    });
    return sorted.map((bucket) => ({
      month: bucket.bucket,
      dias_totales: bucket.dias_totales,
      dias_reparacion: bucket.dias_reparacion,
      dias_disponible: bucket.dias_disponible,
    }));
  }, [dashboardData]);

  const estadoFinalData = useMemo(() => {
    const buckets = dashboardData?.estados_finales ?? { alquilada: 0, retirada: 0, activo: 0 };
    
    // Calcular cuántas vacancias activas están en reparación vs disponibles
    const activasEnReparacion = calculatedVacancias.filter(
      item => item.estadoCorte === "Activo" && item.vacancia.propiedad?.estado === "2-en_reparacion"
    ).length;
    
    const activasDisponibles = buckets.activo - activasEnReparacion;
    
    return [
      { 
        name: "alquilada", 
        value: buckets.alquilada,
        disponible: 0,
        reparacion: 0
      },
      { 
        name: "retirada", 
        value: buckets.retirada,
        disponible: 0,
        reparacion: 0
      },
      { 
        name: "activo", 
        value: 0,
        disponible: activasDisponibles,
        reparacion: activasEnReparacion
      },
    ];
  }, [dashboardData, calculatedVacancias]);

  const longestVacancias = useMemo(() => {
    const source = calculatedVacancias;
    const filtered = source.filter((item) => {
      switch (longestFilter) {
        case "todos":
          return true;
        case "activas":
          // Filtrar solo vacancias realmente activas (no alquiladas ni retiradas)
          return (
            item.estadoCorte === "Activo" &&
            item.vacancia.propiedad?.estado !== "4-alquilada" &&
            item.vacancia.propiedad?.estado !== "5-retirada"
          );
        case "recibida":
          return item.vacancia.propiedad?.estado === "1-recibida";
        case "en_reparacion":
          return item.vacancia.propiedad?.estado === "2-en_reparacion";
        case "disponible":
          return item.vacancia.propiedad?.estado === "3-disponible";
        case "alquilada":
          return item.vacancia.propiedad?.estado === "4-alquilada";
        case "retirada":
          return item.estadoCorte === "Retirada";
        default:
          return true;
      }
    });
    const filteredByBucket =
      rankingBucket === "todos" ? filtered : filtered.filter((item) => item.bucket === rankingBucket);
    return [...filteredByBucket].sort((a, b) => b.diasTotales - a.diasTotales);
  }, [calculatedVacancias, longestFilter, rankingBucket]);

  const bucketOptions = useMemo(() => {
    const buckets = new Set<string>();
    calculatedVacancias.forEach((item) => buckets.add(item.bucket));
    return [
      "todos",
      ...Array.from(buckets).sort((a, b) => {
        if (a === "Historico") return -1;
        if (b === "Historico") return 1;
        return a.localeCompare(b);
      }),
    ];
  }, [calculatedVacancias]);

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyRange = (range: PeriodRange, type: PeriodType) => {
    setFilters((prev) => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    setPeriodType(type);
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
            onSelect={() => setLongestFilter(cardToRankingFilter(card.id))}
            risk={card.accent === "risk"}
          />
        ))}
        <DashboardKpiCard 
          title="% retiro"
          onSelect={() => setLongestFilter("retirada")}
        >
          <KpiMetricsRow>
            <KpiMetric 
              label="Vacancias" 
              value={formatInteger(subsetRetiradas.length)} 
            />
            <KpiMetric 
              label="Días totales" 
              value={formatInteger(calculateStats(subsetRetiradas).dias)} 
            />
          </KpiMetricsRow>
          <KpiDetails>
            <KpiDetail 
              label="Ciclos cerrados sin alquilar" 
              value={`${calculatePorcentajeRetiro(calculatedVacancias)}%`} 
            />
          </KpiDetails>
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
                  <Bar dataKey="value" fill="#6366f1">
                    <LabelList dataKey="value" position="center" fill="#fff" fontSize={12} />
                  </Bar>
                  <Bar dataKey="disponible" stackId="a" fill="#6366f1">
                    <LabelList dataKey="disponible" position="center" fill="#fff" fontSize={12} />
                  </Bar>
                  <Bar dataKey="reparacion" stackId="a" fill="#ef4444">
                    <LabelList dataKey="reparacion" position="center" fill="#fff" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <DashboardRanking
          title="Ranking de vacancias"
          items={longestVacancias}
          loading={loading}
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
              onChange: (value) => setLongestFilter(value as typeof longestFilter),
            },
            secondary: {
              label: "Periodo",
              value: rankingBucket,
              options: bucketOptions.map((opt) => ({
                value: opt,
                label: opt === "todos" ? "Todos" : opt === "Historico" ? "Historico" : opt,
              })),
              onChange: setRankingBucket,
            },
          }}
          onExport={() => exportRanking(longestVacancias)}
        />
      </section>

      {/* Modal para mostrar detalles de vacancia */}
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
  >
    <KpiMetricsRow>
      <KpiMetric label="Vacancias" value={formatInteger(stats.count)} />
      <KpiMetric label="Dias" value={formatInteger(stats.dias)} />
    </KpiMetricsRow>
    
    <KpiDetails>
      <KpiDetail label="Costo" value={formatCurrency(stats.costo)} />
      <KpiDetail label="Dias promedio" value={formatDecimal(stats.promedio)} />
    </KpiDetails>
    
    {risk && (
      <KpiAlert variant="danger" message="Revisar vacancias activas" />
    )}
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
                onChanged={() => setFilters((prev) => ({ ...prev }))}
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
