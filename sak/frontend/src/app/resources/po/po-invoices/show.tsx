"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDataProvider, useRecordContext } from "ra-core";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { DateField } from "@/components/date-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormOrderCancelButton, FormOrderEditButton } from "@/components/forms/form_order";

import { getInvoiceStatusBadgeClass } from "./model";

type PoInvoiceDetalle = {
  id?: number | string;
  articulo_id?: number | string | null;
  descripcion?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  importe?: number | null;
};

type PoInvoice = {
  id?: number | string;
  titulo?: string | null;
  numero?: string | null;
  proveedor_id?: number | null;
  usuario_responsable_id?: number | null;
  id_tipocomprobante?: number | null;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  fecha_pago?: string | null;
  subtotal?: number | null;
  total_impuestos?: number | null;
  total?: number | null;
  observaciones?: string | null;
  detalles?: PoInvoiceDetalle[];
  invoice_status?: { id?: number; nombre?: string } | null;
  taxes?: Array<{ id?: number | string; descripcion?: string | null; importe?: number | null }> | null;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

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

const PoInvoiceDetalleTable = ({ detalles }: { detalles: PoInvoiceDetalle[] }) => {
  const dataProvider = useDataProvider();
  const [articulosMap, setArticulosMap] = useState<Map<number, string>>(
    () => new Map(),
  );

  const resolveArticuloLabel = (
    detalle: PoInvoiceDetalle,
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
        <table className="w-full min-w-[620px] table-fixed text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="w-[170px] px-2 py-1 sm:px-3 sm:py-2">Articulo</th>
              <th className="w-[200px] px-2 py-1 sm:px-3 sm:py-2">Descripcion</th>
              <th className="w-[52px] px-1 py-1 text-center text-[7px] sm:w-[60px] sm:px-1.5 sm:py-2 sm:text-[8px] whitespace-nowrap">
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
                    <div className="text-[10px] leading-relaxed text-muted-foreground break-words">
                      {detalle.descripcion || "-"}
                    </div>
                  </td>
                  <td className="px-1 py-1 text-center text-[7px] sm:px-1.5 sm:py-2 sm:text-[8px] whitespace-nowrap">
                    {detalle.cantidad ?? "-"}
                  </td>
                  <td className="px-1.5 py-1 text-right text-[8px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                    {CURRENCY_FORMATTER.format(Number(detalle.precio_unitario ?? 0))}
                  </td>
                  <td className="px-1.5 py-1 text-right text-[8px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                    {CURRENCY_FORMATTER.format(Number(detalle.importe ?? 0))}
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
              <div className="mt-0.5 text-[10px] text-muted-foreground break-words">
                {detalle.descripcion || "-"}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-muted-foreground">
                <div>
                  <div className="uppercase">Cantidad</div>
                  <div className="text-[10px] text-foreground">
                    {detalle.cantidad ?? "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="uppercase">Importe</div>
                  <div className="text-[10px] font-semibold text-foreground">
                    {CURRENCY_FORMATTER.format(Number(detalle.importe ?? 0))}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-right text-[9px] text-muted-foreground">
                Precio:{" "}
                <span className="text-foreground">
                  {CURRENCY_FORMATTER.format(Number(detalle.precio_unitario ?? 0))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PoInvoiceShowContent = () => {
  const record = useRecordContext<PoInvoice>();
  if (!record) return null;

  const statusLabel = record.invoice_status?.nombre ?? "Borrador";

  const numero = record.numero ? String(record.numero) : "-";

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
              Factura OC
            </h4>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
              Numero: {numero}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
              Emision:{" "}
              <DateField source="fecha_emision" record={record} className="tabular-nums" />
            </span>
          </div>
        </div>
        <div className="print-cabecera-grid grid gap-3 md:grid-cols-4">
          <LabelValueCompact label="Titulo">
            <TextField source="titulo" />
          </LabelValueCompact>
          <LabelValueCompact label="Proveedor">
            <ReferenceField source="proveedor_id" reference="proveedores">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Responsable">
            <ReferenceField source="usuario_responsable_id" reference="users">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Estado">
            <span className={getInvoiceStatusBadgeClass(statusLabel)}>{statusLabel}</span>
          </LabelValueCompact>
          <LabelValueCompact label="Tipo comprobante">
            <ReferenceField source="id_tipocomprobante" reference="tipos-comprobante">
              <TextField source="name" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Vencimiento">
            <DateField source="fecha_vencimiento" record={record} />
          </LabelValueCompact>
          <LabelValueCompact label="Fecha pago">
            <DateField source="fecha_pago" record={record} />
          </LabelValueCompact>
          <LabelValueCompact label="Subtotal">
            {CURRENCY_FORMATTER.format(Number(record.subtotal ?? 0))}
          </LabelValueCompact>
          <LabelValueCompact label="Impuestos">
            {CURRENCY_FORMATTER.format(Number(record.total_impuestos ?? 0))}
          </LabelValueCompact>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        {record.detalles?.length ? (
          <PoInvoiceDetalleTable detalles={record.detalles} />
        ) : (
          <p className="text-sm text-muted-foreground">Sin items.</p>
        )}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="space-y-3">
          <LabelValueCompact label="Observaciones">
            <TextField source="observaciones" />
          </LabelValueCompact>
          <div className="flex items-end justify-end">
            <div className="text-right">
              <div className="text-left text-[7px] uppercase tracking-wide text-muted-foreground sm:text-[8px]">
                Total
              </div>
              <div className="mt-0.5 inline-flex rounded-full bg-muted/70 px-2 py-1 text-[10px] font-semibold text-foreground sm:text-[11px]">
                {CURRENCY_FORMATTER.format(Number(record.total ?? 0))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        {record.taxes?.length ? (
          <div className="space-y-2">
            {record.taxes.map((tax) => (
              <div
                key={tax.id ?? tax.descripcion}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-[10px]"
              >
                <div className="text-foreground">{tax.descripcion || "-"}</div>
                <div className="text-right font-semibold text-foreground">
                  {CURRENCY_FORMATTER.format(Number(tax.importe ?? 0))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin impuestos.</p>
        )}
      </Card>

      <div className="flex justify-end gap-2 print-hide">
        <FormOrderCancelButton />
      </div>
    </div>
  );
};

const PoInvoiceShowTitle = () => {
  const record = useRecordContext<PoInvoice>();
  if (!record) return "Facturas OC";
  const statusLabel = record.invoice_status?.nombre ?? "Borrador";
  const statusClass = getInvoiceStatusBadgeClass(statusLabel);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Facturas OC</span>
      <Badge className={statusClass}>{statusLabel}</Badge>
    </div>
  );
};

export const PoInvoiceShow = () => (
  <Show
    className="w-full max-w-3xl"
    title={<PoInvoiceShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <div className="print-root w-full max-w-3xl">
      <PoInvoiceShowContent />
    </div>
  </Show>
);
