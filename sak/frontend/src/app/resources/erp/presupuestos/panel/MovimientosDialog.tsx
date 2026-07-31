"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { MovimientoRequest, MovimientoResponse, MovimientoRow } from "./types";
import {
  buildMovimientosExportUrl,
  downloadBlobWithAuth,
  formatCurrency,
  formatDateValue,
  formatMonthLabel,
} from "./utils";

const formatAsiento = (row: MovimientoRow) =>
  [row.tipo_asiento, row.nro_asiento].filter(Boolean).join("-") || "";

const formatMovimientoCuenta = (row: MovimientoRow) =>
  [row.cuenta, row.cuenta_codigo, row.cuenta_descripcion]
    .filter(Boolean)
    .join(" - ");

type MovimientosDialogProps = {
  request: MovimientoRequest | null;
  data?: MovimientoResponse;
  isLoading: boolean;
  isError: boolean;
  onOpenChange: (open: boolean) => void;
};

export const MovimientosDialog = ({
  request,
  data,
  isLoading,
  isError,
  onOpenChange,
}: MovimientosDialogProps) => {
  const rows = data?.rows ?? [];
  const canExport = rows.length > 0 && !isLoading && !isError;

  const handleExportXls = async () => {
    if (!request) return;

    const safeLabel = request.label
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    await downloadBlobWithAuth(
      buildMovimientosExportUrl(request),
      `movimientos-reales-${request.concepto}-${request.month}-${safeLabel}.xlsx`,
    );
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(92vw,1080px)] max-w-[1080px] gap-2 p-3 sm:max-w-[1080px]"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader className="gap-1 pr-24">
          <DialogTitle className="text-sm">Movimientos reales</DialogTitle>
          <div className="truncate text-[10px] text-muted-foreground">
            {request
              ? `${request.conceptoLabel} · ${formatMonthLabel(request.month)} · ${request.label}`
              : ""}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-10 top-3 h-7 px-2 text-[10px]"
            onClick={() => void handleExportXls()}
            disabled={!canExport}
          >
            <Download className="mr-1 size-3" />
            XLS
          </Button>
        </DialogHeader>

        <div className="h-[360px] overflow-x-hidden overflow-y-auto rounded-md border border-border">
          <table className="w-full table-fixed border-collapse text-[9px]">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b border-border">
                <th className="w-[70px] px-1 py-0.5 text-left font-medium">Fecha</th>
                <th className="w-[44px] px-1 py-0.5 text-left font-medium">Asiento</th>
                <th className="w-[260px] px-1 py-0.5 text-left font-medium">Cuenta</th>
                <th className="px-1 py-0.5 text-left font-medium">Descripcion</th>
                <th className="w-[92px] px-1 py-0.5 text-right font-medium">Debe</th>
                <th className="w-[92px] px-1 py-0.5 text-right font-medium">Haber</th>
                <th className="w-[92px] px-1 py-0.5 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    Cargando movimientos...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    No se pudieron cargar los movimientos.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    Sin movimientos para el periodo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="whitespace-nowrap px-1 py-0.5">
                      {formatDateValue(row.fecha)}
                    </td>
                    <td className="truncate px-1 py-0.5" title={formatAsiento(row)}>
                      {formatAsiento(row)}
                    </td>
                    <td
                      className="max-w-[260px] truncate px-1 py-0.5"
                      title={formatMovimientoCuenta(row)}
                    >
                      {formatMovimientoCuenta(row)}
                    </td>
                    <td className="whitespace-normal break-words px-1 py-0.5 leading-tight" title={row.descripcion ?? ""}>
                      {row.descripcion ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-1 py-0.5 text-right tabular-nums">
                      {formatCurrency(row.debe)}
                    </td>
                    <td className="whitespace-nowrap px-1 py-0.5 text-right tabular-nums">
                      {formatCurrency(row.haber)}
                    </td>
                    <td className="whitespace-nowrap px-1 py-0.5 text-right tabular-nums">
                      {formatCurrency(Number(row.debe ?? 0) + Number(row.haber ?? 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-muted">
              <tr className="border-t border-border">
                <th colSpan={4} className="px-1 py-0.5 text-right font-semibold">Total</th>
                <td className="whitespace-nowrap px-1 py-0.5 text-right font-semibold tabular-nums">
                  {formatCurrency(data?.total_debe ?? 0)}
                </td>
                <td className="whitespace-nowrap px-1 py-0.5 text-right font-semibold tabular-nums">
                  {formatCurrency(data?.total_haber ?? 0)}
                </td>
                <td className="whitespace-nowrap px-1 py-0.5 text-right font-semibold tabular-nums">
                  {formatCurrency((data?.total_debe ?? 0) + (data?.total_haber ?? 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
