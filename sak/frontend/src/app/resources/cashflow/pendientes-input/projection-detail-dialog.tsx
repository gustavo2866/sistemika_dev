"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiUrl } from "@/lib/dataProvider";

type PendingProjectionDetailRow = {
  id: number | string;
  empresa?: string | null;
  tipcomp?: string | null;
  nrocomp?: string | null;
  nombre?: string | null;
  nrocta?: string | null;
  cuenta_codigo?: string | null;
  cuenta_nombre?: string | null;
  descripcion?: string | null;
  tipsub?: string | null;
  nrosub?: string | null;
  subcuenta_nombre?: string | null;
  fecha_vencimiento: string;
  saldo: string;
};

type PendingProjectionDetailResponse = {
  cuenta_cash_id: number;
  cuenta_cash_nombre: string;
  fecha_desde: string;
  fecha_hasta: string;
  count: number;
  importe_total: string;
  data: PendingProjectionDetailRow[];
};

export type CashPendingProjectionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaCashId: number | null;
  cuentaCashNombre: string;
  dueDateFrom: string;
  dueDateTo: string;
};

const joinValues = (...values: Array<string | null | undefined>) => {
  const parts = values.map((value) => value?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "-";
};

const formatDate = (value: string) => {
  if (!value) return "-";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR").format(parsed);
};

const formatAmount = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : value;
};

const fetchPendingProjectionDetail = async (
  cuentaCashId: number,
  dueDateFrom: string,
  dueDateTo: string,
): Promise<PendingProjectionDetailResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({
    cuenta_cash_id: String(cuentaCashId),
    fecha_desde: dueDateFrom,
    fecha_hasta: dueDateTo,
  });
  const response = await fetch(
    `${apiUrl}/erp/cash/pendientes-input/pending-projection/detail?${params}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "No se pudo cargar el detalle pendiente",
    );
  }
  return result as PendingProjectionDetailResponse;
};

export const CashPendingProjectionDetailDialog = ({
  open,
  onOpenChange,
  cuentaCashId,
  cuentaCashNombre,
  dueDateFrom,
  dueDateTo,
}: CashPendingProjectionDetailDialogProps) => {
  const query = useQuery({
    queryKey: [
      "erp-cash-pending-projection-detail",
      cuentaCashId,
      dueDateFrom,
      dueDateTo,
    ],
    queryFn: () =>
      fetchPendingProjectionDetail(cuentaCashId!, dueDateFrom, dueDateTo),
    enabled: open && cuentaCashId !== null && Boolean(dueDateFrom && dueDateTo),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[84vh] !w-[96vw] !max-w-[1080px] grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
        <DialogHeader className="gap-0.5">
          <DialogTitle className="text-sm font-semibold">
            Comprobantes pendientes · {cuentaCashNombre}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 text-[9px]">
            <span>
              Vencimiento: {formatDate(dueDateFrom)} al {formatDate(dueDateTo)}
            </span>
            {query.data ? (
              <>
                <span>· {query.data.count} comprobantes</span>
                <span className="font-semibold text-foreground">
                  · Total {formatAmount(query.data.importe_total)}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto rounded-md border">
          {query.isLoading ? (
            <div className="flex min-h-32 items-center justify-center text-[10px] text-muted-foreground">
              <Loader2 className="mr-1.5 size-3 animate-spin" />
              Cargando comprobantes…
            </div>
          ) : query.error ? (
            <div className="flex min-h-32 items-center justify-center px-3 text-[10px] text-destructive">
              {query.error instanceof Error
                ? query.error.message
                : "No se pudo cargar el detalle"}
            </div>
          ) : query.data?.data.length ? (
            <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[8px] uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr className="[&>th]:border-b [&>th]:px-1.5 [&>th]:py-1 [&>th]:text-left">
                  <th className="w-[70px]">Empresa</th>
                  <th className="w-[180px]">Comprob.</th>
                  <th className="w-[150px]">Cuenta</th>
                  <th className="w-[180px]">Descripción</th>
                  <th>Subcuenta</th>
                  <th className="w-[76px]">Venc.</th>
                  <th className="w-[92px] !text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child_td]:border-b-0">
                {query.data.data.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-950/50 [&>td]:border-b [&>td]:px-1.5 [&>td]:py-1"
                  >
                    <td className="break-words font-medium">{row.empresa || "-"}</td>
                    <td>
                      <div className="font-medium">
                        {joinValues(row.tipcomp, row.nrocomp)}
                      </div>
                      <div className="break-words text-[8px] text-muted-foreground">
                        {row.nombre || "-"}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium">
                        {joinValues(row.nrocta, row.cuenta_codigo)}
                      </div>
                      <div className="break-words text-[8px] text-muted-foreground">
                        {row.cuenta_nombre || "-"}
                      </div>
                    </td>
                    <td className="w-[180px] whitespace-normal break-words">
                      {row.descripcion || "-"}
                    </td>
                    <td>
                      <div className="font-medium">
                        {joinValues(row.tipsub, row.nrosub)}
                      </div>
                      <div className="break-words text-[8px] text-muted-foreground">
                        {row.subcuenta_nombre || "-"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {formatDate(row.fecha_vencimiento)}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatAmount(row.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex min-h-32 items-center justify-center text-[10px] text-muted-foreground">
              No hay comprobantes para este período.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CashPendingProjectionDetailDialog;
