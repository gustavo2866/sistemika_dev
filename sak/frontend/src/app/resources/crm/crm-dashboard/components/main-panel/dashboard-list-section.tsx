"use client";

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ListContextProvider,
  RecordContextProvider,
  ResourceContextProvider,
  useList,
  useRecordContext,
} from "ra-core";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Trash2,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { FormOrderListRowActions, ListColumn, ResponsiveDataTable } from "@/components/forms/form_order";
import {
  CRM_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
  formatCurrency,
} from "../../model";
import { saveDashboardReturnMarker } from "../../return-state";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  canUseOportunidadActionForRecord,
  formatDateValue,
  formatEstadoOportunidad,
  isClosedOportunidad,
  isMantenimientoOportunidad,
  isProspectOportunidad,
} from "../../../crm-oportunidades/model";
import { captureOportunidadModalBackground } from "../../../crm-oportunidades/modal_background";
import type { CrmDashboardDetalleItem } from "../../model";
import type {
  DashboardDetailItem,
  DashboardMainPanelViewModel,
} from "./use-dashboard-main-panel";

const buildDashboardReturnTo = (pathname: string, search: string) => `${pathname}${search}`;

const getDetalleContactoLabel = (item: CrmDashboardDetalleItem) =>
  item.oportunidad?.contacto?.nombre_completo ??
  item.oportunidad?.contacto?.nombre ??
  (item.oportunidad?.contacto_id ? `Contacto #${item.oportunidad.contacto_id}` : "Sin contacto");

const getDetalleOportunidadLabel = (item: CrmDashboardDetalleItem) =>
  item.oportunidad?.titulo ??
  item.oportunidad?.descripcion_estado ??
  `Oportunidad #${item.oportunidad?.id}`;

const OportunidadEliminarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildDashboardReturnTo(location.pathname, location.search);

  if (
    !record?.id ||
    !isProspectOportunidad(record.estado) ||
    isMantenimientoOportunidad(record)
  ) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        saveDashboardReturnMarker(returnTo, {
          savedAt: Date.now(),
          oportunidadId: record.id,
        });
        const recordPayload = {
          id: record.id,
          contacto_id: record.contacto_id,
          titulo: record.titulo,
          descripcion_estado: record.descripcion_estado,
          fecha_estado: record.fecha_estado,
          created_at: record.created_at,
        };
        navigate(`/crm/oportunidades/${record.id}/accion_descartar`, {
          state: {
            returnTo,
            record: recordPayload,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      variant="destructive"
    >
      <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Eliminar
    </DropdownMenuItem>
  );
};

const OportunidadAceptarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildDashboardReturnTo(location.pathname, location.search);

  if (
    !record?.id ||
    !isProspectOportunidad(record.estado) ||
    isMantenimientoOportunidad(record)
  ) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        saveDashboardReturnMarker(returnTo, {
          savedAt: Date.now(),
          oportunidadId: record.id,
        });
        navigate(`/crm/oportunidades/${record.id}/accion_aceptar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Confirmar
    </DropdownMenuItem>
  );
};

const OportunidadCambioEstadoMenu = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildDashboardReturnTo(location.pathname, location.search);

  const canAgendar = canUseOportunidadActionForRecord(record, "agendar");
  const canCotizar = canUseOportunidadActionForRecord(record, "cotizar");
  const canReservar = canUseOportunidadActionForRecord(record, "reservar");
  const canCerrar = canUseOportunidadActionForRecord(record, "cerrar");
  const hasStateActions = canAgendar || canCotizar || canReservar || canCerrar;

  if (!record?.id || isClosedOportunidad(record.estado) || !hasStateActions) {
    return null;
  }

  const goTo = (path: string) => {
    saveDashboardReturnMarker(returnTo, {
      savedAt: Date.now(),
      oportunidadId: record.id,
    });
    navigate(path, {
      state: {
        returnTo,
        background: captureOportunidadModalBackground(),
      },
    });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onClick={(event) => event.stopPropagation()}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Cambiar estado
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-28 sm:w-36">
        {canAgendar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_agendar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Agendar
          </DropdownMenuItem>
        ) : null}
        {canCotizar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cotizar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cotizar
          </DropdownMenuItem>
        ) : null}
        {canReservar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_reservar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Reservar
          </DropdownMenuItem>
        ) : null}
        {canCerrar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cerrar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cerrar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

const DashboardOpportunityRowActions = ({ item }: { item: CrmDashboardDetalleItem }) => {
  if (!item.oportunidad?.id) return null;

  return (
    <ResourceContextProvider value="crm/oportunidades">
      <RecordContextProvider value={item.oportunidad as any}>
        <div onClick={(event) => event.stopPropagation()}>
          <FormOrderListRowActions
            className="h-4 w-4 sm:h-4 sm:w-4"
            showDelete={false}
            extraMenuItems={
              <>
                <OportunidadEliminarMenuItem />
                <OportunidadAceptarMenuItem />
                <OportunidadCambioEstadoMenu />
              </>
            }
          />
        </div>
      </RecordContextProvider>
    </ResourceContextProvider>
  );
};

const DetailOpportunityCard = ({ item, onClick }: DashboardDetailItem) => (
  <div className="w-full rounded-md border border-border/60 bg-card px-2.5 py-1 text-left transition-colors hover:bg-muted/40">
    <div className="grid gap-1 sm:hidden">
      <div className="flex items-start justify-between gap-1.5">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <div className="text-[8px] font-semibold leading-tight text-foreground">
            {item.oportunidad?.id ?? "-"}
          </div>
          <div className="truncate text-[8px] leading-tight text-muted-foreground">
            {getDetalleContactoLabel(item)}
          </div>
          <div className="truncate text-[8px] leading-tight text-muted-foreground">
            {getDetalleOportunidadLabel(item)}
          </div>
        </button>
        <div className="flex items-start gap-1">
          <DashboardOpportunityRowActions item={item} />
          <Badge
            className={`h-4.5 shrink-0 px-1.5 py-0 text-[8px] font-medium ${
              CRM_OPORTUNIDAD_ESTADO_BADGES[
                item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES
              ] ?? "bg-slate-100 text-slate-800"
            }`}
          >
            {formatEstadoOportunidad(
              item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES | undefined,
            )}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[8px] leading-tight text-muted-foreground">
        <span className="shrink-0">{formatDateValue(item.oportunidad?.fecha_estado)}</span>
        <span className="shrink-0 font-medium text-foreground">
          {formatCurrency(item.monto ?? 0)}
        </span>
      </div>
    </div>
    <div
      className="hidden cursor-pointer items-center gap-1.5 sm:grid sm:grid-cols-[32px_58px_92px_98px_64px_62px_28px]"
      onClick={onClick}
    >
      <div className="truncate text-[9px] font-semibold leading-tight text-foreground">
        {item.oportunidad?.id ?? "-"}
      </div>
      <div className="truncate text-[9px] leading-tight text-muted-foreground">
        {formatDateValue(item.oportunidad?.fecha_estado)}
      </div>
      <div className="truncate text-[9px] font-normal leading-tight">
        {getDetalleContactoLabel(item)}
      </div>
      <div className="truncate text-[9px] leading-tight text-muted-foreground">
        {getDetalleOportunidadLabel(item)}
      </div>
      <div>
        <Badge
          className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${
            CRM_OPORTUNIDAD_ESTADO_BADGES[
              item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES
            ] ?? "bg-slate-100 text-slate-800"
          }`}
        >
          {formatEstadoOportunidad(
            item.oportunidad?.estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES | undefined,
          )}
        </Badge>
      </div>
      <div className="truncate text-right text-[9px] leading-tight text-foreground">
        {formatCurrency(item.monto ?? 0)}
      </div>
      <div className="flex justify-end">
        <DashboardOpportunityRowActions item={item} />
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
};

type DashboardDetailTableRecord = {
  id: string;
  opportunityId: number;
  fecha: string;
  contacto: string;
  oportunidad: string;
  estado: string;
  monto: number;
  dashboardItem: DashboardDetailItem;
};

const useDashboardDetailRecord = () =>
  useRecordContext<DashboardDetailTableRecord>()?.dashboardItem;

const DashboardDetailIdCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[9px] font-semibold leading-tight text-foreground">
      {dashboardItem?.item.oportunidad?.id ?? "-"}
    </span>
  );
};

const DashboardDetailFechaCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="text-[9px] leading-tight text-muted-foreground">
      {formatDateValue(dashboardItem?.item.oportunidad?.fecha_estado)}
    </span>
  );
};

const DashboardDetailContactoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block truncate whitespace-nowrap text-[9px] font-normal leading-tight">
      {dashboardItem ? getDetalleContactoLabel(dashboardItem.item) : "-"}
    </span>
  );
};

const DashboardDetailOportunidadCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  if (!dashboardItem) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        dashboardItem.onClick();
      }}
      className="truncate text-left text-[9px] leading-tight text-muted-foreground hover:text-foreground"
      data-row-click="ignore"
    >
      {getDetalleOportunidadLabel(dashboardItem.item)}
    </button>
  );
};

const DashboardDetailEstadoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  const estado = dashboardItem?.item.oportunidad?.estado as
    | keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES
    | undefined;

  return (
    <Badge
      className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${
        CRM_OPORTUNIDAD_ESTADO_BADGES[estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES] ??
        "bg-slate-100 text-slate-800"
      }`}
    >
      {formatEstadoOportunidad(estado)}
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

const DashboardDetailActionsCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  if (!dashboardItem) return null;

  return <DashboardOpportunityRowActions item={dashboardItem.item} />;
};

const DashboardDetailTable = ({
  records,
}: {
  records: DashboardDetailTableRecord[];
}) => {
  const listContext = useList<DashboardDetailTableRecord>({
    data: records,
    resource: "crm-dashboard-detail",
    perPage: records.length || 1,
  });

  return (
    <ResourceContextProvider value="crm-dashboard-detail">
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
              return <DetailOpportunityCard key={key} {...cardProps} />;
            },
          }}
        >
          <ListColumn source="opportunityId" label="ID" className="w-[24px]">
            <DashboardDetailIdCell />
          </ListColumn>
          <ListColumn source="fecha" label="Fecha" className="w-[58px]">
            <DashboardDetailFechaCell />
          </ListColumn>
          <ListColumn source="contacto" label="Contacto" className="w-[82px] min-w-[82px] max-w-[82px]">
            <DashboardDetailContactoCell />
          </ListColumn>
          <ListColumn source="oportunidad" label="Oportunidad" className="w-[94px]">
            <DashboardDetailOportunidadCell />
          </ListColumn>
          <ListColumn source="estado" label="Estado" className="w-[46px]">
            <DashboardDetailEstadoCell />
          </ListColumn>
          <ListColumn source="monto" label="Monto" className="w-[52px]">
            <DashboardDetailMontoCell />
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
    opportunityId: Number(dashboardItem.item.oportunidad?.id ?? 0),
    fecha: String(dashboardItem.item.oportunidad?.fecha_estado ?? ""),
    contacto: getDetalleContactoLabel(dashboardItem.item),
    oportunidad: getDetalleOportunidadLabel(dashboardItem.item),
    estado: String(dashboardItem.item.oportunidad?.estado ?? ""),
    monto: Number(dashboardItem.item.monto ?? 0),
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
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Oportunidades</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Ocultar oportunidades" : "Mostrar oportunidades"}
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
                No hay oportunidades para mostrar.
              </div>
            ) : null}

            {!isInitialDetailLoading && records.length > 0 ? (
              <div
                ref={detailViewportRef}
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ height: CRM_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
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
