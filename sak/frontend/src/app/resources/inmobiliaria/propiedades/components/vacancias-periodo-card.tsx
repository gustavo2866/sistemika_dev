"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type BundleResponse = {
  current: {
    kpis: {
      dias_vacancia_periodo: {
        total: number;
        por_estado: { recibida: number; en_reparacion: number; disponible: number };
        variacion_vs_anterior: number | null;
      };
    };
    period_summary: {
      activas_fin: number;
    };
  };
};

type SelectorsResponse = {
  recibida: { count: number };
  en_reparacion: { count: number };
  disponible: { count: number };
};

// ── Constants ────────────────────────────────────────────────────────────────

const ESTADO_ROWS: Array<{
  key: "recibida" | "en_reparacion" | "disponible";
  label: string;
  dotClass: string;
}> = [
  { key: "recibida", label: "Recibida", dotClass: "bg-sky-400" },
  { key: "en_reparacion", label: "En Reparación", dotClass: "bg-amber-400" },
  { key: "disponible", label: "Disponible", dotClass: "bg-emerald-400" },
];

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  startDate: string;
  endDate: string;
  periodType?: string;
  tipoOperacionId?: string;
  refreshKey?: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const VacanciasPeriodoCard = ({
  startDate,
  endDate,
  periodType = "trimestre",
  tipoOperacionId,
  refreshKey,
}: Props) => {
  const [bundle, setBundle] = useState<BundleResponse | null>(null);
  const [selectors, setSelectors] = useState<SelectorsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const bundleParams = new URLSearchParams({ startDate, endDate, periodType });
        if (tipoOperacionId) bundleParams.set("tipoOperacionId", tipoOperacionId);

        const selParams = new URLSearchParams();
        if (tipoOperacionId) selParams.set("tipoOperacionId", tipoOperacionId);

        const [bRes, sRes] = await Promise.all([
          fetch(`${apiUrl}/api/dashboard/propiedades/bundle?${bundleParams}`),
          fetch(`${apiUrl}/api/dashboard/propiedades/selectors?${selParams}`),
        ]);

        if (!cancelled) {
          setBundle(await bRes.json());
          setSelectors(await sRes.json());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, periodType, tipoOperacionId, refreshKey]);

  const kpis = bundle?.current?.kpis?.dias_vacancia_periodo;
  const variation = kpis?.variacion_vs_anterior ?? null;
  const totalProps = bundle?.current?.period_summary?.activas_fin ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Vacancia del período
        </span>
        {loading ? (
          <span className="text-[9px] text-muted-foreground">cargando…</span>
        ) : (
          <span className="text-[9px] text-muted-foreground">
            {startDate} → {endDate}
          </span>
        )}
      </div>

      {/* Main stat row */}
      <div className="mb-3 flex items-end gap-2">
        <span className="text-2xl font-bold leading-none">
          {kpis ? kpis.total.toLocaleString("es-AR") : "—"}
        </span>
        <span className="mb-0.5 text-xs text-muted-foreground">días</span>

        {variation != null ? (
          <span
            className={cn(
              "mb-0.5 ml-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              variation >= 0
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700",
            )}
          >
            {variation >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {variation >= 0 ? "+" : ""}
            {variation}%
          </span>
        ) : null}

        <span className="mb-0.5 ml-auto inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
          {totalProps} propiedades
        </span>
      </div>

      {/* Per-estado table */}
      {kpis ? (
        <div className="rounded-md border border-border/70">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground">
            <span>Estado</span>
            <span className="text-right">Días</span>
            <span className="text-right">Props</span>
          </div>
          <div className="divide-y divide-border/60">
            {ESTADO_ROWS.map(({ key, label, dotClass }) => (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5 text-[9px]"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
                  {label}
                </span>
                <span className="text-right font-semibold text-foreground">
                  {kpis.por_estado[key].toLocaleString("es-AR")}
                </span>
                <span className="text-right font-semibold text-foreground">
                  {selectors?.[key]?.count ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
