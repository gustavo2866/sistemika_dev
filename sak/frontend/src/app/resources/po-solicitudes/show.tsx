"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CancelButton } from "@/components/cancel-button";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useDataProvider, useGetOne, useRecordContext } from "ra-core";
import { formatOportunidadLabel } from "@/app/resources/crm-oportunidades/OportunidadSelector";
import type { PoSolicitud, PoSolicitudDetalle } from "./model";
import { ESTADO_BADGES, ESTADO_CHOICES, TIPO_COMPRA_CHOICES } from "./model";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

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

const PoSolicitudDetalleTable = ({
  detalles,
}: {
  detalles: PoSolicitudDetalle[];
}) => {
  const dataProvider = useDataProvider();
  const [articulosMap, setArticulosMap] = useState<Map<number, string>>(
    () => new Map()
  );

  const articuloIds = useMemo(
    () =>
      Array.from(
        new Set(
          detalles
            .map((item) => Number(item.articulo_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ),
    [detalles]
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
      <div className="overflow-x-auto rounded-xl border border-border/60 hidden sm:block">
        <table className="w-full min-w-[520px] table-fixed text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="w-[150px] px-2 py-1 sm:w-[170px] sm:px-3 sm:py-2">
                Articulo
              </th>
              <th className="w-[180px] px-2 py-1 sm:w-[200px] sm:px-3 sm:py-2">
                Descripcion
              </th>
            <th className="w-[50px] px-1.5 py-1 text-center text-[8px] sm:w-[60px] sm:px-2.5 sm:py-2 sm:text-[9px]">
              Unidad
            </th>
            <th className="w-[50px] px-1.5 py-1 text-center text-[8px] sm:w-[60px] sm:px-2.5 sm:py-2 sm:text-[9px]">
              Cantidad
            </th>
            <th className="w-[70px] px-1.5 py-1 text-right text-[8px] sm:w-[80px] sm:px-2.5 sm:py-2 sm:text-[9px]">
              Precio
            </th>
            <th className="w-[70px] px-1.5 py-1 text-right text-[8px] sm:w-[80px] sm:px-2.5 sm:py-2 sm:text-[9px]">
              Importe
            </th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((detalle) => {
              const articuloId = Number(detalle.articulo_id);
              const articuloLabel =
                (!Number.isNaN(articuloId) && articulosMap.get(articuloId)) ||
                (Number.isFinite(articuloId) ? `ID ${articuloId}` : "-");
              return (
                <tr
                  key={detalle.id ?? `${detalle.articulo_id}-${detalle.descripcion}`}
                  className="border-t border-border/60"
                >
                  <td className="w-[150px] px-2 py-1 align-top sm:w-[170px] sm:px-3 sm:py-2">
                    <div className="text-[11px] font-medium text-foreground break-words sm:text-xs">
                      {articuloLabel}
                    </div>
                  </td>
                  <td className="w-[180px] px-2 py-1 align-top sm:w-[200px] sm:px-3 sm:py-2">
                    <div className="text-[10px] leading-relaxed text-muted-foreground break-words">
                      {detalle.descripcion || "-"}
                    </div>
                  </td>
                <td className="w-[50px] px-1.5 py-1 text-center text-[8px] text-muted-foreground sm:w-[60px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                  {detalle.unidad_medida || "-"}
                </td>
                <td className="w-[50px] px-1.5 py-1 text-center text-[8px] sm:w-[60px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                  {detalle.cantidad ?? "-"}
                </td>
                <td className="w-[70px] px-1.5 py-1 text-right text-[8px] sm:w-[80px] sm:px-2.5 sm:py-2 sm:text-[9px]">
                  {CURRENCY_FORMATTER.format(Number(detalle.precio ?? 0))}
                </td>
                <td className="w-[70px] px-1.5 py-1 text-right text-[8px] sm:w-[80px] sm:px-2.5 sm:py-2 sm:text-[9px]">
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
          const articuloId = Number(detalle.articulo_id);
          const articuloLabel =
            (!Number.isNaN(articuloId) && articulosMap.get(articuloId)) ||
            (Number.isFinite(articuloId) ? `ID ${articuloId}` : "-");
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
                  <div className="uppercase">Unidad</div>
                  <div className="text-[10px] text-foreground">
                    {detalle.unidad_medida || "-"}
                  </div>
                </div>
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
                  {CURRENCY_FORMATTER.format(Number(detalle.precio ?? 0))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PoSolicitudShowContent = () => {
  const record = useRecordContext<PoSolicitud>();
  const oportunidadId =
    typeof record?.oportunidad_id === "number" && record.oportunidad_id > 0
      ? record.oportunidad_id
      : null;
  const proveedorId =
    typeof record?.proveedor_id === "number" && record.proveedor_id > 0
      ? record.proveedor_id
      : null;
  const { data: oportunidadData } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId ?? 0 },
    { enabled: oportunidadId != null },
  );
  const { data: proveedorData } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null },
  );
  const metodoPagoId =
    typeof proveedorData?.default_metodo_pago_id === "number" &&
    proveedorData.default_metodo_pago_id > 0
      ? proveedorData.default_metodo_pago_id
      : null;
  const { data: metodoPagoData } = useGetOne(
    "metodos-pago",
    { id: metodoPagoId ?? 0 },
    { enabled: metodoPagoId != null },
  );

  if (!record) return null;

  const tipoCompraLabel =
    TIPO_COMPRA_CHOICES.find((choice) => choice.id === record.tipo_compra)?.name ||
    record.tipo_compra || "-";
  const solicitudNumero = Number.isFinite(record.id)
    ? String(record.id).padStart(6, "0")
    : "-";

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
              Solicitud
            </h4>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
              Numero: {solicitudNumero}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground sm:px-2.5 sm:text-sm">
              Fecha: {record.fecha_necesidad ?? "-"}
            </span>
          </div>
        </div>
        <div className="print-cabecera-grid grid gap-3 md:grid-cols-4">
          <LabelValueCompact label="Titulo">
            <TextField source="titulo" />
          </LabelValueCompact>
          <LabelValueCompact label="Tipo solicitud">
            <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Tipo compra">{tipoCompraLabel}</LabelValueCompact>
          <LabelValueCompact label="Proveedor">
            <ReferenceField source="proveedor_id" reference="proveedores">
              <TextField source="nombre" />
            </ReferenceField>
          </LabelValueCompact>
          <LabelValueCompact label="Fecha necesidad">
            <TextField source="fecha_necesidad" />
          </LabelValueCompact>
          <LabelValueCompact label="Solicitante">
            <ReferenceField source="solicitante_id" reference="users">
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
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        {record.detalles?.length ? (
          <PoSolicitudDetalleTable detalles={record.detalles} />
        ) : (
          <p className="text-sm text-muted-foreground">Sin items.</p>
        )}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="print-footer-grid grid gap-3 md:grid-cols-3">
          <LabelValueCompact label="Forma de pago">
            {metodoPagoData?.nombre ?? "-"}
          </LabelValueCompact>
          <LabelValueCompact label="Comentarios">
            <TextField source="comentario" />
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
      <div className="flex justify-end gap-2 print-hide">
        <CancelButton />
        <Button
          type="button"
          variant="outline"
          className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
          onClick={() => window.print()}
        >
          <Printer className="size-3 sm:size-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
};

const PoSolicitudShowTitle = () => {
  const record = useRecordContext<PoSolicitud>();
  if (!record) return "Solicitudes";

  const estadoLabel =
    ESTADO_CHOICES.find((choice) => choice.id === record.estado)?.name ||
    record.estado;
  const estadoBadge = ESTADO_BADGES[record.estado] || "bg-slate-100 text-slate-800";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Solicitudes</span>
      <Badge className={estadoBadge}>{estadoLabel}</Badge>
    </div>
  );
};

export const PoSolicitudShow = () => (
  <Show className="w-full max-w-3xl" title={<PoSolicitudShowTitle />}>
    <div className="print-root w-full max-w-3xl">
      <PoSolicitudShowContent />
    </div>
  </Show>
);
