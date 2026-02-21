"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";
import { VACANCIA_STATE_STEPS } from "./model";

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
  retiradaBuckets?: { key: string; label: string; count: number }[];
};

type DashboardPayload = {
  pivotDate: string;
  totalPropiedades: number;
  cards: EstadoCard[];
};

type VencimientoRange = {
  key: string;
  label: string;
  count: number;
};

type RealizadaVencimientosPayload = {
  pivotDate: string;
  tipoOperacionId: number | string | null;
  ranges: VencimientoRange[];
  total: number;
};

const getToday = () => new Date().toISOString().slice(0, 10);

type PropiedadesDashboardProps = {
  pivotDate?: string;
  onPivotDateChange?: (value: string) => void;
  tipoOperacionId?: string;
  selectedEstadoKey?: string;
  selectedBucketKey?: string;
  onCardClick?: (payload: { estadoKey: string }) => void;
  onBucketClick?: (payload: { estadoKey: string; bucketKey: string; label: string }) => void;
  refreshKey?: number;
};

export const PropiedadesDashboard = ({
  pivotDate: pivotDateProp,
  onPivotDateChange,
  tipoOperacionId,
  selectedEstadoKey,
  selectedBucketKey,
  onCardClick,
  onBucketClick,
  refreshKey,
}: PropiedadesDashboardProps) => {
  const [pivotDateState, setPivotDateState] = useState(getToday);
  const pivotDate = pivotDateProp ?? pivotDateState;
  const setPivotDate = onPivotDateChange ?? setPivotDateState;
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [realizadaVencimientos, setRealizadaVencimientos] =
    useState<RealizadaVencimientosPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeEstado = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const getEstadoColorClass = (estado: string) => {
    const key = estado.toLowerCase();
    if (key.includes("disponible")) return "bg-emerald-400";
    if (key.includes("reparacion") || key.includes("reparación")) return "bg-amber-400";
    if (key.includes("recibida")) return "bg-blue-400";
    if (key.includes("realizada")) return "bg-green-400";
    if (key.includes("retirada")) return "bg-rose-500";
    return "bg-muted-foreground/40";
  };

  const getEstadoKey = (estado: string) => {
    const key = normalizeEstado(estado);
    if (key.includes("recibida")) return "recibida";
    if (key.includes("reparacion")) return "en_reparacion";
    if (key.includes("disponible")) return "disponible";
    if (key.includes("realizada")) return "realizada";
    if (key.includes("retirada")) return "retirada";
    return "otro";
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
        if (tipoOperacionId) {
          params.set("tipoOperacionId", tipoOperacionId);
        }
        const [dashboardResponse, realizadaResponse] = await Promise.all([
          fetch(`${apiUrl}/api/dashboard/propiedades?${params.toString()}`),
          fetch(
            `${apiUrl}/api/dashboard/propiedades/realizada-vencimientos?${params.toString()}`,
          ),
        ]);
        if (!dashboardResponse.ok) {
          throw new Error("No se pudo cargar el dashboard de propiedades");
        }
        if (!realizadaResponse.ok) {
          throw new Error("No se pudo cargar vencimientos de realizadas");
        }
        const payload = (await dashboardResponse.json()) as DashboardPayload;
        const realizadaPayload =
          (await realizadaResponse.json()) as RealizadaVencimientosPayload;
        if (!isCancelled) {
          setData(payload);
          setRealizadaVencimientos(realizadaPayload);
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
  }, [pivotDate, tipoOperacionId, refreshKey]);

  const cards = useMemo(() => {
    const baseCards: EstadoCard[] = VACANCIA_STATE_STEPS.map((step) => ({
      estado: step.label,
      propiedades: 0,
      dias_vacancia_total: 0,
      dias_vacancia_promedio: 0,
      tipos: [],
    }));

    const incoming = data?.cards ?? [];
    const baseKeys = new Set(baseCards.map((card) => normalizeEstado(card.estado)));
    const incomingMap = new Map(
      incoming.map((card) => [normalizeEstado(card.estado), card] as const),
    );

    const merged = baseCards.map(
      (card) => incomingMap.get(normalizeEstado(card.estado)) ?? card,
    );

    const extras = incoming.filter((card) => !baseKeys.has(normalizeEstado(card.estado)));

    return merged.concat(extras);
  }, [data]);

  const realizadaRanges = useMemo(
    () => realizadaVencimientos?.ranges ?? [],
    [realizadaVencimientos],
  );
  const realizadaTotal = realizadaVencimientos?.total ?? 0;

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
        {cards.map((card) => {
          const cardKey = getEstadoKey(card.estado);
          const isSelectedCard =
            selectedEstadoKey === cardKey && !selectedBucketKey;
          return (
          <div
            key={card.estado}
            className={`min-w-0 rounded-md border bg-card p-1.5 shadow-sm ${
              onCardClick ? "cursor-pointer transition hover:bg-muted/30" : ""
            } ${
              isSelectedCard
                ? "border-primary/70 ring-1 ring-primary/40 bg-primary/5"
                : "border-border"
            }`}
            role={onCardClick ? "button" : undefined}
            tabIndex={onCardClick ? 0 : undefined}
            onClick={() => {
              if (!onCardClick) return;
              onCardClick({ estadoKey: cardKey });
            }}
            onKeyDown={(event) => {
              if (!onCardClick) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onCardClick({ estadoKey: cardKey });
              }
            }}
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
                  {normalizeEstado(card.estado).includes("realizada")
                    ? `${realizadaTotal} props`
                    : normalizeEstado(card.estado).includes("retirada")
                      ? `${(card.retiradaBuckets ?? []).reduce(
                          (acc, item) => acc + item.count,
                          0,
                        )} props`
                      : `${card.propiedades} props`}
                </span>
              </div>
            </div>

            {normalizeEstado(card.estado).includes("realizada") ? (
              <div className="mt-2.5 rounded-md border border-border/70">
                <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground">
                  <span>Vencimiento</span>
                  <span className="text-right">Props</span>
                </div>
                <div className="divide-y divide-border/60">
                  {realizadaRanges.length === 0 ? (
                    <div className="px-2 py-1.5 text-[9px] text-muted-foreground">
                      Sin datos de vencimientos.
                    </div>
                  ) : (
                    realizadaRanges.map((range) => {
                      const isVencidos = range.key === "vencidos";
                      const isSelectedBucket =
                        selectedEstadoKey === cardKey &&
                        selectedBucketKey === range.key;
                      return (
                        <button
                          type="button"
                          key={range.key}
                          className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 px-2 py-1.5 text-left text-[9px] hover:bg-muted/40 ${
                            isSelectedBucket ? "bg-primary/10 ring-1 ring-primary/30" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onBucketClick?.({
                              estadoKey: getEstadoKey(card.estado),
                              bucketKey: range.key,
                              label: range.label,
                            });
                          }}
                        >
                          <span
                            className={`truncate ${
                              isVencidos ? "text-red-600" : "text-muted-foreground"
                            }`}
                          >
                            {range.label}
                          </span>
                          <span
                            className={`text-right font-semibold ${
                              isVencidos ? "text-red-600" : "text-foreground"
                            }`}
                          >
                            {range.count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : normalizeEstado(card.estado).includes("retirada") ? (
              <div className="mt-2.5 rounded-md border border-border/70">
                <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground">
                  <span>Retiro</span>
                  <span className="text-right">Props</span>
                </div>
                <div className="divide-y divide-border/60">
                  {(card.retiradaBuckets ?? []).length === 0 ? (
                    <div className="px-2 py-1.5 text-[9px] text-muted-foreground">
                      Sin datos de retiros.
                    </div>
                  ) : (
                    (card.retiradaBuckets ?? []).map((bucket) => {
                      const isSelectedBucket =
                        selectedEstadoKey === cardKey &&
                        selectedBucketKey === bucket.key;
                      return (
                        <button
                          type="button"
                          key={bucket.key}
                          className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 px-2 py-1.5 text-left text-[9px] hover:bg-muted/40 ${
                            isSelectedBucket ? "bg-primary/10 ring-1 ring-primary/30" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onBucketClick?.({
                              estadoKey: getEstadoKey(card.estado),
                              bucketKey: bucket.key,
                              label: bucket.label,
                            });
                          }}
                        >
                          <span className="truncate text-muted-foreground">{bucket.label}</span>
                          <span className="text-right font-semibold text-foreground">
                            {bucket.count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
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
            )}
          </div>
        );
        })}
      </div>
    </section>
  );
};

export default PropiedadesDashboard;
