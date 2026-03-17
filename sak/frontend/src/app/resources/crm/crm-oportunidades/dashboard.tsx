"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider } from "ra-core";
import {
  DashboardCard,
  type DashboardCardBucket,
} from "@/components/forms/form_order";

type OportunidadesDashboardProps = {
  baseFilter?: Record<string, unknown>;
  refreshKey?: number;
  selectedCardId?: string;
  selectedBucketKey?: string;
  onCardClick?: (payload: { cardKey?: string }) => void;
  onBucketClick?: (payload: { cardKey: string; bucketKey?: string }) => void;
};

type EstadoCounts = {
  prospect: number;
  abierta: number;
  visita: number;
  cotiza: number;
  reserva: number;
  ganada: number;
  perdida: number;
};

const defaultCounts: EstadoCounts = {
  prospect: 0,
  abierta: 0,
  visita: 0,
  cotiza: 0,
  reserva: 0,
  ganada: 0,
  perdida: 0,
};

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

export const CRMOportunidadesDashboard = ({
  baseFilter,
  refreshKey,
  selectedCardId,
  selectedBucketKey,
  onCardClick,
  onBucketClick,
}: OportunidadesDashboardProps) => {
  const dataProvider = useDataProvider();
  const [counts, setCounts] = useState<EstadoCounts>(defaultCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedBaseFilter = useMemo(
    () => baseFilter ?? {},
    [baseFilter],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffDate = formatDate(cutoff);

      const fetchCount = async (filter: Record<string, unknown>) => {
        const response = await dataProvider.getList("crm/oportunidades", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
          filter: { ...normalizedBaseFilter, ...filter },
        });
        const total = response?.total;
        if (typeof total === "number") return total;
        return Array.isArray(response?.data) ? response.data.length : 0;
      };

      try {
        const [
          prospect,
          abierta,
          visita,
          cotiza,
          reserva,
          ganada,
          perdida,
        ] = await Promise.all([
          fetchCount({ estado: "0-prospect" }),
          fetchCount({ estado: "1-abierta" }),
          fetchCount({ estado: "2-visita" }),
          fetchCount({ estado: "3-cotiza" }),
          fetchCount({ estado: "4-reserva" }),
          fetchCount({ estado: "5-ganada", fecha_estado__gte: cutoffDate }),
          fetchCount({ estado: "6-perdida", fecha_estado__gte: cutoffDate }),
        ]);

        if (!cancelled) {
          setCounts({
            prospect,
            abierta,
            visita,
            cotiza,
            reserva,
            ganada,
            perdida,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [dataProvider, normalizedBaseFilter, refreshKey]);

  const enProcesoTotal = counts.abierta + counts.visita + counts.cotiza;
  const cerradasTotal = counts.ganada + counts.perdida;

  const prospectBuckets: DashboardCardBucket[] = [
    {
      key: "prospect",
      label: "Prospect",
      value: counts.prospect,
      tone: "info",
      labelClassName: "text-sky-700",
      valueClassName: "text-sky-700",
    },
  ];

  const procesoBuckets: DashboardCardBucket[] = [
    {
      key: "abierta",
      label: "Abierta",
      value: counts.abierta,
      tone: "info",
      labelClassName: "text-blue-700",
      valueClassName: "text-blue-700",
    },
    {
      key: "visita",
      label: "Visita",
      value: counts.visita,
      tone: "info",
      labelClassName: "text-cyan-700",
      valueClassName: "text-cyan-700",
    },
    {
      key: "cotiza",
      label: "Cotiza",
      value: counts.cotiza,
      tone: "warning",
      labelClassName: "text-amber-700",
      valueClassName: "text-amber-700",
    },
  ];

  const reservaBuckets: DashboardCardBucket[] = [
    {
      key: "reserva",
      label: "Reserva",
      value: counts.reserva,
      tone: "success",
      labelClassName: "text-violet-700",
      valueClassName: "text-violet-700",
    },
  ];

  const cerradasBuckets: DashboardCardBucket[] = [
    {
      key: "ganada",
      label: "Ganada",
      value: counts.ganada,
      tone: "success",
      labelClassName: "text-emerald-700",
      valueClassName: "text-emerald-700",
    },
    {
      key: "perdida",
      label: "Perdida",
      value: counts.perdida,
      tone: "danger",
      labelClassName: "text-rose-700",
      valueClassName: "text-rose-700",
    },
  ];

  return (
    <section className="space-y-3">
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

      <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        <DashboardCard
          id="prospect"
          title="Prospect"
          summary={
            <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
              {counts.prospect}
            </span>
          }
          dotTone="info"
          selectedId={selectedCardId}
          selectedBucketKey={selectedBucketKey}
          onSelect={(cardKey) => onCardClick?.({ cardKey })}
          onBucketSelect={(payload) =>
            onBucketClick?.({ cardKey: payload.id, bucketKey: payload.bucketKey })
          }
          buckets={prospectBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Ops</span>
            </>
          }
          bucketColumnsClassName="grid-cols-[1fr_auto]"
          defaultBucketsOpen={false}
        />
        <DashboardCard
          id="en_proceso"
          title="En proceso"
          summary={
            <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
              {enProcesoTotal}
            </span>
          }
          dotTone="warning"
          selectedId={selectedCardId}
          selectedBucketKey={selectedBucketKey}
          onSelect={(cardKey) => onCardClick?.({ cardKey })}
          onBucketSelect={(payload) =>
            onBucketClick?.({ cardKey: payload.id, bucketKey: payload.bucketKey })
          }
          buckets={procesoBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Ops</span>
            </>
          }
          bucketColumnsClassName="grid-cols-[1fr_auto]"
        />
        <DashboardCard
          id="reservas"
          title="Reservas"
          summary={
            <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
              {counts.reserva}
            </span>
          }
          dotTone="success"
          selectedId={selectedCardId}
          selectedBucketKey={selectedBucketKey}
          onSelect={(cardKey) => onCardClick?.({ cardKey })}
          onBucketSelect={(payload) =>
            onBucketClick?.({ cardKey: payload.id, bucketKey: payload.bucketKey })
          }
          buckets={reservaBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Ops</span>
            </>
          }
          bucketColumnsClassName="grid-cols-[1fr_auto]"
          defaultBucketsOpen={false}
        />
        <DashboardCard
          id="cerradas"
          title={
            <div className="flex flex-col gap-0 leading-none">
              <span>Cerradas</span>
              <span className="text-[7px] font-normal text-muted-foreground leading-none">
                Ultimos 30 dias
              </span>
            </div>
          }
          summary={
            <span className="inline-flex rounded-full border border-border bg-muted px-1.5 py-0.5 font-semibold text-foreground">
              {cerradasTotal}
            </span>
          }
          dotTone="danger"
          selectedId={selectedCardId}
          selectedBucketKey={selectedBucketKey}
          onSelect={(cardKey) => onCardClick?.({ cardKey })}
          onBucketSelect={(payload) =>
            onBucketClick?.({ cardKey: payload.id, bucketKey: payload.bucketKey })
          }
          buckets={cerradasBuckets}
          bucketHeader={
            <>
              <span>Estado</span>
              <span className="text-right">Ops</span>
            </>
          }
          bucketColumnsClassName="grid-cols-[1fr_auto]"
        />
      </div>
    </section>
  );
};

export default CRMOportunidadesDashboard;
