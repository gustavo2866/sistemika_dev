"use client";

import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useRecordContext,
} from "ra-core";
import { Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListColumn, ResponsiveDataTable } from "@/components/forms/form_order";
import { PropiedadRowActions } from "@/app/resources/inmobiliaria/propiedades/row-actions";
import { ReferenceField } from "@/components/reference-field";
import { ListText } from "@/components/forms/form_order";
import { getPropiedadStatusBadgeClass } from "../../../propiedades/model";
import {
  formatCurrency,
  formatInteger,
  type PropDashboardDetalleItem,
} from "../../model";

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

export type PropiedadesDetailTableItem = {
  key: string;
  item: PropDashboardDetalleItem;
  onClick: () => void;
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
  dashboardItem: PropiedadesDetailTableItem;
};

const useDashboardDetailRecord = () =>
  useRecordContext<DashboardDetailTableRecord>()?.dashboardItem;

const DetailPropertyCard = ({
  item,
  onClick,
  showContratoColumn,
  valueColumnLabel,
  showActions,
  refreshEventName,
}: PropiedadesDetailTableItem & {
  showContratoColumn: boolean;
  valueColumnLabel: string;
  showActions: boolean;
  refreshEventName?: string;
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
        <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
          <span>Vacancia: {formatInteger(item.dias_vacancia)}</span>
          {showContratoColumn ? <span className="truncate">{getContratoLabel(item)}</span> : null}
          <span className="truncate text-foreground">
            {showContratoColumn
              ? formatCurrency(item.valor_alquiler ?? 0)
              : `${valueColumnLabel}: ${formatCurrency(item.valor_alquiler ?? 0)}`}
          </span>
        </div>
      </button>
      {showActions ? (
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <PropiedadRowActions refreshEventName={refreshEventName} />
        </div>
      ) : null}
    </div>
  </div>
);

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
      className="block w-full max-w-full overflow-hidden truncate text-left text-[8px] font-medium leading-tight text-foreground hover:text-primary"
      data-row-click="ignore"
    >
      {dashboardItem.item.nombre}
    </button>
  );
};

const DashboardDetailPropietarioCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block w-full max-w-full overflow-hidden truncate whitespace-nowrap text-[8px] leading-tight text-muted-foreground">
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
    <span className="block text-center text-[8px] leading-tight text-foreground">
      {formatInteger(dashboardItem?.item.dias_vacancia ?? 0)}
    </span>
  );
};

const DashboardDetailContratoCell = () => {
  const dashboardItem = useDashboardDetailRecord();
  return (
    <span className="block w-full max-w-full overflow-hidden truncate whitespace-nowrap text-[8px] leading-tight text-muted-foreground">
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

const DashboardDetailTipoOperacionCell = () => (
  <ReferenceField
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    link={false}
    empty="-"
  >
    <ListText source="nombre" className="block w-full max-w-full overflow-hidden truncate whitespace-nowrap text-[8px] leading-tight text-foreground" />
  </ReferenceField>
);

const DashboardDetailActionsCell = ({ refreshEventName }: { refreshEventName?: string }) => (
  <PropiedadRowActions refreshEventName={refreshEventName} />
);

const DEFAULT_DASHBOARD_DETAIL_SORT = {
  field: "propertyId",
  order: "DESC" as const,
};

export const PropiedadesDetailTable = ({
  detailItems,
  showContratoColumn,
  valueColumnLabel,
  valueColumnMode = "currency",
  showActions = true,
  refreshEventName,
  storeKey = "propiedades-dashboard-detail.datatable",
}: {
  detailItems: PropiedadesDetailTableItem[];
  showContratoColumn: boolean;
  valueColumnLabel: string;
  valueColumnMode?: "currency" | "tipoOperacion";
  showActions?: boolean;
  refreshEventName?: string;
  storeKey?: string;
}) => {
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
  const listContext = useList<DashboardDetailTableRecord>({
    data: records,
    resource: "propiedades",
    perPage: records.length || 1,
    sort: DEFAULT_DASHBOARD_DETAIL_SORT,
  });

  return (
    <ResourceContextProvider value="propiedades">
      <ListContextProvider value={listContext}>
        <ResponsiveDataTable
          storeKey={storeKey}
          rowClick={(_id: string | number, _resource: string, record: DashboardDetailTableRecord) => {
            record.dashboardItem.onClick();
            return false;
          }}
          bulkActionButtons={false}
          compact
          className="w-full overflow-hidden text-[11px] [&_th]:text-[11px] [&_td]:text-[11px] [&_[data-slot=table-container]]:overflow-x-hidden [&_[data-slot=table]]:min-w-full [&_[data-slot=table]]:w-full [&_[data-slot=table]]:table-fixed"
          mobileConfig={{
            customCard: (record) => {
              const { key, ...cardProps } = (record as DashboardDetailTableRecord).dashboardItem;
              return (
                <DetailPropertyCard
                  key={key}
                  {...cardProps}
                  showContratoColumn={showContratoColumn}
                  valueColumnLabel={valueColumnLabel}
                  showActions={showActions}
                  refreshEventName={refreshEventName}
                />
              );
            },
          }}
        >
          <ListColumn source="propertyId" label="ID" className="w-[24px]">
            <DashboardDetailIdCell />
          </ListColumn>
          <ListColumn source="nombre" label="Propiedad" className="w-[96px]">
            <DashboardDetailNombreCell />
          </ListColumn>
          <ListColumn source="propietario" label="Propietario" className="w-[58px]">
            <DashboardDetailPropietarioCell />
          </ListColumn>
          <ListColumn source="estado" label="Estado" className="w-[54px]">
            <DashboardDetailEstadoCell />
          </ListColumn>
          <ListColumn source="diasVacancia" label="Dias" className="w-[34px] text-center">
            <DashboardDetailDiasCell />
          </ListColumn>
          {showContratoColumn ? (
            <ListColumn source="contratoFecha" label="Contrato" className="w-[62px]">
              <DashboardDetailContratoCell />
            </ListColumn>
          ) : null}
          {valueColumnMode === "tipoOperacion" ? (
            <ListColumn source="tipo_operacion_id" label={valueColumnLabel} className="w-[52px]">
              <DashboardDetailTipoOperacionCell />
            </ListColumn>
          ) : (
            <ListColumn source="valorAlquiler" label={valueColumnLabel} className="w-[48px] text-right">
              <DashboardDetailAlquilerCell />
            </ListColumn>
          )}
          {showActions ? (
            <ListColumn source="key" label="" disableSort className="w-[44px]">
              <DashboardDetailActionsCell refreshEventName={refreshEventName} />
            </ListColumn>
          ) : null}
        </ResponsiveDataTable>
      </ListContextProvider>
    </ResourceContextProvider>
  );
};

export const buildPropiedadesDetailTitle = (title: string) => (
  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
    <Home className="h-3.5 w-3.5 text-muted-foreground" />
    <span>{title}</span>
  </span>
);
