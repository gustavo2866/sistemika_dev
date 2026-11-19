"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  fecha_desde: string | null;
  fecha_hasta: string | null;
  count: number;
  importe_total: string;
  data: PendingProjectionDetailRow[];
};

export type CashPendingProjectionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaCashId: number | null;
  cuentaCashNombre: string;
  dueDateFrom?: string;
  dueDateTo?: string;
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

const escapeXml = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const exportPendingDetailToXls = (detail: PendingProjectionDetailResponse) => {
  const cell = (value: unknown, type = "String", style = "") =>
    `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
  const headers = ["Empresa", "Comprobante", "Cuenta", "Descripción", "Subcuenta", "Vencimiento", "Saldo", "Cuenta Cash"];
  const rows = detail.data.map((row) => `<Row>${[
    cell(row.empresa || "-"),
    cell(joinValues(row.tipcomp, row.nrocomp, row.nombre)),
    cell(joinValues(row.nrocta, row.cuenta_codigo, row.cuenta_nombre)),
    cell(row.descripcion || "-"),
    cell(joinValues(row.tipsub, row.nrosub, row.subcuenta_nombre)),
    cell(`${row.fecha_vencimiento}T00:00:00.000`, "DateTime", "Date"),
    cell(row.saldo, "Number", "Amount"),
    cell(detail.cuenta_cash_nombre),
  ].join("")}</Row>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Date"><NumberFormat ss:Format="dd/mm/yyyy"/></Style>
    <Style ss:ID="Amount"><NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/></Style>
  </Styles>
  <Worksheet ss:Name="Pendientes"><Table>
    ${[80, 180, 200, 300, 220, 90, 110, 200].map((width) => `<Column ss:Width="${width}"/>`).join("")}
    <Row><Cell ss:MergeAcross="7"><Data ss:Type="String">${escapeXml(`Comprobantes pendientes · ${detail.cuenta_cash_nombre}`)}</Data></Cell></Row>
    <Row><Cell ss:MergeAcross="7"><Data ss:Type="String">${escapeXml(`Vencimiento: ${detail.fecha_desde ? formatDate(detail.fecha_desde) : "sin límite inicial"} al ${detail.fecha_hasta ? formatDate(detail.fecha_hasta) : "sin límite final"} · ${detail.count} comprobantes`)}</Data></Cell></Row>
    <Row>${headers.map((header) => cell(header, "String", "Header")).join("")}</Row>
    ${rows}
    <Row><Cell ss:MergeAcross="5"><Data ss:Type="String">Total</Data></Cell>${cell(detail.importe_total, "Number", "Amount")}<Cell/></Row>
  </Table></Worksheet>
</Workbook>`;
  const url = URL.createObjectURL(new Blob(["\uFEFF", xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cash_pendientes_${detail.cuenta_cash_id}_${detail.fecha_desde || "todos"}_${detail.fecha_hasta || "todos"}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const fetchPendingProjectionDetail = async (
  cuentaCashId: number,
  dueDateFrom?: string,
  dueDateTo?: string,
): Promise<PendingProjectionDetailResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({
    cuenta_cash_id: String(cuentaCashId),
  });
  if (dueDateFrom) params.set("fecha_desde", dueDateFrom);
  if (dueDateTo) params.set("fecha_hasta", dueDateTo);
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const query = useQuery({
    queryKey: [
      "erp-cash-pending-projection-detail",
      cuentaCashId,
      dueDateFrom,
      dueDateTo,
    ],
    queryFn: () =>
      fetchPendingProjectionDetail(cuentaCashId!, dueDateFrom, dueDateTo),
    enabled: open && cuentaCashId !== null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        className="grid max-h-[84vh] !w-[96vw] !max-w-[1080px] grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
        <DialogHeader className="gap-0.5 pr-36">
          <DialogTitle className="text-sm font-semibold">
            Comprobantes pendientes · {cuentaCashNombre}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 text-[9px]">
            <span>
              {dueDateFrom && dueDateTo
                ? `Vencimiento: ${formatDate(dueDateFrom)} al ${formatDate(dueDateTo)}`
                : dueDateFrom
                  ? `Vencimiento desde ${formatDate(dueDateFrom)}`
                  : dueDateTo
                    ? `Vencimiento hasta ${formatDate(dueDateTo)}`
                    : "Todos los pendientes de la cuenta"}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-12 top-3 h-7 gap-1 px-2 text-[10px]"
          disabled={!query.data?.data.length || query.isFetching || Boolean(query.error)}
          onClick={() => { if (query.data) exportPendingDetailToXls(query.data); }}
        >
          <FileSpreadsheet className="size-3" /> Exportar XLS
        </Button>

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
            <table className="w-full min-w-[1120px] table-fixed border-collapse text-[9px] leading-tight">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[8px] uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr className="[&>th]:border-b [&>th]:px-1.5 [&>th]:py-1 [&>th]:text-left">
                  <th className="w-[70px]">Empresa</th>
                  <th className="w-[180px]">Comprob.</th>
                  <th className="w-[150px]">Cuenta</th>
                  <th className="w-[180px]">Descripción</th>
                  <th>Subcuenta</th>
                  <th className="w-[76px]">Venc.</th>
                  <th className="w-[92px] !text-right">Saldo</th>
                  <th className="w-[150px]">Cuenta Cash</th>
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
                    <td className="break-words" title={query.data.cuenta_cash_nombre}>
                      {query.data.cuenta_cash_nombre}
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
