"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";

type TipoOperacionBucket = {
  tipo_operacion_id: number | null;
  tipo_operacion: string;
  propiedades: number;
  dias_vacancia_total: number;
  dias_vacancia_promedio: number;
};

type EstadoCard = {
  estado: string;
  propiedades: number;
  dias_vacancia_total: number;
  dias_vacancia_promedio: number;
  tipos: TipoOperacionBucket[];
};

type DashboardPayload = {
  pivotDate: string;
  totalPropiedades: number;
  cards: EstadoCard[];
};

const getToday = () => new Date().toISOString().slice(0, 10);

type PropiedadesDashboardProps = {
  pivotDate?: string;
  onPivotDateChange?: (value: string) => void;
};

export const PropiedadesDashboard = ({
  pivotDate: pivotDateProp,
  onPivotDateChange,
}: PropiedadesDashboardProps) => {
  const [pivotDateState, setPivotDateState] = useState(getToday);
  const pivotDate = pivotDateProp ?? pivotDateState;
  const setPivotDate = onPivotDateChange ?? setPivotDateState;
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEstadoColorClass = (estado: string) => {
    const key = estado.toLowerCase();
    if (key.includes("disponible")) return "bg-emerald-400";
    if (key.includes("reparacion") || key.includes("reparación")) return "bg-amber-400";
    if (key.includes("recibida")) return "bg-blue-400";
    if (key.includes("realizada")) return "bg-green-400";
    if (key.includes("retirada")) return "bg-rose-500";
    return "bg-muted-foreground/40";
  };

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (pivotDate) {
          params.set("pivotDate", pivotDate);
        }
        const response = await fetch(`${apiUrl}/api/dashboard/propiedades?${params.toString()}`);
        if (!response.ok) {
          throw new Error("No se pudo cargar el dashboard de propiedades");
        }
        const payload = (await response.json()) as DashboardPayload;
        if (!isCancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      isCancelled = true;
    };
  }, [pivotDate]);

  const cards = useMemo(() => data?.cards ?? [], [data]);

  return (
    <section className="space-y-3">
      {/* Encabezado movido al page para evitar duplicados */}

      {loading ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Cargando dashboard...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Sin datos para mostrar.
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        {cards.map((card) => (
          <div
            key={card.estado}
            className="min-w-0 rounded-md border border-border bg-card p-1.5 shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${getEstadoColorClass(
                    card.estado,
                  )}`}
                />
                <div className="w-full truncate whitespace-nowrap text-[11px] font-semibold leading-snug">
                {card.estado}
                </div>
              </div>
              <div className="flex items-center justify-end text-[9px] text-muted-foreground">
                <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                  {card.propiedades} props
                </span>
              </div>
            </div>

            <div className="mt-2.5 rounded-md border border-border/70">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground">
                <span>Operacion</span>
                <span className="text-right">Props</span>
                <span className="text-right">Dias</span>
              </div>
              <div className="divide-y divide-border/60">
                {card.tipos.map((tipo) => (
                  <div
                    key={`${card.estado}-${tipo.tipo_operacion_id ?? "sin-tipo"}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5 text-[9px]"
                  >
                    <span className="truncate text-muted-foreground">
                      {tipo.tipo_operacion}
                    </span>
                    <span className="text-right font-semibold text-foreground">
                      {tipo.propiedades}
                    </span>
                    <span className="text-right font-semibold text-foreground">
                      {tipo.dias_vacancia_promedio}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PropiedadesDashboard;
