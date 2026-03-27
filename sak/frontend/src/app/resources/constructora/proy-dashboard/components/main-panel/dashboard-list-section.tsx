"use client";

import { useEffect, useRef } from "react";
import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useRecordContext,
} from "ra-core";
import { FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListColumn, ResponsiveDataTable } from "@/components/forms/form_order";
import { getProyectoEstadoBadgeClass, getProyectoEstadoLabel } from "../../../proyectos/model";
import {
  formatCurrency,
  formatDateValue,
  PROY_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
} from "../../model";
import type { DashboardDetailItem, DashboardMainPanelViewModel } from "./use-dashboard-main-panel";

type DashboardListSectionProps = Pick<
  DashboardMainPanelViewModel,
  "detailItems" | "detailLoading" | "hasMoreDetail" | "onLoadMore" | "totalProjects"
> & {
  title: string;
};

type DashboardDetailTableRecord = {
  id: string;
  dashboardItem: DashboardDetailItem;
};

const useDashboardDetailRecord = () =>
  useRecordContext<DashboardDetailTableRecord>()?.dashboardItem;

const DetailProjectCard = ({ item, onClick }: DashboardDetailItem) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-md border border-border/60 bg-card px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[9px] font-semibold text-muted-foreground">#{item.proyecto?.id ?? "-"}</div>
        <div className="truncate text-[11px] font-semibold text-foreground">
          {item.proyecto?.nombre ?? "Sin proyecto"}
        </div>
      </div>
      <Badge className={`h-5 px-1.5 py-0 text-[8px] ${getProyectoEstadoBadgeClass(item.estado_al_corte)}`}>
        {getProyectoEstadoLabel(item.estado_al_corte)}
      </Badge>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
      <div>
        <div>Ingresos</div>
        <div className="font-semibold text-foreground">{formatCurrency(item.importe_ejecutado ?? 0)}</div>
      </div>
      <div>
        <div>Costos</div>
        <div className="font-semibold text-foreground">{formatCurrency(item.costo_ejecutado ?? 0)}</div>
      </div>
      <div>
        <div>Creado</div>
        <div className="font-medium text-foreground">{formatDateValue(item.fecha_creacion)}</div>
      </div>
      <div>
        <div>Ult. avance</div>
        <div className="font-medium text-foreground">{formatDateValue(item.fecha_ultimo_avance)}</div>
      </div>
    </div>
  </button>
);

const DashboardDetailIdCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[10px] font-semibold leading-tight text-foreground">
      {dashboardItem?.item.proyecto?.id ?? "-"}
    </span>
  );
};

const DashboardDetailNombreCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  if (!dashboardItem) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        dashboardItem.onClick();
      }}
      className="block truncate text-left text-[10px] font-medium leading-tight hover:text-primary"
      data-row-click="ignore"
    >
      {dashboardItem.item.proyecto?.nombre ?? "Sin proyecto"}
    </button>
  );
};

const DashboardDetailEstadoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  const estado = dashboardItem?.item.estado_al_corte;
  return (
    <Badge className={`h-5 px-1.5 py-0 text-[8px] ${getProyectoEstadoBadgeClass(estado)}`}>
      {getProyectoEstadoLabel(estado)}
    </Badge>
  );
};

const DashboardDetailIngresosCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block text-right text-[10px] font-medium leading-tight text-foreground">
      {formatCurrency(dashboardItem?.item.importe_ejecutado ?? 0)}
    </span>
  );
};

const DashboardDetailCostosCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block text-right text-[10px] font-medium leading-tight text-foreground">
      {formatCurrency(dashboardItem?.item.costo_ejecutado ?? 0)}
    </span>
  );
};

const DashboardDetailTable = ({
  records,
}: {
  records: DashboardDetailTableRecord[];
}) => {
  const listContext = useList<DashboardDetailTableRecord>({
    data: records,
    resource: "proy-dashboard-detail",
    perPage: records.length || 1,
  });

  return (
    <ResourceContextProvider value="proy-dashboard-detail">
      <ListContextProvider value={listContext}>
        <ResponsiveDataTable
          rowClick={(_id: string | number, _resource: string, record: DashboardDetailTableRecord) => {
            record.dashboardItem.onClick();
            return false;
          }}
          bulkActionButtons={false}
          compact
          className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
          mobileConfig={{
            customCard: (record) => {
              const { key, ...cardProps } = (record as DashboardDetailTableRecord).dashboardItem;
              return <DetailProjectCard key={key} {...cardProps} />;
            },
          }}
        >
          <ListColumn source="id" label="ID" className="w-[44px]">
            <DashboardDetailIdCell />
          </ListColumn>
          <ListColumn source="nombre" label="Nombre" className="w-[180px]">
            <DashboardDetailNombreCell />
          </ListColumn>
          <ListColumn source="estado" label="Estado" className="w-[92px]">
            <DashboardDetailEstadoCell />
          </ListColumn>
          <ListColumn source="ingresos" label="Ingresos" className="w-[112px]">
            <DashboardDetailIngresosCell />
          </ListColumn>
          <ListColumn source="costos" label="Costos" className="w-[112px]">
            <DashboardDetailCostosCell />
          </ListColumn>
        </ResponsiveDataTable>
      </ListContextProvider>
    </ResourceContextProvider>
  );
};

export const DashboardListSection = ({
  title,
  totalProjects,
  detailItems,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
}: DashboardListSectionProps) => {
  const detailViewportRef = useRef<HTMLDivElement | null>(null);
  const detailLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const records = detailItems.map((dashboardItem) => ({
    id: dashboardItem.key,
    dashboardItem,
  }));
  const isInitialDetailLoading = detailLoading && detailItems.length === 0;

  useEffect(() => {
    if (!detailLoading) {
      loadingMoreRef.current = false;
    }
  }, [detailLoading]);

  useEffect(() => {
    const root = detailViewportRef.current;
    const target = detailLoadSentinelRef.current;

    if (!root || !target || !hasMoreDetail) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || detailLoading || loadingMoreRef.current) {
          return;
        }
        loadingMoreRef.current = true;
        onLoadMore();
      },
      {
        root,
        rootMargin: "0px 0px 72px 0px",
        threshold: 0,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [detailItems.length, detailLoading, hasMoreDetail, onLoadMore]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{title}</span>
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          {totalProjects} proyectos
        </span>
      </div>

      <div className="px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="space-y-2">
          {isInitialDetailLoading ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              Cargando proyectos...
            </div>
          ) : null}

          {!isInitialDetailLoading && detailItems.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              No hay proyectos para mostrar.
            </div>
          ) : null}

          {!isInitialDetailLoading && records.length > 0 ? (
            <div className="space-y-2">
              <div
                ref={detailViewportRef}
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ height: PROY_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
              >
                <DashboardDetailTable records={records} />
                {hasMoreDetail ? (
                  <div
                    ref={detailLoadSentinelRef}
                    aria-hidden="true"
                    className="h-px w-full shrink-0 opacity-0"
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
