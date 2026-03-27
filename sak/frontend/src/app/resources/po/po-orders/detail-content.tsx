"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDataProvider, useGetOne, useRecordContext } from "ra-core";

import { formatOportunidadLabel } from "@/app/resources/crm/crm-oportunidades/model";
import {
  FormOrderCancelButton,
  FormOrderPrintButton,
} from "@/components/forms/form_order";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";

import {
  getOrderStatusBadgeClass,
  TIPO_COMPRA_CHOICES,
} from "./model";

export type PoOrderDetalle = {
  id?: number | string;
  articulo_id?: number | string | null;
  descripcion?: string | null;
  unidad_medida?: string | null;
  cantidad?: number | null;
  cantidad_facturada_calc?: number | null;
  precio?: number | null;
  importe?: number | null;
  centro_costo_id?: number | null;
  oportunidad_id?: number | null;
};

export type PoOrderDisplayRecord = {
  id?: number | string;
  titulo?: string | null;
  solicitante_id?: number | null;
  tipo_solicitud_id?: number | null;
  proveedor_id?: number | null;
  proveedor?: { id?: number | null; nombre?: string | null } | null;
  departamento_id?: number | null;
  centro_costo_id?: number | null;
  oportunidad_id?: number | null;
  metodo_pago_id?: number | null;
  tipo_compra?: string | null;
  created_at?: string | null;
  comentario?: string | null;
  total?: number | null;
  order_status_id?: number | null;
  order_status?: {
    id?: number | null;
    nombre?: string | null;
  } | null;
  detalles?: PoOrderDetalle[];
};

export const PO_ORDER_CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export const formatPoOrderCurrency = (value: unknown) =>
  PO_ORDER_CURRENCY_FORMATTER.format(Number(value ?? 0));

export const formatPoOrderNumber = (id: unknown) =>
  Number.isFinite(Number(id)) ? String(id).padStart(6, "0") : "-";

const LabelValue = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="text-xs font-medium text-foreground sm:text-sm">
      {children}
    </div>
  </div>
);

const LabelValueCompact = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[7px] uppercase tracking-wide text-muted-foreground sm:text-[8px]">
      {label}
    </span>
    <div className="text-[9px] font-medium text-foreground sm:text-[10px]">
      {children}
    </div>
  </div>
);

const PoOrderDetalleTable = ({ detalles }: { detalles: PoOrderDetalle[] }) => {
  const dataProvider = useDataProvider();
  const [articulosMap, setArticulosMap] = useState<Map<number, string>>(
    () => new Map(),
  );

  const resolveArticuloLabel = (
    detalle: PoOrderDetalle,
    map: Map<number, string>,
  ) => {
    const rawId = detalle.articulo_id;
    if (rawId == null || rawId === "") return "";
    const articuloId = Number(rawId);
    if (!Number.isFinite(articuloId) || articuloId <= 0) return "";
    return map.get(articuloId) ?? `ID ${articuloId}`;
  };

  const articuloIds = useMemo(
    () =>
      Array.from(
        new Set(
          detalles
            .map((item) => Number(item.articulo_id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ),
    [detalles],
  );

  useEffect(() => {
    let mounted = true;
    if (!articuloIds.length) {
      setArticulosMap(new Map());
      return () => {
        mounted = false;
      };
    }

    dataProvider
      .getMany("articulos", { ids: articuloIds })
      .then(({ data }) => {
        if (!mounted) return;
        const nextMap = new Map<number, string>();
        data.forEach((item: any) => {
          if (item?.id != null) {
            nextMap.set(Number(item.id), item.nombre ?? `ID ${item.id}`);
          }
        });
        setArticulosMap(nextMap);
      })
      .catch(() => {
        if (!mounted) return;
        setArticulosMap(new Map());
      });

    return () => {
      mounted = false;
    };
  }, [articuloIds, dataProvider]);

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-xl border border-border/60 sm:block">
        <table className="w-full min-w-[430px] table-fixed text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="w-[170px] px-2 py-1 sm:px-3 sm:py-2">
                Articulo
              </th>
              <th className="w-[110px] px-2 py-1 sm:px-3 sm:py-2">
                Descripcion
              </th>
              <th className="w-[42px] px-1 py-1 text-center text-[7px] sm:w-[48px] sm:px-1 sm:py-2 sm:text-[8px] whitespace-nowrap">
                Cantidad
              </th>
              <th className="w-[80px] px-1.5 py-1 text-right text-[8px] sm:w-[90px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                Precio
              </th>
              <th className="w-[80px] px-1.5 py-1 text-right text-[8px] sm:w-[90px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((detalle) => {
              const articuloLabel = resolveArticuloLabel(detalle, articulosMap);
              return (
                <tr
                  key={detalle.id ?? `${detalle.articulo_id}-${detalle.descripcion}`}
                  className="border-t border-border/60"
                >
                  <td className="px-2 py-1 align-top sm:px-3 sm:py-2">
                    <div className="text-[10px] leading-relaxed text-muted-foreground break-words">
                      {articuloLabel}
                    </div>
                  </td>
                  <td className="px-2 py-1 align-top sm:px-3 sm:py-2">
                    <div className="text-[9px] leading-snug text-muted-foreground break-words">
                      {detalle.descripcion || "-"}
                    </div>
                  </td>
                  <td className="px-1 py-1 text-center text-[7px] sm:px-1.5 sm:py-2 sm:text-[8px] whitespace-nowrap">
                    {detalle.cantidad ?? "-"}
                  </td>
                  <td className="px-1.5 py-1 text-right text-[8px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                    {formatPoOrderCurrency(detalle.precio)}
                  </td>
                  <td className="px-1.5 py-1 text-right text-[8px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                    {formatPoOrderCurrency(detalle.importe)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:hidden">
        {detalles.map((detalle) => {
          const articuloLabel = resolveArticuloLabel(detalle, articulosMap);
          return (
            <div
              key={detalle.id ?? `${detalle.articulo_id}-${detalle.descripcion}`}
              className="rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <div className="text-[11px] font-semibold text-foreground">
                {articuloLabel}
              </div>
              <div className="mt-0.5 text-[9px] leading-snug text-muted-foreground break-words">
                {detalle.descripcion || "-"}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-muted-foreground">
                <div className="flex flex-col gap-0 leading-none">
                  <div className="uppercase leading-none">Cantidad</div>
                  <div className="text-[10px] leading-none text-foreground">
                    {detalle.cantidad ?? "-"}
                  </div>
                </div>
                <div className="flex flex-col gap-0 text-right leading-none">
                  <div className="uppercase leading-none">Importe</div>
                  <div className="text-[10px] font-semibold leading-none text-foreground">
                    {formatPoOrderCurrency(detalle.importe)}
                  </div>
                </div>
                <div className="flex flex-col gap-0 text-right leading-none">
                  <div className="uppercase leading-none">Precio</div>
                  <div className="text-[10px] leading-none text-foreground">
                    {formatPoOrderCurrency(detalle.precio)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PoOrderDetailContent = ({
  showPrintButton = false,
  showCancelButton = false,
  compactHeader = false,
}: {
  showPrintButton?: boolean;
  showCancelButton?: boolean;
  compactHeader?: boolean;
}) => {
  const record = useRecordContext<PoOrderDisplayRecord>();
  const oportunidadId =
    typeof record?.oportunidad_id === "number" && record.oportunidad_id > 0
      ? record.oportunidad_id
      : null;
  const metodoPagoId =
    typeof record?.metodo_pago_id === "number" && record.metodo_pago_id > 0
      ? record.metodo_pago_id
      : null;

  const { data: oportunidadData } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId ?? 0 },
    { enabled: oportunidadId != null },
  );
  const { data: metodoPagoData } = useGetOne(
    "metodos-pago",
    { id: metodoPagoId ?? 0 },
    { enabled: metodoPagoId != null },
  );

  if (!record) return null;

  const tipoCompraLabel =
    TIPO_COMPRA_CHOICES.find((choice) => choice.id === record.tipo_compra)?.name ||
    record.tipo_compra ||
    "-";

  return (
    <div className="space-y-4">
      {showPrintButton ? (
        <div className="flex justify-end gap-2 print-hide">
          <FormOrderPrintButton />
        </div>
      ) : null}

      <Card className="p-3 sm:p-4">
        {!compactHeader ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                Orden
              </h4>
            </div>
            <div className="flex flex-1 justify-center">
              <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
                Numero: {formatPoOrderNumber(record.id)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
                Fecha:{" "}
                <DateField
                  source="created_at"
                  record={record}
                  className="tabular-nums"
                />
              </span>
            </div>
          </div>
        ) : null}
        <div className="print-cabecera-grid grid grid-cols-2 gap-3 md:grid-cols-4">
          {!compactHeader ? (
            <LabelValueCompact label="Titulo">
              <TextField source="titulo" />
            </LabelValueCompact>
          ) : null}
          <LabelValueCompact label="Solicitante">
            <ReferenceField source="solicitante_id" reference="users">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Tipo solicitud">
            <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Proveedor">
            <ReferenceField source="proveedor_id" reference="proveedores">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Departamento">
            <ReferenceField source="departamento_id" reference="departamentos">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Centro de costo">
            <ReferenceField source="centro_costo_id" reference="centros-costo">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Oportunidad">
            <span>
              {oportunidadData
                ? formatOportunidadLabel(oportunidadData)
                : record?.oportunidad_id
                  ? `#${record.oportunidad_id}`
                  : "-"}
            </span>
          </LabelValueCompact>
          <LabelValueCompact label="Metodo de pago">
            {metodoPagoData?.nombre ?? "-"}
          </LabelValueCompact>
          <LabelValueCompact label="Tipo compra">
            {tipoCompraLabel}
          </LabelValueCompact>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        {record.detalles?.length ? (
          <PoOrderDetalleTable detalles={record.detalles} />
        ) : (
          <p className="text-sm text-muted-foreground">Sin items.</p>
        )}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="print-footer-grid grid gap-3 md:grid-cols-3">
          <LabelValue label="Comentario">
            <TextField source="comentario" />
          </LabelValue>
          <div className="flex items-end justify-end md:col-span-2">
            <div className="text-right">
              <div className="text-left text-[7px] uppercase tracking-wide text-muted-foreground sm:text-[8px]">
                Total
              </div>
              <div className="mt-0.5 inline-flex rounded-full bg-muted/70 px-2 py-1 text-[10px] font-semibold text-foreground sm:text-[11px]">
                {formatPoOrderCurrency(record.total)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {showCancelButton ? (
        <div className="flex justify-end gap-2 print-hide">
          <FormOrderCancelButton />
        </div>
      ) : null}
    </div>
  );
};

export const PoOrderStatusTitle = ({
  fallback = "Ordenes",
}: {
  fallback?: string;
}) => {
  const record = useRecordContext<PoOrderDisplayRecord>();
  const orderStatusId =
    typeof record?.order_status_id === "number" && record.order_status_id > 0
      ? record.order_status_id
      : null;
  const { data: statusData } = useGetOne(
    "po-order-status",
    { id: orderStatusId ?? 0 },
    { enabled: orderStatusId != null },
  );

  if (!record) return fallback;

  const statusLabel = statusData?.nombre ?? record.order_status?.nombre ?? "-";
  const statusClass = getOrderStatusBadgeClass(statusLabel);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{fallback}</span>
      <Badge className={statusClass}>{statusLabel}</Badge>
    </div>
  );
};
