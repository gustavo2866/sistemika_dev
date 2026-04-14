"use client";

import { useEffect, useRef } from "react";
import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useRecordContext,
} from "ra-core";
import { ChevronDown, ChevronUp, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListColumn, ResponsiveDataTable } from "@/components/forms/form_order";
import { PropiedadRowActions } from "@/app/resources/inmobiliaria/propiedades/row-actions";
import { getPropiedadStatusBadgeClass } from "../../../propiedades/model";
import {
  PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
  formatCurrency,
  formatInteger,
  type PropDashboardDetalleItem,
} from "../../model";
import type {
  DashboardDetailItem,
  DashboardMainPanelViewModel,
} from "./use-dashboard-main-panel";

const formatDateValue = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-AR");
};

const getContratoLabel = (item: PropDashboardDetalleItem) => {
  if (item.dias_para_vencimiento != null) {
    return `Vto ${formatDateValue(item.vencimiento_contrato)}`;
  }
  if (item.dias_para_renovacion != null) {
    return `Renov ${formatDateValue(item.fecha_renovacion)}`;
  }
  if (item.vencimiento_contrato) {
    return `Vto ${formatDateValue(item.vencimiento_contrato)}`;
  }
  if (item.fecha_renovacion) {
    return `Renov ${formatDateValue(item.fecha_renovacion)}`;
  }
  return "-";
};

const DetailPropertyCard = ({
  item,
  onClick,
  showContratoColumn,
  valueColumnLabel,
}: DashboardDetailItem & {
  showContratoColumn: boolean;
  valueColumnLabel: string;
}) => (
  <div className="w-full rounded-md border border-border/60 bg-card px-2.5 py-2 transition-colors hover:bg-muted/40">
    <div className="flex items-start gap-2">
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold leading-tight text-foreground">
              #{item.propiedad_id} {item.nombre}
            </div>
            <div className="truncate text-[9px] leading-tight text-muted-foreground">
              {item.propietario || "Sin propietario"}
            </div>
          </div>
          <Badge className={`h-5 px-1.5 py-0 text-[8px] ${getPropiedadStatusBadgeClass(item.estado)}`}>
            {item.estado || "Sin estado"}
          </Badge>
        </div>
    <div
      className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground"
    >
      <span>Vacancia: {formatInteger(item.dias_vacancia)}</span>
      {showContratoColumn ? <span className="truncate">{getContratoLabel(item)}</span> : null}
      <span className="truncate text-foreground">
        {showContratoColumn
          ? formatCurrency(item.valor_alquiler ?? 0)
              : `${valueColumnLabel}: ${formatCurrency(item.valor_alquiler ?? 0)}`}
          </span>
        </div>
      </button>
      <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
        <PropiedadRowActions refreshEventName="propiedades-dashboard-refresh" />
      </div>
    </div>
  </div>
);

type DashboardListSectionProps = Pick<
  DashboardMainPanelViewModel,
  "detailItems" | "detailLoading" | "hasMoreDetail" | "onLoadMore"
> & {
  expanded: boolean;
  onToggleExpanded: () => void;
  title: string;
  emptyMessage: string;
  showContratoColumn: boolean;
  valueColumnLabel: string;
};

type DashboardDetailTableRecord = {
  id: number;
  key: string;
  propertyId: number;
  nombre: string;
  propietario: string;
  estado: string;
  diasVacancia: number;
  contratoFecha: string;
  valorAlquiler: number;
  tipo_propiedad_id?: number | null;
  tipo_actualizacion_id?: number | null;
  tipo_operacion_id?: number | null;
  propiedad_status_id?: number | null;
  estado_fecha?: string | null;
  fecha_inicio_contrato?: string | null;
  fecha_renovacion?: string | null;
  dashboardItem: DashboardDetailItem;
};

const useDashboardDetailRecord = () =>
  useRecordContext<DashboardDetailTableRecord>()?.dashboardItem;

const DashboardDetailIdCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[8px] font-semibold leading-tight text-foreground">
      {dashboardItem?.item.propiedad_id ?? "-"}
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
        className="truncate text-left text-[8px] font-medium leading-tight text-foreground hover:text-primary"
        data-row-click="ignore"
      >
        {dashboardItem.item.nombre}
      </button>
  );
};

const DashboardDetailPropietarioCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[8px] leading-tight text-muted-foreground">
      {dashboardItem?.item.propietario || "-"}
    </span>
  );
};

const DashboardDetailEstadoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <Badge
      className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${getPropiedadStatusBadgeClass(
        dashboardItem?.item.estado,
      )}`}
    >
      {dashboardItem?.item.estado || "Sin estado"}
    </Badge>
  );
};

const DashboardDetailDiasCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block text-right text-[8px] leading-tight text-foreground">
      {formatInteger(dashboardItem?.item.dias_vacancia ?? 0)}
    </span>
  );
};

const DashboardDetailContratoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[8px] leading-tight text-muted-foreground">
      {dashboardItem ? getContratoLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailAlquilerCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block text-right text-[8px] leading-tight text-foreground">
      {formatCurrency(dashboardItem?.item.valor_alquiler ?? 0)}
    </span>
  );
};

const DashboardDetailActionsCell = () => (
  <PropiedadRowActions refreshEventName="propiedades-dashboard-refresh" />
);

const DashboardDetailTable = ({
  records,
  showContratoColumn,
  valueColumnLabel,
}: {
  records: DashboardDetailTableRecord[];
  showContratoColumn: boolean;
  valueColumnLabel: string;
}) => {
  const listContext = useList<DashboardDetailTableRecord>({
    data: records,
    resource: "propiedades",
    perPage: records.length || 1,
  });

  return (
    <ResourceContextProvider value="propiedades">
      <ListContextProvider value={listContext}>
        <ResponsiveDataTable
          storeKey="propiedades-dashboard-detail.datatable"
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
              return (
                <DetailPropertyCard
                  key={key}
                  {...cardProps}
                  showContratoColumn={showContratoColumn}
                  valueColumnLabel={valueColumnLabel}
                />
              );
            },
          }}
        >
          <ListColumn source="propertyId" label="ID" className="w-[24px]">
            <DashboardDetailIdCell />
          </ListColumn>
          <ListColumn source="nombre" label="Propiedad" className="w-[102px]">
            <DashboardDetailNombreCell />
          </ListColumn>
          <ListColumn source="propietario" label="Propietario" className="w-[60px]">
            <DashboardDetailPropietarioCell />
          </ListColumn>
          <ListColumn source="estado" label="Estado" className="w-[54px]">
            <DashboardDetailEstadoCell />
          </ListColumn>
          <ListColumn source="diasVacancia" label="Dias" className="w-[34px]">
            <DashboardDetailDiasCell />
          </ListColumn>
          {showContratoColumn ? (
            <ListColumn source="contratoFecha" label="Contrato" className="w-[62px]">
              <DashboardDetailContratoCell />
            </ListColumn>
          ) : null}
          <ListColumn source="valorAlquiler" label={valueColumnLabel} className="w-[48px]">
            <DashboardDetailAlquilerCell />
          </ListColumn>
          <ListColumn source="key" label="Acciones" disableSort className="w-[44px]">
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
  title,
  emptyMessage,
  showContratoColumn,
  valueColumnLabel,
}: DashboardListSectionProps) => {
  const detailViewportRef = useRef<HTMLDivElement | null>(null);
  const detailLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const isInitialDetailLoading = detailLoading && detailItems.length === 0;
  const records = detailItems.map((dashboardItem) => ({
    id: Number(dashboardItem.item.propiedad_id ?? 0),
    key: dashboardItem.key,
    propertyId: Number(dashboardItem.item.propiedad_id ?? 0),
    nombre: dashboardItem.item.nombre,
    propietario: dashboardItem.item.propietario || "",
    estado: String(dashboardItem.item.estado ?? ""),
    diasVacancia: Number(dashboardItem.item.dias_vacancia ?? 0),
    contratoFecha: getContratoLabel(dashboardItem.item),
    valorAlquiler: Number(dashboardItem.item.valor_alquiler ?? 0),
    tipo_propiedad_id: dashboardItem.item.tipo_propiedad_id ?? null,
    tipo_actualizacion_id: dashboardItem.item.tipo_actualizacion_id ?? null,
    tipo_operacion_id: dashboardItem.item.tipo_operacion_id ?? null,
    propiedad_status_id: dashboardItem.item.propiedad_status_id ?? null,
    estado_fecha: dashboardItem.item.estado_fecha ?? null,
    fecha_inicio_contrato: dashboardItem.item.fecha_inicio_contrato ?? null,
    fecha_renovacion: dashboardItem.item.fecha_renovacion ?? null,
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
          <Home className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{title}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Ocultar detalle" : "Mostrar detalle"}
        >
          <span>{expanded ? "Ocultar" : "Mostrar"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                {emptyMessage}
              </div>
            ) : null}

            {!isInitialDetailLoading && records.length > 0 ? (
              <div
                ref={detailViewportRef}
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ height: PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
              >
                <DashboardDetailTable
                  records={records}
                  showContratoColumn={showContratoColumn}
                  valueColumnLabel={valueColumnLabel}
                />
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
