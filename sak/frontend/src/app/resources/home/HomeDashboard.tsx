"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useCreatePath, useDataProvider, useGetIdentity } from "ra-core";
import {
  CalendarCheck,
  Target,
  AlertTriangle,
  Users,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/spinner";
import type { CRMEvento } from "@/app/resources/crm/crm-eventos/model";
import type { CRMOportunidad } from "@/app/resources/crm/crm-oportunidades/model";

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
      setOportunidadesState((prev) => ({ ...prev, isLoading: false }));
      setPerformanceState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    let cancelled = false;
    setEventosState((prev) => ({ ...prev, isLoading: true }));
    setOportunidadesState((prev) => ({ ...prev, isLoading: true }));
    setPerformanceState((prev) => ({ ...prev, isLoading: true }));

    const load = async () => {
      try {
        // Consultas paralelas para datos principales y de performance
        const [eventos, oportunidades, eventosVencidos, nuevasOportunidades, oportunidadesGanadas] = await Promise.all([
          dataProvider.getList<CRMEvento>("crm/crm-eventos", {
            pagination: { page: 1, perPage: PAGE_SIZE },
            sort: { field: "fecha_evento", order: "ASC" },
            filter: {
              default_scope: "pendientes_mes",
              solo_pendientes: true,
              asignado_a_id: userId,
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
          dataProvider.getList<CRMEvento>("crm/crm-eventos", {
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
  const oportunidadesFilter = useMemo(
    () => ({
      estado: "0-prospect",
      responsable_id: userId,
      activo: true,
    }),
    [userId]
  );

  const eventosListPath = createPath({ resource: "crm/crm-eventos", type: "list" });
  const oportunidadesListPath = createPath({ resource: "crm/oportunidades", type: "list" });

  return (
    <div className="w-full space-y-6 pb-5 lg:max-w-[1200px]">
      {/* Header Section */}
      <div className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Home</h1>
            <p className="text-sm text-muted-foreground">
              {identityLoading
                ? "Cargando información..."
                : `Hola ${(identity as any)?.fullName ?? (identity as any)?.nombre ?? "usuario"}, ¿qué vamos a lograr hoy?`
              }
            </p>
          </div>
          
          <Avatar className="h-8 w-8">
            <AvatarImage src={(identity as any)?.avatar ?? (identity as any)?.url_foto ?? ""} />
            <AvatarFallback className="text-sm font-medium">
              {((identity as any)?.fullName ?? (identity as any)?.nombre ?? "U")
                .toString()
                .slice(0, 1)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Mi Día - Tareas Prioritarias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Mi Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Eventos Hoy/Próximos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Eventos pendientes</span>
                <Badge variant={performanceState.eventosVencidos > 0 ? "destructive" : "secondary"}>
                  {eventosState.isLoading ? <Spinner size="small" /> : eventosState.total}
                </Badge>
              </div>
              {performanceState.eventosVencidos > 0 ? (
                <Button asChild variant="destructive" size="sm" className="w-full">
                  <Link to={{
                    pathname: eventosListPath,
                    search: buildFilterSearch(eventosFilter),
                  }}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Ver vencidos ({performanceState.eventosVencidos})
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={{
                    pathname: eventosListPath,
                    search: buildFilterSearch(eventosFilter),
                  }}>
                    <CalendarCheck className="h-4 w-4 mr-2" />
                    Ver eventos
                  </Link>
                </Button>
              )}
            </div>

            {/* Pipeline Activo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Prospects activos</span>
                <Badge variant="outline">
                  {oportunidadesState.isLoading ? <Spinner size="small" /> : oportunidadesState.total}
                </Badge>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={{
                  pathname: oportunidadesListPath,
                  search: buildFilterSearch(oportunidadesFilter),
                }}>
                  <Target className="h-4 w-4 mr-2" />
                  Ver pipeline
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance del Mes - Compacto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📈 Tu Performance - {new Date().toLocaleDateString('es-ES', { month: 'long' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {performanceState.isLoading ? <Spinner size="small" /> : performanceState.nuevasOportunidades}
              </div>
              <p className="text-xs text-muted-foreground">Nuevas oportunidades</p>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {performanceState.isLoading ? <Spinner size="small" /> : performanceState.oportunidadesGanadas}
              </div>
              <p className="text-xs text-muted-foreground">Oportunidades ganadas</p>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className={`text-2xl font-bold ${performanceState.eventosVencidos > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {performanceState.isLoading ? <Spinner size="small" /> : performanceState.eventosVencidos}
              </div>
              <p className="text-xs text-muted-foreground">
                {performanceState.eventosVencidos > 0 ? 'Eventos vencidos' : 'Todo al día ✓'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Rápidas - Más Prominentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚡ Crear Nuevo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="h-16 flex-col gap-1">
              <Link to="/crm/crm-eventos/create">
                <CalendarCheck className="h-6 w-6" />
                <span className="text-sm">Evento</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-16 flex-col gap-1">
              <Link to="/crm/oportunidades/create">
                <Users className="h-6 w-6" />
                <span className="text-sm">Oportunidad</span>
              </Link>
            </Button>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
