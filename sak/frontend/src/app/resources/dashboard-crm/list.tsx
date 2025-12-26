"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodRangeNavigator, type PeriodRange, type PeriodType } from "@/components/forms/period-range-navigator";
import { apiUrl } from "@/lib/dataProvider";
import {
  buildDefaultFilters,
  DEFAULT_CRM_PERIOD,
  exportDetalleCsv,
  formatCurrency,
  formatInteger,
  formatPercent,
  serializeFiltersToParams,
  type CrmDashboardDetalleItem,
  type CrmDashboardDetalleResponse,
  type CrmDashboardFilters,
  type CrmDashboardResponse,
  type PropiedadRankingEntry,
} from "./model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardKpiCard } from "@/components/dashboard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Area, ComposedChart, Line, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { Download, Filter, RefreshCcw } from "lucide-react";

const DETAIL_PAGE_SIZE = 10;
type KpiKey = "totales" | "nuevas" | "ganadas" | "pendientes";
type SelectOption = { value: string; label: string };

export default function DashboardCrmList() {
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_CRM_PERIOD);
  const [filters, setFilters] = useState<CrmDashboardFilters>(() => buildDefaultFilters(DEFAULT_CRM_PERIOD));
  const [dashboardData, setDashboardData] = useState<CrmDashboardResponse | null>(null);

  const [detailKpi, setDetailKpi] = useState<KpiKey>("totales");
  const [detailData, setDetailData] = useState<CrmDashboardDetalleResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [bucketFilter, setBucketFilter] = useState("todos");
  const [stageFilter, setStageFilter] = useState("todos");
  const [propSort, setPropSort] = useState<"perdidas" | "antiguedad">("perdidas");
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<SelectOption[]>([{ value: "todos", label: "Todos" }]);
  const [emprendimientoOptions, setEmprendimientoOptions] = useState<SelectOption[]>([{ value: "todos", label: "Todos" }]);

  useEffect(() => {
    let cancelled = false;
    const params = serializeFiltersToParams(filters);
    params.set("limitTop", "5");
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
  }, [filters, detailKpi, detailPage, bucketFilter, stageFilter]);

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
        }
      } catch (error) {
        console.error("No se pudieron cargar los filtros", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterChange = <K extends keyof CrmDashboardFilters>(field: K, value: CrmDashboardFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setDetailPage(1);
  };

  const applyRange = (range: PeriodRange, type: PeriodType) => {
    setFilters((prev) => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
    setPeriodType(type);
    setDetailPage(1);
  };

  const bucketOptions = useMemo(() => {
    if (!dashboardData?.evolucion) return ["todos"];
    const buckets = Array.from(new Set(dashboardData.evolucion.map((item) => item.bucket).filter(Boolean)));
    return ["todos", ...buckets];
  }, [dashboardData]);

  const stageOptions = useMemo(() => {
    if (!dashboardData?.funnel) return ["todos"];
    return ["todos", ...dashboardData.funnel.map((item) => item.estado)];
  }, [dashboardData]);

  const funnelData = dashboardData?.funnel ?? [];
  const evolutionData = useMemo(() => {
    if (!dashboardData?.evolucion) return [];
    return dashboardData.evolucion.map((bucket) => ({
      bucket: bucket.bucket || "Sin datos",
      totales: Number(bucket.totales) || 0,
      nuevas: Number(bucket.nuevas) || 0,
      ganadas: Number(bucket.ganadas) || 0,
      perdidas: Number(bucket.perdidas) || 0,
      pendientes: Number(bucket.pendientes) || 0,
    }));
  }, [dashboardData]);

  const propiedadRanking = useMemo(() => {
    const list = dashboardData?.ranking_propiedades ?? [];
    const sorted = [...list].sort((a, b) => {
      if (propSort === "perdidas") {
        return b.perdidas - a.perdidas || ((b.fecha_disponible ?? "") < (a.fecha_disponible ?? "") ? -1 : 1);
      }
      const aDate = a.fecha_disponible ? new Date(a.fecha_disponible).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.fecha_disponible ? new Date(b.fecha_disponible).getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
    return sorted.slice(0, 10);
  }, [dashboardData, propSort]);

  const kpiCards: Array<{ key: KpiKey; title: string; description: string }> = [
    { key: "totales", title: "Oportunidades totales", description: "Incluye las cerradas en el periodo y las abiertas al cierre" },
    { key: "nuevas", title: "Nuevas", description: "Ingresaron al estado abierto durante el periodo" },
    { key: "ganadas", title: "Ganadas", description: "Cerradas como ganadas en el periodo" },
    { key: "pendientes", title: "Pendientes", description: "Activas al cierre del periodo" },
  ];

  const kpiData: Record<KpiKey, { count: number; amount: number; incremento?: number; conversion?: number }> = dashboardData?.kpis ?? {} as any;
  const totalPages = detailData ? Math.max(1, Math.ceil(detailData.total / DETAIL_PAGE_SIZE)) : 1;

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

  return (
    <div className="space-y-6 p-6">
      <section className="flex flex-wrap items-end gap-3">
        <PeriodRangeNavigator
          value={{ startDate: filters.startDate, endDate: filters.endDate }}
          periodType={periodType}
          onChange={applyRange}
        />
        <div className="flex flex-col gap-2">
          <Label className="text-xs uppercase text-muted-foreground">Filtros rapidos</Label>
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm md:flex-row md:flex-wrap md:items-end">
            <Input
              placeholder="Propietario contiene..."
              value={filters.propietario}
              onChange={(event) => handleFilterChange("propietario", event.target.value)}
              className="h-9 w-[220px]"
            />
            <Input
              placeholder="Tipos de propiedad (coma)"
              value={filters.tipoPropiedad}
              onChange={(event) => handleFilterChange("tipoPropiedad", event.target.value)}
              className="h-9 w-[220px]"
            />
            <div className="flex flex-col gap-1">
              <Label className="text-xs uppercase text-muted-foreground">Tipo de operacion</Label>
              <Select
                value={filters.tipoOperacionId}
                onValueChange={(value) => handleFilterChange("tipoOperacionId", value)}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipoOperacionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs uppercase text-muted-foreground">Emprendimiento</Label>
              <Select
                value={filters.emprendimientoId}
                onValueChange={(value) => handleFilterChange("emprendimientoId", value)}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emprendimientoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters(buildDefaultFilters(periodType));
                setDetailPage(1);
                setBucketFilter("todos");
                setStageFilter("todos");
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const kpi = kpiData[card.key] ?? { count: 0, amount: 0 };
          const variation = card.key === "ganadas" ? kpi.conversion : kpi.incremento;
          return (
            <DashboardKpiCard
              key={card.key}
              title={card.title}
              onSelect={() => {
                setDetailKpi(card.key);
                setDetailPage(1);
              }}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-[30px] font-semibold leading-none">{formatInteger(kpi.count ?? 0)}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cantidad</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[30px] font-semibold leading-none">{formatCurrency(kpi.amount ?? 0)}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Monto</p>
                  </div>
                </div>
                {variation !== undefined && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{card.key === "ganadas" ? "Conversion" : "Incremento"}</span>
                    <span className="font-semibold text-foreground">{formatPercent(variation)}%</span>
                  </div>
                )}
              </div>
            </DashboardKpiCard>
          );
        })}
      </section>

      {dashboardData?.stats && (dashboardData.stats.sinMonto > 0 || dashboardData.stats.sinPropiedad > 0) && (
        <Alert variant="destructive" className="bg-amber-50">
          <AlertTitle>Registros con informacion incompleta</AlertTitle>
          <AlertDescription>
            {dashboardData.stats.sinMonto > 0 && (
              <span className="mr-4 text-sm">Sin monto estimado: {dashboardData.stats.sinMonto}</span>
            )}
            {dashboardData.stats.sinPropiedad > 0 && (
              <span className="text-sm">Sin propiedad vinculada: {dashboardData.stats.sinPropiedad}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Embudo por etapa</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#2563eb" name="Cantidad">
                  <LabelList dataKey="count" position="insideTop" style={{ fill: "white", fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolucion mensual</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totales"
                  name="Totales"
                  stroke="#1d4ed8"
                  fill="#bfdbfe"
                  fillOpacity={0.5}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="nuevas"
                  name="Nuevas"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Bar dataKey="ganadas" name="Ganadas" fill="#f97316" barSize={12} />
                <Bar dataKey="perdidas" name="Perdidas" fill="#ef4444" barSize={12} />
                <Bar dataKey="pendientes" name="Pendientes" fill="#10b981" barSize={12} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Accordion type="multiple" defaultValue={[]} className="space-y-4">
        <AccordionItem value="detalle">
          <div className="relative">
            <AccordionTrigger className="rounded-md bg-card px-4 pr-28">
              <div className="flex flex-col items-start gap-1">
                <span className="text-base font-semibold">Detalle de oportunidades</span>
                <span className="text-xs text-muted-foreground">Ver el listado completo filtrado</span>
              </div>
            </AccordionTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={(event) => {
                event.stopPropagation()
                handleExportDetalle()
              }}
              disabled={detailLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
          <AccordionContent className="pt-0">
            <Card className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5" /> KPI:
                  </span>
                  <Select value={detailKpi} onValueChange={(value) => { setDetailKpi(value as KpiKey); setDetailPage(1); }}>
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totales">Totales</SelectItem>
                      <SelectItem value="nuevas">Nuevas</SelectItem>
                      <SelectItem value="ganadas">Ganadas</SelectItem>
                      <SelectItem value="pendientes">Pendientes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={(value) => { setStageFilter(value); setDetailPage(1); }}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "todos" ? "Todos" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={bucketFilter} onValueChange={(value) => { setBucketFilter(value); setDetailPage(1); }}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {bucketOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "todos" ? "Todos" : option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Oportunidad</TableHead>
                        <TableHead>Propiedad</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLoading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            Cargando detalle...
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading && detailData?.data?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            No hay oportunidades para mostrar.
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading &&
                        detailData?.data?.map((item) => (
                          <TableRow key={`${item.oportunidad?.id}-${item.fecha_creacion}`}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.oportunidad?.descripcion_estado ?? `Oportunidad #${item.oportunidad?.id}`}</span>
                                <span className="text-xs text-muted-foreground">{item.oportunidad?.estado}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.oportunidad?.propiedad?.nombre ?? "Sin propiedad"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.oportunidad?.responsable?.full_name ?? "Sin responsable"}
                            </TableCell>
                            <TableCell className="text-sm font-semibold">{formatCurrency(item.monto)}</TableCell>
                            <TableCell className="text-sm">{item.moneda ?? "-"}</TableCell>
                            <TableCell className="text-sm">{item.dias_pipeline}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Pagina {detailPage} de {totalPages} ({detailData?.total ?? 0} registros)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailPage <= 1 || detailLoading}
                      onClick={() => setDetailPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailPage >= totalPages || detailLoading}
                      onClick={() => setDetailPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ranking">
          <AccordionTrigger className="rounded-md bg-card px-4">
            <div className="flex flex-col items-start gap-1">
              <span className="text-base font-semibold">Ranking de propiedades disponibles</span>
              <span className="text-xs text-muted-foreground">Cantidad de oportunidades perdidas por propiedad disponible</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Ordenar por</span>
                  <Select value={propSort} onValueChange={(value) => setPropSort(value as "perdidas" | "antiguedad")}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perdidas">Perdidas</SelectItem>
                      <SelectItem value="antiguedad">Antiguedad disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {propiedadRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay propiedades disponibles para mostrar.</p>
                ) : (
                  propiedadRanking.map((entry) => (
                    <PropiedadRankingRow key={entry.propiedad?.id ?? `${entry.fecha_disponible}-${entry.perdidas}`} entry={entry} />
                  ))
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

const PropiedadRankingRow = ({ entry }: { entry: PropiedadRankingEntry }) => {
  const propiedad = entry.propiedad ?? {};
  const fecha = entry.fecha_disponible ? new Date(entry.fecha_disponible) : null;
  const fechaTexto = fecha && !isNaN(fecha.getTime()) ? fecha.toLocaleDateString("es-AR") : "Sin fecha";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex flex-col">
        <span className="text-base font-semibold">{propiedad.nombre ?? `Propiedad #${propiedad.id ?? "s/n"}`}</span>
        <span className="text-xs text-muted-foreground">Disponible desde {fechaTexto}</span>
      </div>
      <div className="text-right">
        <p className="text-2xl font-semibold">{formatInteger(entry.perdidas)}</p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Perdidas</p>
      </div>
    </div>
  );
};
