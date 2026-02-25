"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/dataProvider";
import {
  DashboardCard,
  type DashboardCardBucket,
  type DashboardCardTone,
} from "@/components/forms/form_order";
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
  onCardClick?: (payload: { estadoKey?: string }) => void;
  onBucketClick?: (payload: { estadoKey: string; bucketKey?: string; label?: string }) => void;
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
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const normalizeEstado = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const getEstadoKey = (estado: string) => {
    const key = normalizeEstado(estado);
    if (key.includes("recibida")) return "recibida";
    if (key.includes("reparacion")) return "en_reparacion";
    if (key.includes("disponible")) return "disponible";
    if (key.includes("realizada")) return "realizada";
    if (key.includes("retirada")) return "retirada";
    return "otro";
  };

  const getEstadoTone = (estado: string): DashboardCardTone => {
    const key = getEstadoKey(estado);
    if (key === "retirada") return "danger";
    if (key === "realizada") return "success";
    if (key === "disponible") return "success";
    if (key === "en_reparacion") return "warning";
    if (key === "recibida") return "info";
    return "muted";
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

  const getCardOpen = (key: string) => openCards[key] ?? false;
  const setCardOpen = (key: string, open: boolean) => {
    setOpenCards((prev) => {
      if (prev[key] === open) return prev;
      return { ...prev, [key]: open };
    });
  };

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

      <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        {cards.map((card) => {
          const cardKey = getEstadoKey(card.estado);
          const isRealizada = normalizeEstado(card.estado).includes("realizada");
          const isRetirada = normalizeEstado(card.estado).includes("retirada");
          const dotClassName = cardKey === "realizada" ? "bg-violet-500" : undefined;
          const summary = (
            <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
              {isRealizada
                ? `${realizadaTotal}`
                : isRetirada
                  ? `${(card.retiradaBuckets ?? []).reduce(
                      (acc, item) => acc + item.count,
                      0,
                    )}`
                  : `${card.propiedades}`}
            </span>
          );

          if (isRealizada) {
            const buckets: DashboardCardBucket[] = realizadaRanges.map((range) => ({
              key: range.key,
              label: range.label,
              value: range.count,
            }));

            return (
              <DashboardCard
                key={card.estado}
                id={cardKey}
                title={card.estado}
                summary={summary}
                dotTone={getEstadoTone(card.estado)}
                dotClassName={dotClassName}
                selectedId={selectedEstadoKey}
                selectedBucketKey={selectedBucketKey}
                bucketsOpen={getCardOpen(cardKey)}
                onBucketsOpenChange={(open) => setCardOpen(cardKey, open)}
                onSelect={(estadoKey) => onCardClick?.({ estadoKey })}
                onBucketSelect={(payload) => {
                  onBucketClick?.({
                    estadoKey: payload.id,
                    bucketKey: payload.bucketKey,
                    label: realizadaRanges.find((item) => item.key === payload.bucketKey)?.label,
                  });
                }}
                buckets={buckets}
                bucketHeader={
                  <>
                    <span>Alertas</span>
                    <span className="text-right">Props</span>
                  </>
                }
                bucketColumnsClassName="grid-cols-[1fr_auto]"
              >
                {realizadaRanges.length === 0 ? (
                  <div className="rounded-md border border-border/70 px-2 py-1.5 text-[9px] text-muted-foreground">
                    Sin datos de vencimientos.
                  </div>
                ) : null}
              </DashboardCard>
            );
          }

          if (isRetirada) {
            const buckets: DashboardCardBucket[] = (card.retiradaBuckets ?? []).map((bucket) => ({
              key: bucket.key,
              label: bucket.label,
              value: bucket.count,
              labelClassName: "text-muted-foreground",
              valueClassName: "text-foreground",
            }));

            return (
              <DashboardCard
                key={card.estado}
                id={cardKey}
                title={card.estado}
                summary={summary}
                dotTone={getEstadoTone(card.estado)}
                dotClassName={dotClassName}
                selectedId={selectedEstadoKey}
                selectedBucketKey={selectedBucketKey}
                bucketsOpen={getCardOpen(cardKey)}
                onBucketsOpenChange={(open) => setCardOpen(cardKey, open)}
                onSelect={(estadoKey) => onCardClick?.({ estadoKey })}
                onBucketSelect={(payload) => {
                  onBucketClick?.({
                    estadoKey: payload.id,
                    bucketKey: payload.bucketKey,
                    label: (card.retiradaBuckets ?? []).find((item) => item.key === payload.bucketKey)?.label,
                  });
                }}
                buckets={buckets}
                bucketHeader={
                  <>
                    <span>Retiro</span>
                    <span className="text-right">Props</span>
                  </>
                }
                bucketColumnsClassName="grid-cols-[1fr_auto]"
              >
                {(card.retiradaBuckets ?? []).length === 0 ? (
                  <div className="rounded-md border border-border/70 px-2 py-1.5 text-[9px] text-muted-foreground">
                    Sin datos de retiros.
                  </div>
                ) : null}
              </DashboardCard>
            );
          }

          return (
            <DashboardCard
              key={card.estado}
              id={cardKey}
              title={card.estado}
              summary={summary}
              dotTone={getEstadoTone(card.estado)}
              dotClassName={dotClassName}
              selectedId={selectedEstadoKey}
              selectedBucketKey={selectedBucketKey}
              bucketsOpen={getCardOpen(cardKey)}
              onBucketsOpenChange={(open) => setCardOpen(cardKey, open)}
              onSelect={(estadoKey) => onCardClick?.({ estadoKey })}
            >
              <div className="rounded-md border border-border/70">
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
            </DashboardCard>
          );
        })}
      </div>
    </section>
  );
};

export default PropiedadesDashboard;
