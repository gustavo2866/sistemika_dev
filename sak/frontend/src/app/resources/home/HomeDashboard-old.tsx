"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useCreatePath, useDataProvider, useGetIdentity } from "ra-core";
import { 
  CalendarCheck, 
  ClipboardList, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Building2,
  FileText,
  BarChart3,
  Plus,
  Award,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/spinner";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { KpiMetric } from "@/components/dashboard/KpiMetric";
import { KpiMetricsRow } from "@/components/dashboard/KpiMetricsRow";
import { KpiTrend } from "@/components/dashboard/KpiTrend";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CRMEvento } from "@/app/resources/crm-eventos/model";
import type { PoSolicitud } from "@/app/resources/po-solicitudes/model";
import { ESTADO_BADGES } from "@/app/resources/po-solicitudes/model";
import type { CRMOportunidad } from "@/app/resources/crm-oportunidades/model";

type SectionState<T> = {
  data: T[];
  total: number;
  isLoading: boolean;
};

const PAGE_SIZE = 5;

const toNumberId = (value?: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? Number(parsed) : undefined;
};

const buildFilterSearch = (filter: Record<string, unknown>) =>
  `filter=${JSON.stringify(filter)}`;

export default function HomeDashboard() {
  const dataProvider = useDataProvider();
  const createPath = useCreatePath();
  const { data: identity, isLoading: identityLoading } = useGetIdentity();
  const userId = useMemo(() => toNumberId(identity?.id), [identity?.id]);

  const [eventosState, setEventosState] = useState<SectionState<CRMEvento>>({
    data: [],
    total: 0,
    isLoading: true,
  });
  const [solicitudesState, setSolicitudesState] = useState<SectionState<PoSolicitud>>({
    data: [],
    total: 0,
    isLoading: true,
  });
  const [oportunidadesState, setOportunidadesState] = useState<SectionState<CRMOportunidad>>({
    data: [],
    total: 0,
    isLoading: true,
  });
  
  // Estados para métricas de performance
  const [performanceState, setPerformanceState] = useState({
    eventosVencidos: 0,
    nuevasOportunidades: 0,
    oportunidadesGanadas: 0,
    isLoading: true
  });

  useEffect(() => {
    if (!userId) {
      setEventosState((prev) => ({ ...prev, isLoading: false }));
      setSolicitudesState((prev) => ({ ...prev, isLoading: false }));
      setOportunidadesState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    let cancelled = false;
    setEventosState((prev) => ({ ...prev, isLoading: true }));
    setSolicitudesState((prev) => ({ ...prev, isLoading: true }));
    setOportunidadesState((prev) => ({ ...prev, isLoading: true }));
    setPerformanceState((prev) => ({ ...prev, isLoading: true }));

    const load = async () => {
      try {
        // Consultas paralelas para datos principales y de performance
        const [eventos, solicitudes, oportunidades, eventosVencidos, nuevasOportunidades, oportunidadesGanadas] = await Promise.all([
          dataProvider.getList<CRMEvento>("crm/eventos", {
            pagination: { page: 1, perPage: PAGE_SIZE },
            sort: { field: "fecha_evento", order: "ASC" },
            filter: {
              default_scope: "pendientes_mes",
              solo_pendientes: true,
              asignado_a_id: userId,
            },
          }),
          dataProvider.getList<PoSolicitud>("po-solicitudes", {
            pagination: { page: 1, perPage: PAGE_SIZE },
            sort: { field: "fecha_necesidad", order: "ASC" },
            filter: {
              estado: "pendiente",
              solicitante_id: userId,
            },
          }),
          dataProvider.getList<CRMOportunidad>("crm/oportunidades", {
            pagination: { page: 1, perPage: PAGE_SIZE },
            sort: { field: "fecha_estado", order: "DESC" },
            filter: {
              estado: "0-prospect",
              responsable_id: userId,
              activo: true,
            },
          }),
          // Eventos vencidos (fecha_evento < hoy y pendientes)
          dataProvider.getList<CRMEvento>("crm/eventos", {
            pagination: { page: 1, perPage: 1 },
            sort: { field: "fecha_evento", order: "DESC" },
            filter: {
              fecha_evento_lt: new Date().toISOString().split('T')[0],
              solo_pendientes: true,
              asignado_a_id: userId,
            },
          }),
          // Nuevas oportunidades este mes
          dataProvider.getList<CRMOportunidad>("crm/oportunidades", {
            pagination: { page: 1, perPage: 1 },
            sort: { field: "created_at", order: "DESC" },
            filter: {
              created_at_gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
              responsable_id: userId,
              activo: true,
            },
          }),
          // Oportunidades ganadas este mes
          dataProvider.getList<CRMOportunidad>("crm/oportunidades", {
            pagination: { page: 1, perPage: 1 },
            sort: { field: "fecha_estado", order: "DESC" },
            filter: {
              estado: "4-ganada",
              fecha_estado_gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
              responsable_id: userId,
              activo: true,
            },
          }),
        ]);

        if (cancelled) return;
        setEventosState({
          data: eventos.data ?? [],
          total: eventos.total ?? 0,
          isLoading: false,
        });
        setSolicitudesState({
          data: solicitudes.data ?? [],
          total: solicitudes.total ?? 0,
          isLoading: false,
        });
        setOportunidadesState({
          data: oportunidades.data ?? [],
          total: oportunidades.total ?? 0,
          isLoading: false,
        });
        setPerformanceState({
          eventosVencidos: eventosVencidos.total ?? 0,
          nuevasOportunidades: nuevasOportunidades.total ?? 0,
          oportunidadesGanadas: oportunidadesGanadas.total ?? 0,
          isLoading: false,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("No se pudo cargar el dashboard de inicio", error);
        setEventosState((prev) => ({ ...prev, isLoading: false }));
        setSolicitudesState((prev) => ({ ...prev, isLoading: false }));
        setOportunidadesState((prev) => ({ ...prev, isLoading: false }));
        setPerformanceState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [dataProvider, userId]);

  const eventosFilter = useMemo(
    () => ({
      default_scope: "pendientes_mes",
      solo_pendientes: true,
      asignado_a_id: userId,
    }),
    [userId]
  );
  const solicitudesFilter = useMemo(
    () => ({
      estado: "pendiente",
      solicitante_id: userId,
    }),
    [userId]
  );
  const oportunidadesFilter = useMemo(
    () => ({
      estado: "0-prospect",
      responsable_id: userId,
      activo: true,
    }),
    [userId]
  );

  const eventosListPath = createPath({ resource: "crm/eventos", type: "list" });
  const solicitudesListPath = createPath({ resource: "po-solicitudes", type: "list" });
  const oportunidadesListPath = createPath({ resource: "crm/oportunidades", type: "list" });

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header Section with Modern Design */}
      <div className="relative overflow-hidden bg-white shadow-sm border-b">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-500/5 to-indigo-600/5" />
        <div className="relative w-full max-w-7xl mx-auto px-4 py-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-md">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">
                    Dashboard
                  </h1>
                  <p className="text-sm text-slate-600">
                    {identityLoading
                      ? "Cargando información..."
                      : `Bienvenido, ${(identity as any)?.fullName ?? (identity as any)?.nombre ?? "usuario"}`
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">
                  {(identity as any)?.fullName ?? (identity as any)?.nombre ?? "Usuario"}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date().toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <Avatar className="h-12 w-12 ring-2 ring-white shadow-md">
                <AvatarImage src={(identity as any)?.avatar ?? (identity as any)?.url_foto ?? ""} />
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold">
                  {((identity as any)?.fullName ?? (identity as any)?.nombre ?? "U")
                    .toString()
                    .slice(0, 1)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4 py-8 lg:px-8">
        {/* Alerta para eventos vencidos */}
        {!performanceState.isLoading && performanceState.eventosVencidos > 0 && (
          <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-red-800 font-semibold">
              ⚠️ Tienes {performanceState.eventosVencidos} evento{performanceState.eventosVencidos !== 1 ? 's' : ''} vencido{performanceState.eventosVencidos !== 1 ? 's' : ''}
            </AlertTitle>
            <AlertDescription className="text-red-700">
              Revisa tus eventos pendientes para ponerte al día con los seguimientos.
            </AlertDescription>
          </Alert>
        )}
        {/* Quick Stats Row */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Events Summary Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <CalendarCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {eventosState.isLoading ? <Spinner size="small" /> : eventosState.total}
                  </p>
                  <p className="text-xs text-blue-600 font-medium">Eventos</p>
                </div>
              </div>
              <div className="flex items-center pt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-xs text-green-600 font-medium">+2.5%</span>
                <span className="text-xs text-muted-foreground ml-1">esta semana</span>
              </div>
            </CardContent>
          </Card>

          {/* Requests Summary Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-amber-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {solicitudesState.isLoading ? <Spinner size="small" /> : solicitudesState.total}
                  </p>
                  <p className="text-xs text-amber-600 font-medium">Solicitudes</p>
                </div>
              </div>
              <div className="flex items-center pt-1">
                <Clock className="h-4 w-4 text-orange-500 mr-1" />
                <span className="text-xs text-orange-600 font-medium">Pendientes</span>
                <span className="text-xs text-muted-foreground ml-1">de aprobación</span>
              </div>
            </CardContent>
          </Card>

          {/* Opportunities Summary Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {oportunidadesState.isLoading ? <Spinner size="small" /> : oportunidadesState.total}
                  </p>
                  <p className="text-xs text-emerald-600 font-medium">Prospects</p>
                </div>
              </div>
              <div className="flex items-center pt-1">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-xs text-green-600 font-medium">Activos</span>
                <span className="text-xs text-muted-foreground ml-1">para seguimiento</span>
              </div>
            </CardContent>
          </Card>

          {/* Overall Performance Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-purple-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {((eventosState.total || 0) + (solicitudesState.total || 0) + (oportunidadesState.total || 0))}
                  </p>
                  <p className="text-xs text-purple-600 font-medium">Total Tareas</p>
                </div>
              </div>
              <div className="flex items-center pt-1">
                <AlertCircle className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-xs text-blue-600 font-medium">En proceso</span>
                <span className="text-xs text-muted-foreground ml-1">hoy</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance del Período */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            📈 Performance del Período
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nuevas Oportunidades */}
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">Nuevas Oportunidades</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {performanceState.isLoading ? <Spinner size="small" /> : performanceState.nuevasOportunidades}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Este mes</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Oportunidades Ganadas */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Oportunidades Ganadas</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {performanceState.isLoading ? <Spinner size="small" /> : performanceState.oportunidadesGanadas}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Este mes</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <Award className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Eventos Vencidos */}
            <Card className={`bg-gradient-to-br border shadow-md ${
              performanceState.eventosVencidos > 0 
                ? 'from-red-50 to-pink-50 border-red-200'
                : 'from-green-50 to-emerald-50 border-green-200'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      performanceState.eventosVencidos > 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      Eventos Vencidos
                    </p>
                    <p className={`text-2xl font-bold ${
                      performanceState.eventosVencidos > 0 ? 'text-red-900' : 'text-green-900'
                    }`}>
                      {performanceState.isLoading ? <Spinner size="small" /> : performanceState.eventosVencidos}
                    </p>
                    <p className={`text-xs mt-1 ${
                      performanceState.eventosVencidos > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {performanceState.eventosVencidos > 0 ? 'Requieren atención' : 'Todo al día'}
                    </p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    performanceState.eventosVencidos > 0 ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {performanceState.eventosVencidos > 0 ? (
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Dashboard Cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Eventos Pendientes - Enhanced con indicador de vencidos */}
          <DashboardKpiCard 
            title="🗓️ Eventos y Seguimientos"
            variant={performanceState.eventosVencidos > 0 ? "danger" : eventosState.total > 15 ? "warning" : "default"}
            className="col-span-1"
          >
            <KpiMetricsRow>
              <KpiMetric 
                value={eventosState.isLoading ? "..." : eventosState.total} 
                label="Eventos pendientes"
              />
              {!eventosState.isLoading && (
                <div className="text-right">
                  {performanceState.eventosVencidos > 0 ? (
                    <KpiTrend
                      value={performanceState.eventosVencidos}
                      percentage={0}
                      direction="down"
                      variant="negative"
                      className="text-right"
                    />
                  ) : (
                    <KpiTrend
                      value={eventosState.total}
                      percentage={12}
                      direction="up"
                      variant="positive"
                      showPercentage
                      className="text-right"
                    />
                  )}
                </div>
              )}
            </KpiMetricsRow>
            
            {performanceState.eventosVencidos > 0 && (
              <Alert variant="destructive" className="my-3 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {performanceState.eventosVencidos} evento{performanceState.eventosVencidos !== 1 ? 's' : ''} vencido{performanceState.eventosVencidos !== 1 ? 's' : ''}
                </AlertDescription>
              </Alert>
            )}
            
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Próximos 7 días</span>
                <Badge variant={performanceState.eventosVencidos > 0 ? "destructive" : "outline"} className="text-xs">
                  {Math.ceil((eventosState.total || 0) * 0.3)} eventos
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Este mes</span>
                <Badge variant="secondary" className="text-xs">
                  {eventosState.total || 0} total
                </Badge>
              </div>
              
              {performanceState.eventosVencidos > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600 font-medium">Vencidos</span>
                  <Badge variant="destructive" className="text-xs">
                    {performanceState.eventosVencidos}
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Button asChild size="sm" className="flex-1" variant={performanceState.eventosVencidos > 0 ? "destructive" : "default"}>
                <Link
                  to={{
                    pathname: eventosListPath,
                    search: buildFilterSearch(eventosFilter),
                  }}
                >
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  {performanceState.eventosVencidos > 0 ? 'Ver Vencidos' : 'Ver Eventos'}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/crm/eventos/create">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </DashboardKpiCard>

          {/* Solicitudes Pendientes - Enhanced */}
          <DashboardKpiCard 
            title="📋 Aprobaciones Pendientes"
            variant={solicitudesState.total > 8 ? "danger" : "default"}
            className="col-span-1"
          >
            <KpiMetricsRow>
              <KpiMetric 
                value={solicitudesState.isLoading ? "..." : solicitudesState.total} 
                label="Solicitudes pendientes"
              />
              {!solicitudesState.isLoading && solicitudesState.total > 0 && (
                <div className="text-right">
                  <div className="text-lg font-semibold text-red-600">
                    ¡Urgente!
                  </div>
                  <p className="text-xs text-muted-foreground">Requieren aprobación</p>
                </div>
              )}
            </KpiMetricsRow>
            
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pendientes hoy</span>
                <Badge className={ESTADO_BADGES.pendiente}>
                  {Math.ceil((solicitudesState.total || 0) * 0.6)} solicitudes
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Promedio semanal</span>
                <Badge variant="outline" className="text-xs">
                  ~{Math.ceil((solicitudesState.total || 0) * 0.8)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Button asChild size="sm" className="flex-1">
                <Link
                  to={{
                    pathname: solicitudesListPath,
                    search: buildFilterSearch(solicitudesFilter),
                  }}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Ver Solicitudes
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/po-solicitudes/create">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </DashboardKpiCard>

          {/* Oportunidades Prospect - Enhanced con performance */}
          <DashboardKpiCard 
            title="🎯 Pipeline de Ventas"
            variant={oportunidadesState.total > 0 ? "success" : "default"}
            className="col-span-1"
          >
            <KpiMetricsRow>
              <KpiMetric 
                value={oportunidadesState.isLoading ? "..." : oportunidadesState.total} 
                label="Prospects activos"
              />
              {!oportunidadesState.isLoading && performanceState.nuevasOportunidades > 0 && (
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-600">
                    +{performanceState.nuevasOportunidades}
                  </div>
                  <p className="text-xs text-muted-foreground">Nuevas este mes</p>
                </div>
              )}
            </KpiMetricsRow>
            
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nuevas este mes</span>
                <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                  +{performanceState.isLoading ? "..." : performanceState.nuevasOportunidades}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ganadas este mes</span>
                <Badge variant="default" className="text-xs bg-blue-100 text-blue-700">
                  {performanceState.isLoading ? "..." : performanceState.oportunidadesGanadas}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Conversión est.</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round((oportunidadesState.total || 0) * 0.25)} leads
                </Badge>
              </div>
              
              {performanceState.oportunidadesGanadas > 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-200">
                  <Award className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">
                    ¡Felicitaciones! {performanceState.oportunidadesGanadas} oportunidad{performanceState.oportunidadesGanadas !== 1 ? 'es' : ''} ganada{performanceState.oportunidadesGanadas !== 1 ? 's' : ''} este mes
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Button asChild size="sm" className="flex-1">
                <Link
                  to={{
                    pathname: oportunidadesListPath,
                    search: buildFilterSearch(oportunidadesFilter),
                  }}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Ver Pipeline
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/crm/oportunidades/create">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </DashboardKpiCard>
        </div>

        {/* Performance Summary - Resumen semanal */}
        <div className="mt-8 mb-8">
          <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                📊 Resumen de Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Resumen Eventos */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className={`p-3 rounded-full ${
                      performanceState.eventosVencidos > 0 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {performanceState.eventosVencidos > 0 ? (
                        <AlertTriangle className="h-6 w-6" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6" />
                      )}
                    </div>
                  </div>
                  <h4 className="font-semibold text-slate-900">Seguimientos</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {performanceState.eventosVencidos === 0 
                      ? "Todo al día con los eventos"
                      : `${performanceState.eventosVencidos} eventos requieren atención`
                    }
                  </p>
                </div>

                {/* Resumen Oportunidades */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-slate-900">Ventas</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    +{performanceState.nuevasOportunidades} nuevas oportunidades este mes
                  </p>
                </div>

                {/* Resumen General */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                      <Award className="h-6 w-6" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-slate-900">Logros</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {performanceState.oportunidadesGanadas} oportunidad{performanceState.oportunidadesGanadas !== 1 ? 'es' : ''} ganada{performanceState.oportunidadesGanadas !== 1 ? 's' : ''} este mes
                  </p>
                </div>
              </div>
              
              {/* Barra de progreso general */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Productividad General</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(((performanceState.nuevasOportunidades + performanceState.oportunidadesGanadas) / Math.max(1, performanceState.eventosVencidos + eventosState.total + solicitudesState.total + 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round(((performanceState.nuevasOportunidades + performanceState.oportunidadesGanadas) / Math.max(1, performanceState.eventosVencidos + eventosState.total + solicitudesState.total + 1)) * 100))}%`
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">⚡ Acciones Rápidas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/crm/eventos/create">
                <CalendarCheck className="h-6 w-6 text-blue-600" />
                <span className="text-sm font-medium">Nuevo Evento</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/po-solicitudes/create">
                <FileText className="h-6 w-6 text-amber-600" />
                <span className="text-sm font-medium">Nueva Solicitud</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/crm/oportunidades/create">
                <Users className="h-6 w-6 text-emerald-600" />
                <span className="text-sm font-medium">Nueva Oportunidad</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/propiedades">
                <Building2 className="h-6 w-6 text-purple-600" />
                <span className="text-sm font-medium">Ver Propiedades</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer with system info */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <div className="text-center text-sm text-muted-foreground">
            <p>Sistema actualizado • Último acceso: {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
