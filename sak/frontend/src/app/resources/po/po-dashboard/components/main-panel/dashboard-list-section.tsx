"use client";

import { useEffect, useRef } from "react";
import {
  ListContextProvider,
  RecordContextProvider,
  ResourceContextProvider,
  useList,
  useRecordContext,
} from "ra-core";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormOrderListRowActions,
  ListColumn,
  ResponsiveDataTable,
} from "@/components/forms/form_order";
import {
  PO_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
  formatCurrency,
  formatDateValue,
  type PoDashboardDetalleItem,
} from "../../model";
import { FormConfirmar } from "../../../po-orders/form_confirmar";
import { getOrderStatusBadgeClass } from "../../../po-orders/model";
import type {
  DashboardDetailItem,
  DashboardMainPanelViewModel,
} from "./use-dashboard-main-panel";

const getOrderIdLabel = (item: PoDashboardDetalleItem) =>
  item.order?.id ? String(item.order.id).padStart(6, "0") : "-";

const getProveedorLabel = (item: PoDashboardDetalleItem) =>
  item.order?.proveedor?.nombre ?? "Sin proveedor";

const getSolicitanteLabel = (item: PoDashboardDetalleItem) =>
  item.order?.solicitante?.nombre ?? "Sin solicitante";

const getTituloLabel = (item: PoDashboardDetalleItem) =>
  item.order?.titulo ?? "-";

const getEstadoLabel = (item: PoDashboardDetalleItem) =>
  item.order?.order_status?.nombre ?? item.estado ?? "-";

const DashboardOrderRowActions = ({ item }: { item: PoDashboardDetalleItem }) => {
  if (!item.order?.id) return null;

  return (
    <ResourceContextProvider value="po-orders">
      <RecordContextProvider value={item.order as any}>
        <div onClick={(event) => event.stopPropagation()}>
          <FormOrderListRowActions
            className="h-4 w-4 sm:h-4 sm:w-4"
            extraMenuItems={
              <>
                <FormConfirmar action="approve" />
                <FormConfirmar action="reject" />
              </>
            }
          />
        </div>
      </RecordContextProvider>
    </ResourceContextProvider>
  );
};

const DetailOrderCard = ({ item, onClick }: DashboardDetailItem) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40"
  >
    <div className="grid gap-2 sm:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[8px] font-semibold text-foreground">
            {getOrderIdLabel(item)}
          </div>
          <div className="truncate text-[8px] text-muted-foreground">
            {getProveedorLabel(item)}
          </div>
          <div className="truncate text-[8px] text-muted-foreground">
            {getTituloLabel(item)}
          </div>
        </div>
        <Badge
          className={`h-4.5 shrink-0 px-1.5 py-0 text-[8px] font-medium ${getOrderStatusBadgeClass(
            getEstadoLabel(item),
          )}`}
        >
          {getEstadoLabel(item)}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 text-[8px] text-muted-foreground">
        <span className="truncate">{getSolicitanteLabel(item)}</span>
        <span className="shrink-0 font-medium text-foreground">
          {formatCurrency(item.monto ?? 0)}
        </span>
      </div>
    </div>
    <div className="hidden items-center gap-1.5 sm:grid sm:grid-cols-[36px_54px_64px_82px_62px_68px_72px]">
      <div className="truncate text-[9px] font-semibold text-foreground">
        {getOrderIdLabel(item)}
      </div>
      <div className="truncate text-[9px] text-muted-foreground">
        {formatDateValue(item.fecha_creacion)}
      </div>
      <div className="truncate whitespace-nowrap text-[9px]">
        {getProveedorLabel(item)}
      </div>
      <div className="truncate whitespace-nowrap text-[9px] text-muted-foreground">
        {getTituloLabel(item)}
      </div>
      <div>
        <Badge
          className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${getOrderStatusBadgeClass(
            getEstadoLabel(item),
          )}`}
        >
          {getEstadoLabel(item)}
        </Badge>
      </div>
      <div className="truncate text-right text-[9px] font-medium text-foreground">
        {formatCurrency(item.monto ?? 0)}
      </div>
      <div className="truncate whitespace-nowrap text-[9px] text-muted-foreground">
        {getSolicitanteLabel(item)}
      </div>
    </div>
  </button>
);

type DashboardListSectionProps = Pick<
  DashboardMainPanelViewModel,
  "detailItems" | "detailLoading" | "hasMoreDetail" | "onLoadMore"
> & {
  expanded: boolean;
  onToggleExpanded: () => void;
};

type DashboardDetailTableRecord = {
  id: string;
  orderId: number;
  fecha: string;
  proveedor: string;
  titulo: string;
  estado: string;
  monto: number;
  solicitante: string;
  dashboardItem: DashboardDetailItem;
};

const useDashboardDetailRecord = () =>
  useRecordContext<DashboardDetailTableRecord>()?.dashboardItem;

const DashboardDetailIdCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[9px] font-semibold leading-tight text-foreground">
      {dashboardItem ? getOrderIdLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailFechaCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[9px] leading-tight text-muted-foreground">
      {dashboardItem ? formatDateValue(dashboardItem.item.fecha_creacion) : "-"}
    </span>
  );
};

const DashboardDetailProveedorCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[9px] leading-tight">
      {dashboardItem ? getProveedorLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailTituloCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[9px] leading-tight text-muted-foreground">
      {dashboardItem ? getTituloLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailEstadoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  const status = dashboardItem ? getEstadoLabel(dashboardItem.item) : "-";

  return (
    <Badge
      className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${getOrderStatusBadgeClass(
        status,
      )}`}
    >
      {status}
    </Badge>
  );
};

const DashboardDetailMontoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block text-right text-[9px] leading-tight text-foreground">
      {formatCurrency(dashboardItem?.item.monto ?? 0)}
    </span>
  );
};

const DashboardDetailSolicitanteCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[9px] leading-tight text-muted-foreground">
      {dashboardItem ? getSolicitanteLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailActionsCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  if (!dashboardItem) return null;

  return <DashboardOrderRowActions item={dashboardItem.item} />;
};

const DashboardDetailTable = ({
  records,
}: {
  records: DashboardDetailTableRecord[];
}) => {
  const listContext = useList<DashboardDetailTableRecord>({
    data: records,
    resource: "po-dashboard-detail",
    perPage: records.length || 1,
  });

  return (
    <ResourceContextProvider value="po-dashboard-detail">
      <ListContextProvider value={listContext}>
        <ResponsiveDataTable
          rowClick={(
            _id: string | number,
            _resource: string,
            record: DashboardDetailTableRecord,
          ) => {
            record.dashboardItem.onClick();
            return false;
          }}
          bulkActionButtons={false}
          compact
          className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
          mobileConfig={{
            customCard: (record) => {
              const { key, ...cardProps } = (record as DashboardDetailTableRecord).dashboardItem;
              return <DetailOrderCard key={key} {...cardProps} />;
            },
          }}
        >
          <ListColumn source="orderId" label="ID" className="w-[36px]">
            <DashboardDetailIdCell />
          </ListColumn>
          <ListColumn source="fecha" label="Fecha" className="w-[54px]">
            <DashboardDetailFechaCell />
          </ListColumn>
          <ListColumn
            source="proveedor"
            label="Proveedor"
            className="w-[64px] min-w-[64px] max-w-[64px]"
          >
            <DashboardDetailProveedorCell />
          </ListColumn>
          <ListColumn
            source="titulo"
            label="Titulo"
            className="w-[82px] min-w-[82px] max-w-[82px]"
          >
            <DashboardDetailTituloCell />
          </ListColumn>
          <ListColumn source="estado" label="Estado" className="w-[62px]">
            <DashboardDetailEstadoCell />
          </ListColumn>
          <ListColumn source="monto" label="Total" className="w-[68px]">
            <DashboardDetailMontoCell />
          </ListColumn>
          <ListColumn
            source="solicitante"
            label="Solicitante"
            className="w-[72px] min-w-[72px] max-w-[72px]"
          >
            <DashboardDetailSolicitanteCell />
          </ListColumn>
          <ListColumn label="" className="w-[28px]">
            <DashboardDetailActionsCell />
          </ListColumn>
        </ResponsiveDataTable>
      </ListContextProvider>
    </ResourceContextProvider>
  );
};

export const DashboardListSection = ({
  detailItems,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  expanded,
  onToggleExpanded,
}: DashboardListSectionProps) => {
  const detailViewportRef = useRef<HTMLDivElement | null>(null);
  const detailLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const isInitialDetailLoading = detailLoading && detailItems.length === 0;
  const records = detailItems.map((dashboardItem) => ({
    id: dashboardItem.key,
    orderId: Number(dashboardItem.item.order?.id ?? 0),
    fecha: String(dashboardItem.item.fecha_creacion ?? ""),
    proveedor: getProveedorLabel(dashboardItem.item),
    titulo: getTituloLabel(dashboardItem.item),
    estado: getEstadoLabel(dashboardItem.item),
    monto: Number(dashboardItem.item.monto ?? 0),
    solicitante: getSolicitanteLabel(dashboardItem.item),
    dashboardItem,
  }));

  useEffect(() => {
    if (!detailLoading) {
      loadingMoreRef.current = false;
    }
  }, [detailLoading]);

  useEffect(() => {
    const root = detailViewportRef.current;
    const target = detailLoadSentinelRef.current;

    if (!expanded || !root || !target || !hasMoreDetail) {
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
  }, [detailItems.length, detailLoading, expanded, hasMoreDetail, onLoadMore]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Ordenes</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Ocultar ordenes" : "Mostrar ordenes"}
        >
          <span>{expanded ? "Ocultar" : "Mostrar"}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {expanded ? (
        <div className="px-2 pb-2 sm:px-3 sm:pb-3">
          <div className="space-y-1">
            {isInitialDetailLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                Cargando detalle...
              </div>
            ) : null}

            {!isInitialDetailLoading && detailItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                No hay ordenes para mostrar.
              </div>
            ) : null}

            {!isInitialDetailLoading && records.length > 0 ? (
              <div
                ref={detailViewportRef}
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ height: PO_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
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
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
