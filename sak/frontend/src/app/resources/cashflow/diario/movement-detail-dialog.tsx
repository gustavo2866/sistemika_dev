"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import { CashSubcuentaEditDialog, type CashSubcuentaTarget } from "../subctas/edit-dialog";

type DetailMovement = {
  id: number;
  empresa_id: number;
  fecha: string;
  tipo_asiento?: string | null;
  nro_asiento?: string | null;
  nro_renglon?: string | null;
  cuenta_codigo: number;
  cuenta_cash_id: number | null;
  cuenta_cash_nombre: string | null;
  tipo_subcuenta?: string | null;
  nro_subcuenta?: string | null;
  descripcion?: string | null;
  debe: number;
  haber: number;
  importe: number;
};
type PanelDetailResponse = {
  periodo: string;
  movement_count: number;
  movements: DetailMovement[];
  total: number;
};
export type CashMovementDetailTarget = {
  month: string;
  title: string;
  scope: "total" | "group" | "account" | "ledger";
  groupKey?: "INGRESOS" | "EGRESOS" | "SIN_CUENTA" | "FONDOS";
  cuentaCashId?: number | null;
  cuentaCodigo?: number;
  importeMode?: "cash" | "saldo";
};
const DETAIL_SCOPE_LABELS: Record<CashMovementDetailTarget["scope"], string> = {
  total: "Total del período",
  group: "Grupo Cash",
  account: "Cuenta financiera",
  ledger: "Cuenta contable",
};
const periodToDate = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const formatPeriodLabel = (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(period)) return "—";
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(periodToDate(period));
};

const formatExactAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const escapeXml = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const safeFileName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 80);

const downloadXls = (xml: string, fileName: string) => {
  const blob = new Blob(["\uFEFF", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const exportDetailToXls = (target: CashMovementDetailTarget, detail: PanelDetailResponse) => {
  const scopeLabel = DETAIL_SCOPE_LABELS[target.scope];
  const rows = detail.movements.map((movement) => {
    const asiento = [movement.tipo_asiento, movement.nro_asiento, movement.nro_renglon]
      .filter(Boolean)
      .join(" / ");
    const subcuenta = [movement.tipo_subcuenta, movement.nro_subcuenta]
      .filter(Boolean)
      .join(" / ");
    return `
      <Row>
        <Cell ss:StyleID="Date"><Data ss:Type="DateTime">${escapeXml(`${movement.fecha}T00:00:00.000`)}</Data></Cell>
        <Cell><Data ss:Type="Number">${movement.empresa_id}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(asiento || "-")}</Data></Cell>
        <Cell><Data ss:Type="Number">${movement.cuenta_codigo}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(subcuenta || "-")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(movement.descripcion || "-")}</Data></Cell>
        <Cell ss:StyleID="Amount"><Data ss:Type="Number">${movement.debe}</Data></Cell>
        <Cell ss:StyleID="Amount"><Data ss:Type="Number">${movement.haber}</Data></Cell>
        <Cell ss:StyleID="Amount"><Data ss:Type="Number">${movement.importe}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(movement.cuenta_cash_nombre || "Sin cuenta Cash")}</Data></Cell>
      </Row>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="10"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#334155" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Meta"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F766E" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Date"><NumberFormat ss:Format="dd/mm/yyyy"/></Style>
  <Style ss:ID="Amount"><NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/></Style>
  <Style ss:ID="TotalLabel"><Alignment ss:Horizontal="Right"/><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TotalAmount"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Movimientos">
  <Table>
   <Column ss:Width="75"/><Column ss:Width="45"/><Column ss:Width="120"/><Column ss:Width="65"/><Column ss:Width="100"/><Column ss:Width="280"/><Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="90"/>
   <Column ss:Width="180"/>
   <Row ss:Height="24"><Cell ss:StyleID="Title" ss:MergeAcross="9"><Data ss:Type="String">${escapeXml(target.title)}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Meta" ss:MergeAcross="9"><Data ss:Type="String">Período: ${escapeXml(target.month)} · Nivel: ${escapeXml(scopeLabel)} · Movimientos: ${detail.movement_count}</Data></Cell></Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Empresa</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Asiento / renglón</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Subcuenta</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Descripción</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Debe</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Haber</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Importe</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta Cash</Data></Cell>
   </Row>${rows}
   <Row>
    <Cell ss:StyleID="TotalLabel" ss:MergeAcross="7"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="TotalAmount"><Data ss:Type="Number">${detail.total}</Data></Cell>
    <Cell ss:StyleID="TotalLabel"/>
   </Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
 </Worksheet>
</Workbook>`;

  downloadXls(xml, `cash_${target.month}_${safeFileName(target.title) || "detalle"}.xls`);
};

const fetchPanelDetail = async (target: CashMovementDetailTarget): Promise<PanelDetailResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({ periodo: target.month });
  if (target.groupKey) params.set("group_key", target.groupKey);
  if (
    (target.scope === "account" || target.scope === "ledger")
    && Object.prototype.hasOwnProperty.call(target, "cuentaCashId")
  ) {
    params.set("cuenta_cash_id", target.cuentaCashId == null ? "null" : String(target.cuentaCashId));
  }
  if (target.cuentaCodigo != null) params.set("cuenta_codigo", String(target.cuentaCodigo));
  if (target.importeMode) params.set("importe_mode", target.importeMode);

  const response = await fetch(`${apiUrl}/erp/cash/panel/detail?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "No se pudo cargar el detalle contable");
  return payload as PanelDetailResponse;
};

export type CashMovementDetailDialogProps = {
  target: CashMovementDetailTarget | null;
  onClose: () => void;
};

export const CashMovementDetailDialog = ({ target: detailTarget, onClose }: CashMovementDetailDialogProps) => {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [subcuentaTarget, setSubcuentaTarget] = useState<CashSubcuentaTarget | null>(null);
  const detailQuery = useQuery({
    queryKey: ["erp-cash-panel-detail", detailTarget],
    queryFn: () => fetchPanelDetail(detailTarget!),
    enabled: detailTarget !== null,
  });
  const detailScopeLabel = detailTarget ? DETAIL_SCOPE_LABELS[detailTarget.scope] : "";

  return (
    <>
      <Dialog open={detailTarget !== null} onOpenChange={(open) => {
        if (!open) { setSubcuentaTarget(null); onClose(); }
      }}>
        <DialogContent
          onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          className="grid h-[80vh] !w-[96vw] !max-w-[1200px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
          <DialogHeader className="pr-36">
            <DialogTitle className="text-base">{detailTarget?.title ?? "Detalle contable"}</DialogTitle>
            <DialogDescription className="capitalize">
              {detailTarget ? formatPeriodLabel(detailTarget.month) : ""}
              {detailScopeLabel ? ` · ${detailScopeLabel}` : ""}
              {detailQuery.data ? ` · ${detailQuery.data.movement_count} movimientos` : ""}
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-12 top-3 h-8 text-xs"
            disabled={!detailTarget || !detailQuery.data?.movements.length || detailQuery.isFetching}
            onClick={() => {
              if (detailTarget && detailQuery.data) exportDetailToXls(detailTarget, detailQuery.data);
            }}
          >
            <FileSpreadsheet className="mr-1 size-3.5" /> Exportar XLS
          </Button>

          <div className="min-h-0 overflow-auto rounded-md border">
            {detailQuery.isLoading ? (
              <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="mr-2 size-4 animate-spin" /> Cargando detalle…
              </div>
            ) : detailQuery.error ? (
              <div className="flex h-full min-h-40 items-center justify-center p-4 text-sm text-destructive">
                {detailQuery.error instanceof Error ? detailQuery.error.message : "No se pudo cargar el detalle"}
              </div>
            ) : !detailQuery.data?.movements.length ? (
              <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                No hay movimientos para este importe.
              </div>
            ) : (
              <table className="w-full min-w-[1200px] border-collapse text-[10px]">
                <thead className="sticky top-0 z-10 bg-background text-[9px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="border-b px-2 py-2 text-left">Fecha</th>
                    <th className="border-b px-2 py-2 text-right">Emp.</th>
                    <th className="border-b px-2 py-2 text-left">Asiento / renglón</th>
                    <th className="border-b px-2 py-2 text-right">Cuenta</th>
                    <th className="border-b px-2 py-2 text-left">Subcuenta</th>
                    <th className="border-b px-2 py-2 text-left">Descripción</th>
                    <th className="border-b px-2 py-2 text-right">Debe</th>
                    <th className="border-b px-2 py-2 text-right">Haber</th>
                    <th className="border-b px-2 py-2 text-right">Importe</th>
                    <th className="border-b px-2 py-2 text-left">Cuenta Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {detailQuery.data.movements.map((movement) => {
                    const tipo = String(movement.tipo_subcuenta ?? "").trim();
                    const numero = String(movement.nro_subcuenta ?? "").trim();
                    const editable = /^\d+$/.test(tipo) && /^\d+$/.test(numero)
                      && Number.isSafeInteger(Number(tipo)) && Number.isSafeInteger(Number(numero));
                    const subcuentaLabel = [tipo, numero].filter(Boolean).join(" / ") || "-";
                    return (
                    <tr key={movement.id} className="border-t hover:bg-muted/25">
                      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(movement.fecha)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{movement.empresa_id}</td>
                      <td className="max-w-[150px] truncate px-2 py-1.5" title={[movement.tipo_asiento, movement.nro_asiento, movement.nro_renglon].filter(Boolean).join(" / ")}>
                        {[movement.tipo_asiento, movement.nro_asiento, movement.nro_renglon].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{movement.cuenta_codigo}</td>
                      <td className="max-w-[120px] truncate px-2 py-1.5" title={subcuentaLabel}>
                        {editable ? (
                          <button
                            type="button"
                            className="rounded text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline focus-visible:outline-2"
                            aria-label={`Editar subcuenta ${subcuentaLabel}`}
                            onClick={() => setSubcuentaTarget({ tipo: Number(tipo), numero: Number(numero) })}
                          >
                            {subcuentaLabel}
                          </button>
                        ) : subcuentaLabel}
                      </td>
                      <td className="max-w-[280px] truncate px-2 py-1.5" title={movement.descripcion ?? ""}>{movement.descripcion || "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatExactAmount(movement.debe)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatExactAmount(movement.haber)}</td>
                      <td className={cn("px-2 py-1.5 text-right font-medium tabular-nums", movement.importe < 0 && "text-rose-700")}>
                        {formatExactAmount(movement.importe)}
                      </td>
                      <td className="max-w-[200px] truncate px-2 py-1.5" title={movement.cuenta_cash_nombre || "Sin cuenta Cash"}>
                        {movement.cuenta_cash_nombre || "Sin cuenta Cash"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 bg-background font-semibold">
                  <tr>
                    <td colSpan={8} className="px-2 py-2 text-right">Total</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", detailQuery.data.total < 0 && "text-rose-700")}>
                      {formatExactAmount(detailQuery.data.total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {detailTarget && subcuentaTarget && <CashSubcuentaEditDialog
        key={`${subcuentaTarget.tipo}-${subcuentaTarget.numero}`}
        target={subcuentaTarget}
        onClose={() => setSubcuentaTarget(null)}
      />}
    </>
  );
};
