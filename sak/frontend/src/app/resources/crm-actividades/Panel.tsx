"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Mail, Phone, CheckCircle2, Clock, NotebookPen } from "lucide-react";
import type { Actividad } from "./model";

const ACTIVIDADES_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ActividadesPanelProps = {
  mensajeId?: number;
  oportunidadId?: number;
  reloadKey?: unknown;
  className?: string;
};

export const ActividadesPanel = ({
  mensajeId,
  oportunidadId,
  reloadKey,
  className,
}: ActividadesPanelProps) => {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActividades = useCallback(async () => {
    if (!mensajeId || !oportunidadId) {
      setActividades([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${ACTIVIDADES_API_BASE}/crm/mensajes/${mensajeId}/actividades`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setActividades(data.actividades ?? []);
    } catch (err: any) {
      console.error("Error al cargar actividades:", err);
      setActividades([]);
      setError("No se pudieron cargar las actividades");
    } finally {
      setLoading(false);
    }
  }, [mensajeId, oportunidadId]);

  useEffect(() => {
    if (!oportunidadId) {
      setActividades([]);
      return;
    }
    loadActividades();
  }, [oportunidadId, mensajeId, loadActividades, reloadKey]);

  const renderContent = () => {
    if (!oportunidadId) {
      return renderInformativeState(
        "Crea una oportunidad para ver el historial de actividades.",
        "Las respuestas se editan ahora desde un popup dedicado para mantener el contexto del mensaje."
      );
    }
    if (loading) {
      return <p className="text-sm text-muted-foreground">Cargando actividades...</p>;
    }
    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }
    if (!actividades.length) {
      return <p className="text-sm text-muted-foreground">No hay actividades registradas.</p>;
    }
    return (
      <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
        {actividades.map((actividad) => (
          <li
            key={`${actividad.tipo}-${actividad.id}`}
            className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                actividad.tipo === "mensaje" ? "bg-sky-100 text-sky-600" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {getActividadIcon(actividad)}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <span className="text-xs text-foreground">
                  {actividad.tipo === "mensaje" ? actividad.tipo_mensaje || "Mensaje" : "Evento"}
                </span>
                <span>{formatActividadDate(actividad.fecha)}</span>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {actividad.descripcion || "Sin descripcion disponible."}
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {actividad.estado ? (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-slate-600">
                    {actividad.estado}
                  </span>
                ) : null}
                {actividad.tipo === "mensaje" && actividad.canal ? (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-slate-600">
                    {actividad.canal}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={cn("space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Historial de Actividades
        </p>
        <span className="text-xs font-semibold text-muted-foreground">
          {actividades.length} actividades
        </span>
      </div>
      {renderContent()}
    </div>
  );
};

const renderInformativeState = (title: string, description: string) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
    <NotebookPen className="h-10 w-10 text-muted-foreground/70" />
    <p className="text-base font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground/80">{description}</p>
  </div>
);

const formatActividadDate = (value: string) => {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return "Fecha invalida";
  }
  const hoy = new Date();
  const mismaFecha =
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate();
  if (mismaFecha) {
    return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
};

const getActividadIcon = (actividad: Actividad) => {
  if (actividad.tipo === "mensaje") {
    return <Mail className="h-5 w-5" />;
  }
  const estado = actividad.estado?.toLowerCase();
  if (estado === "pendiente") {
    return <Clock className="h-5 w-5" />;
  }
  if (estado === "hecho" || estado === "completado") {
    return <CheckCircle2 className="h-5 w-5" />;
  }
  return <Phone className="h-5 w-5" />;
};
