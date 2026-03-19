"use client";

import { useLocation, useNavigate } from "react-router-dom";
import {
  buildKpiCardViewModels,
  formatCurrency,
  formatInteger,
  type PropiedadRankingEntry,
} from "./model";
import { useCrmDashboard } from "./use-crm-dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DashboardAlertChips,
  DashboardKpiStatCard,
  DashboardRankingRow,
  DashboardSectionCard,
  PeriodRangeNavigator,
  ResourceTitle,
} from "@/components/forms/form_order";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Area, ComposedChart, Line, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import {
  ChartNoAxesCombined,
  Download,
  Filter,
  RefreshCcw,
  SlidersHorizontal,
  Target,
  BarChart3,
} from "lucide-react";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatDateValue,
  formatEstadoOportunidad,
} from "../crm-oportunidades/model";

export default function DashboardCrmList() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const {
    periodType,
    filters,
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
    funnelData,
    evolutionData,
    propiedadRanking,
    alertItems,
    activeAlert,
    kpiData,
    totalPages,
    additionalFiltersActiveCount,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setBucketFilter,
    setStageFilter,
    setPropSort,
    setShowAdditionalFilters,
    setShowCharts,
    setOpenSections,
    resetFilters,
    selectAlert,
    selectDetailKpi,
    clearActiveAlert,
    handleExportDetalle,
  } = useCrmDashboard();
  const kpiCards = buildKpiCardViewModels(kpiData);

  return (
    <div className="w-full max-w-6xl space-y-6 p-6">
      <section>
        <Card className="border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 shadow-sm">
          <CardHeader className="space-y-2.5 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <ResourceTitle
                  icon={Target}
                  text="Dashboard CRM"
                  className="text-lg sm:text-[1.75rem]"
                  iconWrapperClassName="h-8 w-8 rounded-xl bg-primary/10 text-primary shadow-none"
                  iconClassName="h-4 w-4"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs text-muted-foreground">
                    Seguimiento comercial, embudo y conversion de oportunidades.
                  </p>
                  {dashboardLoading ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Actualizando metricas...
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                onClick={() => setShowCharts((current) => !current)}
                title={showCharts ? "Ocultar graficos" : "Mostrar graficos"}
                aria-label={showCharts ? "Ocultar graficos" : "Mostrar graficos"}
              >
                {showCharts ? <ChartNoAxesCombined className="h-7 w-7" /> : <BarChart3 className="h-7 w-7" />}
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/95 p-2 sm:p-2.5">
              <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between">
                <div className="w-full space-y-1 lg:w-auto lg:shrink-0">
                  <Label className="flex h-3 items-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    Periodo
                  </Label>
                  <PeriodRangeNavigator
                    value={{ startDate: filters.startDate, endDate: filters.endDate }}
                    periodType={periodType}
                    onChange={applyRange}
                    hideLabel
                    className="w-full lg:w-fit"
                  />
                </div>
                <div className="w-fit max-w-full min-w-0 space-y-1">
                  <Label className="flex h-3 items-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    Tipo de operacion
                  </Label>
                  <div className="flex w-fit max-w-full flex-col gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1.5 text-sm shadow-sm sm:flex-row sm:items-center">
                    <Select
                      value={filters.tipoOperacionId}
                      onValueChange={(value) => handleFilterChange("tipoOperacionId", value)}
                    >
                      <SelectTrigger className="h-8 w-full bg-background sm:w-[220px]">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full gap-1.5 text-[10px] sm:w-auto"
                      onClick={() => setShowAdditionalFilters((current) => !current)}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {showAdditionalFilters ? "Ocultar filtros" : "Mas filtros"}
                      {additionalFiltersActiveCount > 0 ? ` (${additionalFiltersActiveCount})` : ""}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full gap-1.5 text-[10px] sm:w-auto"
                      onClick={resetFilters}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Limpiar
                    </Button>
                  </div>
                </div>
              </div>

              {showAdditionalFilters ? (
                <div className="mt-1.5 border-t border-border/50 pt-1.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-flex h-5 items-center rounded-full border border-border/60 bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Filtros adicionales
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="w-full space-y-1 sm:w-[220px]">
                      <Label className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        Propietario
                      </Label>
                      <Input
                        placeholder="Propietario contiene..."
                        value={filters.propietario}
                        onChange={(event) => handleFilterChange("propietario", event.target.value)}
                        className="h-9 bg-background"
                      />
                    </div>
                    <div className="w-full space-y-1 sm:w-[220px]">
                      <Label className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        Tipos de propiedad
                      </Label>
                      <Input
                        placeholder="Separados por coma"
                        value={filters.tipoPropiedad}
                        onChange={(event) => handleFilterChange("tipoPropiedad", event.target.value)}
                        className="h-9 bg-background"
                      />
                    </div>
                    <div className="w-full space-y-1 sm:w-[220px]">
                      <Label className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        Emprendimiento
                      </Label>
                      <Select
                        value={filters.emprendimientoId}
                        onValueChange={(value) => handleFilterChange("emprendimientoId", value)}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
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
                  </div>
                </div>
              ) : null}
              <DashboardAlertChips
                items={alertItems.map((alert) => ({ ...alert, count: formatInteger(alert.count) }))}
                selectedKey={selectedAlertKey}
                loading={dashboardLoading}
                onSelect={selectAlert}
              />
            </div>
          </CardHeader>
        </Card>
      </section>

      <section className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${dashboardLoading ? "animate-pulse" : ""}`}>
        {kpiCards.map((card) => {
          return (
            <DashboardKpiStatCard
              key={card.key}
              title={card.title}
              icon={card.icon}
              variant={card.variant}
              selected={!selectedAlertKey && detailKpi === card.key}
              cardClassName={card.cardClassName}
              titleDotClassName={card.titleDotClassName}
              metricClassName={card.metricClassName}
              amountClassName={card.amountClassName}
              accentLabelClassName={card.accentLabelClassName}
              panelClassName={card.panelClassName}
              chipClassName={card.chipClassName}
              onSelect={() => selectDetailKpi(card.key)}
              count={card.count}
              amount={card.amount}
              variationLabel={card.variationLabel}
              variationValue={card.variationValue}
              breakdown={card.breakdown}
            />
          );
        })}
      </section>

      {showCharts ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <DashboardSectionCard title="Embudo por etapa" contentClassName="h-[260px]">
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
          </DashboardSectionCard>

          <DashboardSectionCard title="Evolucion mensual" contentClassName="h-[260px]">
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
          </DashboardSectionCard>
        </section>
      ) : null}

      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-4">
        <AccordionItem
          value="detalle"
          className="rounded-xl border border-border/70 bg-card/80 px-2 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
        >
          <div>
            <AccordionTrigger className="rounded-lg px-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-base font-semibold">Detalle de oportunidades</span>
                <span className="text-xs text-muted-foreground">Ver el listado completo filtrado</span>
              </div>
            </AccordionTrigger>
          </div>
          <AccordionContent className="pt-0">
            <Card className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5" /> KPI:
                    </span>
                    {activeAlert ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-foreground">
                        <span>Alerta: {activeAlert.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-[10px]"
                          onClick={clearActiveAlert}
                        >
                          Limpiar
                        </Button>
                      </div>
                    ) : null}
                    <Select value={detailKpi} onValueChange={(value) => selectDetailKpi(value as typeof detailKpi)}>
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendientes">Pendientes</SelectItem>
                        <SelectItem value="nuevas">Nuevas</SelectItem>
                        <SelectItem value="cerradas">Cerradas</SelectItem>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
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
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportDetalle}
                      disabled={detailLoading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[68px] text-[11px] font-semibold">ID</TableHead>
                        <TableHead className="w-[150px] text-[11px] font-semibold">Contacto</TableHead>
                        <TableHead className="w-[240px] text-[11px] font-semibold">Oportunidad</TableHead>
                        <TableHead className="w-[90px] text-[11px] font-semibold">Estado</TableHead>
                        <TableHead className="w-[140px] text-[11px] font-semibold">Propiedad</TableHead>
                        <TableHead className="text-[11px] font-semibold">Responsable</TableHead>
                        <TableHead className="text-[11px] font-semibold">Monto</TableHead>
                        <TableHead className="text-[11px] font-semibold">Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLoading && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-muted-foreground">
                            Cargando detalle...
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading && detailData?.data?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-muted-foreground">
                            No hay oportunidades para mostrar.
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading &&
                        detailData?.data?.map((item) => (
                          <TableRow
                            key={`${item.oportunidad?.id}-${item.fecha_creacion}`}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                            onClick={() => {
                              if (!item.oportunidad?.id) return;
                              navigate(`/crm/oportunidades/${item.oportunidad.id}`, {
                                state: { returnTo },
                              });
                            }}
                          >
                            <TableCell className="w-[68px] text-xs font-medium text-muted-foreground">
                              {item.oportunidad?.id ?? "-"}
                            </TableCell>
                            <TableCell className="w-[150px] max-w-[150px] text-xs text-muted-foreground">
                              <span className="block whitespace-normal break-words leading-tight">
                                {item.oportunidad?.contacto?.nombre_completo ??
                                  item.oportunidad?.contacto?.nombre ??
                                  (item.oportunidad?.contacto_id
                                    ? `Contacto #${item.oportunidad.contacto_id}`
                                    : "Sin contacto")}
                              </span>
                            </TableCell>
                            <TableCell className="w-[240px] max-w-[240px]">
                              <div className="flex flex-col">
                                <span className="whitespace-normal break-words text-xs font-medium leading-tight">
                                  {item.oportunidad?.descripcion_estado ?? `Oportunidad #${item.oportunidad?.id}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="w-[90px] max-w-[90px] text-xs text-muted-foreground">
                              <div className="flex flex-col gap-0.5">
                                <Badge
                                  className={`w-fit text-[10px] font-medium ${
                                    CRM_OPORTUNIDAD_ESTADO_BADGES[
                                      item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES
                                    ] ?? "bg-slate-100 text-slate-800"
                                  }`}
                                >
                                  {formatEstadoOportunidad(
                                    item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES | undefined,
                                  )}
                                </Badge>
                                <span className="text-[9px] leading-none text-muted-foreground">
                                  {formatDateValue(item.oportunidad?.fecha_estado)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="w-[140px] max-w-[140px] text-xs text-muted-foreground">
                              <span className="block whitespace-normal break-words leading-tight">
                                {item.oportunidad?.propiedad?.nombre ?? "Sin propiedad"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <span className="block truncate">
                                {item.oportunidad?.responsable?.nombre_completo ??
                                  item.oportunidad?.responsable?.nombre ??
                                  item.oportunidad?.responsable?.email ??
                                  (item.oportunidad?.responsable_id
                                    ? `Usuario #${item.oportunidad.responsable_id}`
                                    : "Sin responsable")}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{formatCurrency(item.monto)}</TableCell>
                            <TableCell className="text-xs">{item.dias_pipeline}</TableCell>
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

        <AccordionItem
          value="ranking"
          className="rounded-xl border border-border/70 bg-card/80 px-2 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/50"
        >
          <AccordionTrigger className="rounded-lg px-4">
            <div className="flex flex-col items-start gap-1">
              <span className="text-base font-semibold">Ranking de propiedades disponibles</span>
              <span className="text-xs text-muted-foreground">Cantidad de oportunidades perdidas por propiedad disponible</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0">
            <DashboardSectionCard
              actions={
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
              }
              contentClassName="space-y-3"
            >
              {propiedadRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay propiedades disponibles para mostrar.</p>
              ) : (
                propiedadRanking.map((entry) => (
                  <PropiedadRankingRow key={entry.propiedad?.id ?? `${entry.fecha_disponible}-${entry.perdidas}`} entry={entry} />
                ))
              )}
            </DashboardSectionCard>
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
    <DashboardRankingRow
      title={propiedad.nombre ?? `Propiedad #${propiedad.id ?? "s/n"}`}
      subtitle={`Disponible desde ${fechaTexto}`}
      value={formatInteger(entry.perdidas)}
      valueLabel="Perdidas"
    />
  );
};
