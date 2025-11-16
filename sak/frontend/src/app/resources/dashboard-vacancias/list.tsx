"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodRangeNavigator, PeriodRange, PeriodType } from "@/components/forms";
import { cn } from "@/lib/utils";
import type { Propiedad, Vacancia } from "../propiedades/model";
import { ResourceContextProvider } from "ra-core";
import { PropiedadActionsMenu } from "../propiedades/list";
import { apiUrl } from "@/lib/dataProvider";
import { AlertCircle } from "lucide-react";
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
} from "recharts";

type DashboardItem = {
  vacancia: Vacancia;
  dias_totales: number;
  dias_reparacion: number;
  dias_disponible: number;
  estado_corte: "Activo" | "Alquilada" | "Retirada";
  bucket: string;
};

type DashboardResponse = {
  range: { startDate: string; endDate: string };
  kpis: {
    totalVacancias: number;
    promedioDiasTotales: number;
    promedioDiasReparacion: number;
    promedioDiasDisponible: number;
    porcentajeRetiro: number;
  };
  buckets: Array<{
    bucket: string;
    count: number;
    dias_totales: number;
    dias_reparacion: number;
    dias_disponible: number;
  }>;
  estados_finales: { activo: number; alquilada: number; retirada: number };
  top: DashboardItem[];
  items?: DashboardItem[];
};

type CalculatedVacancia = {
  vacancia: Vacancia;
  diasTotales: number;
  diasReparacion: number;
  diasDisponible: number;
  estadoCorte: "Activo" | "Alquilada" | "Retirada";
  bucket: string;
};

const DEFAULT_PERIOD: PeriodType = "anio";

const periodMonths = (period: PeriodType) => {
  switch (period) {
    case "mes":
      return 1;
    case "trimestre":
      return 3;
    case "cuatrimestre":
      return 4;
    case "semestre":
      return 6;
    case "anio":
      return 12;
    default:
      return 3;
  }
};

const buildDefaultFilters = (period: PeriodType = DEFAULT_PERIOD) => {
  const today = new Date();
  const months = periodMonths(period);
  const startReference = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1 - months, 1));
  const start = startReference.toISOString().split("T")[0];
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    .toISOString()
    .split("T")[0];

  return {
    startDate: start,
    endDate: end,
    estadoPropiedad: "",
    propietario: "",
    ambientes: "",
  };
};

export default function DashboardVacanciasList() {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_PERIOD);
  const [filters, setFilters] = useState(() => buildDefaultFilters(DEFAULT_PERIOD));
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [longestFilter, setLongestFilter] = useState<"todos" | "activas" | "retiro" | "reparacion" | "disponible">(
    "activas",
  );
  const [rankingBucket, setRankingBucket] = useState<string>("todos");

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
    load();
    return () => {
      cancelled = true;
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
    () => calculatedVacancias.filter((item) => item.estadoCorte === "Activo"),
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
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [dashboardData]);

  const longestVacancias = useMemo(() => {
    const source = calculatedVacancias;
    const filtered = source.filter((item) => {
      switch (longestFilter) {
        case "todos":
          return true;
        case "activas":
          return item.estadoCorte === "Activo";
        case "retiro":
          return item.estadoCorte === "Retirada";
        case "reparacion":
          return item.vacancia.propiedad?.estado === "2-en_reparacion";
        case "disponible":
          return item.vacancia.propiedad?.estado === "3-disponible";
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
        return "todos";
      case "disponible":
        return "disponible";
      case "reparacion":
        return "reparacion";
      case "activas":
      default:
        return "activas";
    }
  };

  return (
    <div className="p-6 space-y-5">
      <section className="flex flex-wrap gap-4 items-end">
        <PeriodRangeNavigator
          value={{ startDate: filters.startDate, endDate: filters.endDate }}
          periodType={periodType}
          onChange={(range, type) => applyRange(range, type)}
        />
        <div className="flex flex-wrap gap-2 text-sm items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={filters.estadoPropiedad || "all"}
              onValueChange={(value) => handleFilterChange("estadoPropiedad", value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1-recibida">Recibida</SelectItem>
                <SelectItem value="2-en_reparacion">En reparacion</SelectItem>
                <SelectItem value="3-disponible">Disponible</SelectItem>
                <SelectItem value="4-alquilada">Alquilada</SelectItem>
                <SelectItem value="5-retirada">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Propietario</Label>
            <Input
              placeholder="Filtrar por propietario"
              value={filters.propietario}
              onChange={(event) => handleFilterChange("propietario", event.target.value)}
              className="h-8 w-[200px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Ambientes</Label>
            <Input
              placeholder="Ej: 2"
              type="number"
              value={filters.ambientes}
              onChange={(event) => handleFilterChange("ambientes", event.target.value)}
              className="h-8 w-[120px]"
            />
          </div>
          <Button
            variant="outline"
            className="h-8 self-end mt-[18px]"
            onClick={() => {
              const resetRange = buildDefaultFilters(DEFAULT_PERIOD);
              setPeriodType(DEFAULT_PERIOD);
              setFilters(resetRange);
            }}
          >
            Limpiar filtros
          </Button>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% retiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">{`${calculatePorcentajeRetiro(calculatedVacancias)}%`}</div>
            <p className="text-xs text-muted-foreground">Ciclos cerrados sin alquilar</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>EvoluciÃ³n mensual</CardTitle>
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
                  <Bar dataKey="value" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <Card className="h-full">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Ranking de vacancias</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Label htmlFor="longest-filter" className="text-muted-foreground">
                  Vacancia
                </Label>
                <Select
                  value={longestFilter}
                  onValueChange={(value) => setLongestFilter(value as typeof longestFilter)}
                >
                  <SelectTrigger id="longest-filter" className="h-8 w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activas">Activas</SelectItem>
                    <SelectItem value="retiro">Retiro</SelectItem>
                    <SelectItem value="reparacion">Reparacion</SelectItem>
                    <SelectItem value="disponible">Disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="bucket-filter" className="text-muted-foreground">
                  Periodo
                </Label>
                <Select value={rankingBucket} onValueChange={(value) => setRankingBucket(value)}>
                  <SelectTrigger id="bucket-filter" className="h-8 w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bucketOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt === "todos" ? "Todos" : opt === "Historico" ? "Historico" : opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={() => exportRanking(longestVacancias)}>
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[500px]">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : longestVacancias.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay vacancias para este filtro.</p>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {longestVacancias.map((item) => (
                  <RankingItem
                    key={item.vacancia.id}
                    item={item}
                    longestFilter={longestFilter}
                    setFilters={setFilters}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type KpiStats = {
  count: number;
  propiedades: number;
  dias: number;
  costo: number;
  promedio: number;
};

type KpiCardProps = {
  title: string;
  stats: KpiStats;
  onSelect: () => void;
  risk?: boolean;
};

const KpiCard = ({ title, stats, onSelect, risk }: KpiCardProps) => (
  <Card
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    }}
    className={cn(
      "cursor-pointer border-muted bg-card/80 shadow-none transition-colors hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30",
      risk && "border-red-300/60 hover:border-red-400/70",
    )}
  >
    <CardHeader className="pb-1">
      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold">{formatInteger(stats.count)}</div>
          <p className="text-xs text-muted-foreground">Vacancias</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold">{formatInteger(stats.dias)}</div>
          <p className="text-xs text-muted-foreground">Dias</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">Propiedades</span>
        <span className="text-right font-medium text-foreground">{formatInteger(stats.propiedades)}</span>
        <span className="text-muted-foreground">Costo</span>
        <span className="text-right font-medium">{formatCurrency(stats.costo)}</span>
        <span className="text-muted-foreground">Dias promedio</span>
        <span className="text-right font-medium">{formatDecimal(stats.promedio)}</span>
      </div>
      {risk && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>Revisar vacancias activas</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const average = (values: number[]) => {
  if (!values.length) return 0;
  return Math.round((values.reduce((acc, current) => acc + current, 0) / values.length) * 10) / 10;
};

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const formatInteger = (value: number) => integerFormatter.format(Math.round(value));
const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatCurrency = (value: number) => currencyFormatter.format(Math.max(0, Math.round(value)));

const getVacanciaCost = (vacancia: Vacancia, dias: number) => {
  const alquiler = Number(vacancia.propiedad?.valor_alquiler ?? 0);
  const expensas = Number(vacancia.propiedad?.expensas ?? 0);
  const costoDiario = (alquiler + expensas) / 30;
  return dias * costoDiario;
};

const calculateStats = (items: CalculatedVacancia[]): KpiStats => {
  const uniqueProps = new Set<number>();
  let totalDias = 0;
  let totalCosto = 0;

  items.forEach((item) => {
    uniqueProps.add(item.vacancia.propiedad_id);
    totalDias += item.diasTotales;
    totalCosto += getVacanciaCost(item.vacancia, item.diasTotales);
  });

  const propiedades = uniqueProps.size;
  return {
    count: items.length,
    propiedades,
    dias: Math.round(totalDias),
    costo: totalCosto,
    promedio: propiedades ? totalDias / Math.max(propiedades, 1) : 0,
  };
};

const calculatePorcentajeRetiro = (items: CalculatedVacancia[]) => {
  if (items.length === 0) return 0;
  const retiradas = items.filter((item) => item.estadoCorte === "Retirada").length;
  return Math.round((retiradas / items.length) * 1000) / 10;
};

const getVacanciaEstadoLabel = (estado: CalculatedVacancia["estadoCorte"]) => {
  if (estado === "Alquilada") return "Alquilada";
  if (estado === "Retirada") return "Retirada";
  return "Activo";
};

const exportRanking = (items: CalculatedVacancia[]) => {
  if (!items.length) return;
  const header = ["Propiedad", "Estado", "Dias", "Propietario", "Ambientes", "Costo", "Bucket"];
  const rows = items.map((i) => [
    i.vacancia.propiedad?.nombre ?? `Propiedad ${i.vacancia.propiedad_id}`,
    getVacanciaEstadoLabel(i.estadoCorte),
    i.diasTotales,
    i.vacancia.propiedad?.propietario ?? "Sin propietario",
    i.vacancia.propiedad?.ambientes ?? "",
    getVacanciaCost(i.vacancia, i.diasTotales),
    i.bucket,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ranking_vacancias.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const RankingItem = ({
  item,
  longestFilter,
  setFilters,
}: {
  item: CalculatedVacancia;
  longestFilter: "todos" | "activas" | "retiro" | "reparacion" | "disponible";
  setFilters: React.Dispatch<React.SetStateAction<ReturnType<typeof buildDefaultFilters>>>;
}) => {
  const costo = getVacanciaCost(item.vacancia, item.diasTotales);
  const ambientes = item.vacancia.propiedad?.ambientes;
  const propietario = item.vacancia.propiedad?.propietario ?? "Sin propietario";
  const actionRecord: Propiedad = item.vacancia.propiedad ?? {
    id: item.vacancia.propiedad_id,
    estado: "1-recibida",
    nombre: `Propiedad ${item.vacancia.propiedad_id}`,
    tipo: "",
    propietario,
    estado_fecha: "",
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded border px-3 py-2">
      <div className="flex-1 space-y-1">
        <p className="font-semibold leading-snug">{item.vacancia.propiedad?.nombre ?? `Propiedad ${item.vacancia.propiedad_id}`}</p>
        <p className="text-xs text-muted-foreground">
          Ciclo #{item.vacancia.id} - {getVacanciaEstadoLabel(item.estadoCorte)}
        </p>
        <p className="text-xs text-muted-foreground">
          {propietario} - {ambientes ?? "s/amb"} ambientes - Costo: {formatCurrency(costo)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="text-lg font-semibold whitespace-nowrap">{item.diasTotales} dias</div>
        <ResourceContextProvider value="propiedades">
          <PropiedadActionsMenu propiedad={actionRecord} onChanged={() => setFilters((prev) => ({ ...prev }))} />
        </ResourceContextProvider>
      </div>
    </div>
  );
};
