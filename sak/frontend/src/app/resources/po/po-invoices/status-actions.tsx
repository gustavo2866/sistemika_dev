"use client";

import { useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

export type PoInvoiceApprovalAction = "approve" | "reject";

export type PoInvoiceApprovalRecord = {
  id?: number | string;
  titulo?: string | null;
  numero?: string | null;
  total?: number | null;
  proveedor_id?: number | null;
  usuario_responsable_id?: number | null;
  invoice_status_id?: number | null;
  invoice_status_fin_id?: number | null;
  proveedor?: { nombre?: string | null } | null;
  usuario_responsable?: { nombre?: string | null } | null;
  invoice_status?: { nombre?: string | null; orden?: number | null } | null;
  invoice_status_fin?: { nombre?: string | null; orden?: number | null } | null;
};

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

const resolveStatusCandidates = (action: PoInvoiceApprovalAction) =>
  action === "approve"
    ? ["aprobada", "aprobado", "Aprobada", "Aprobado"]
    : ["rechazada", "rechazado", "Rechazada", "Rechazado"];

export const getPoInvoiceApprovalLabel = (action: PoInvoiceApprovalAction) =>
  action === "approve" ? "Aprobar" : "Rechazar";

const resolveStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  action: PoInvoiceApprovalAction,
) => {
  const candidates = resolveStatusCandidates(action);
  for (const candidate of candidates) {
    const { data } = await dataProvider.getList("po-invoice-status", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { nombre: candidate },
    });
    const status = data?.[0];
    if (status?.id) {
      return { id: status.id as number, nombre: status.nombre as string };
    }
  }
  return null;
};

const resolveStatusFinId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  action: PoInvoiceApprovalAction,
) => {
  const orden = action === "approve" ? 2 : 5;
  const { data } = await dataProvider.getList("po-invoice-status-fin", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "orden", order: "ASC" },
    filter: { orden },
  });
  const status = data?.[0];
  if (status?.id) {
    return { id: status.id as number, nombre: status.nombre as string };
  }
  return null;
};

export const canResolvePoInvoice = (
  record?: Pick<PoInvoiceApprovalRecord, "invoice_status"> | null,
) => normalizeStatusName(record?.invoice_status?.nombre) === "confirmada";

const getProveedorLabel = (record?: PoInvoiceApprovalRecord | null) =>
  record?.proveedor?.nombre ??
  (record as { proveedor_nombre?: string } | undefined)?.proveedor_nombre ??
  (record?.proveedor_id ? `#${record.proveedor_id}` : "Sin proveedor");

const getResponsableLabel = (record?: PoInvoiceApprovalRecord | null) =>
  record?.usuario_responsable?.nombre ??
  (record as { responsable_nombre?: string } | undefined)?.responsable_nombre ??
  (record?.usuario_responsable_id ? `#${record.usuario_responsable_id}` : "Sin responsable");

export const buildPoInvoiceApprovalConfirmContent = (
  record: PoInvoiceApprovalRecord | null | undefined,
  action: PoInvoiceApprovalAction,
) => {
  const label = getPoInvoiceApprovalLabel(action);

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas {label.toLowerCase()} la factura?</p>
      <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Numero:</span>{" "}
          {record?.numero ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Titulo:</span>{" "}
          {record?.titulo ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Proveedor:</span>{" "}
          {getProveedorLabel(record)}
        </div>
        <div>
          <span className="font-semibold text-foreground">Responsable:</span>{" "}
          {getResponsableLabel(record)}
        </div>
        <div>
          <span className="font-semibold text-foreground">Estado:</span>{" "}
          {record?.invoice_status?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Monto:</span>{" "}
          {formatCurrency(Number(record?.total ?? 0))}
        </div>
      </div>
    </div>
  );
};

export const runPoInvoiceApprovalAction = async ({
  action,
  dataProvider,
  record,
  resource,
}: {
  action: PoInvoiceApprovalAction;
  dataProvider: ReturnType<typeof useDataProvider>;
  record: PoInvoiceApprovalRecord;
  resource: string;
}) => {
  if (!record?.id) {
    throw new Error("La factura no tiene identificador.");
  }

  const [status, finStatus] = await Promise.all([
    resolveStatusId(dataProvider, action),
    resolveStatusFinId(dataProvider, action),
  ]);

  if (!status?.id) {
    throw new Error(`No se encontro el estado para ${getPoInvoiceApprovalLabel(action).toLowerCase()}.`);
  }
  if (!finStatus?.id) {
    throw new Error(
      action === "approve"
        ? "No se encontro el estado financiero Agendada."
        : "No se encontro el estado financiero Cancelada.",
    );
  }

  await dataProvider.update(resource, {
    id: record.id,
    data: {
      invoice_status_id: status.id,
      invoice_status_fin_id: finStatus.id,
    },
    previousData: record,
  });

  return { status, finStatus };
};

export const PoInvoiceApprovalButtons = ({
  className,
  fullWidth = false,
  layout = "default",
  onResolved,
  record,
  resource = "po-invoices",
  size = "sm",
}: {
  className?: string;
  fullWidth?: boolean;
  layout?: "default" | "compact";
  onResolved?: (action: PoInvoiceApprovalAction) => void;
  record: PoInvoiceApprovalRecord | null | undefined;
  resource?: string;
  size?: "sm" | "default" | "lg" | "icon";
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingAction, setPendingAction] = useState<PoInvoiceApprovalAction | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmContent = useMemo(() => {
    if (!pendingAction) return null;
    return buildPoInvoiceApprovalConfirmContent(record, pendingAction);
  }, [pendingAction, record]);

  if (!record?.id || !canResolvePoInvoice(record)) return null;

  const handleConfirm = async () => {
    if (!pendingAction || !record?.id) return;
    setLoading(true);
    try {
      await runPoInvoiceApprovalAction({
        action: pendingAction,
        dataProvider,
        record,
        resource,
      });
      notify(
        `Factura ${pendingAction === "approve" ? "aprobada" : "rechazada"}`,
        { type: "info" },
      );
      onResolved?.(pendingAction);
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "No se pudo actualizar la factura",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center",
          layout === "compact" ? "gap-1.5" : "gap-2",
          className,
        )}
      >
        <Button
          type="button"
          size={size}
          disabled={loading}
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("approve");
          }}
          className={cn(
            layout === "compact"
              ? "h-8 rounded-full bg-sky-600 px-3 text-[13px] text-white hover:bg-sky-700"
              : "bg-sky-600 text-white hover:bg-sky-700",
            fullWidth && layout !== "compact" && "flex-1",
          )}
        >
          <CheckCircle2 className={cn("mr-1 h-4 w-4", layout === "compact" && "mr-0.5 h-3.5 w-3.5")} />
          Aprobar
        </Button>
        <Button
          type="button"
          size={size}
          variant={layout === "compact" ? "ghost" : "outline"}
          disabled={loading}
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("reject");
          }}
          className={cn(
            layout === "compact"
              ? "h-8 rounded-full px-2 text-[13px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              : "border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700",
            fullWidth && layout !== "compact" && "flex-1",
          )}
        >
          <XCircle className={cn("mr-1 h-4 w-4", layout === "compact" && "mr-0.5 h-3.5 w-3.5")} />
          Rechazar
        </Button>
      </div>
      <Confirm
        isOpen={Boolean(pendingAction)}
        onClose={() => {
          if (loading) return;
          setPendingAction(null);
        }}
        onConfirm={handleConfirm}
        title={`${pendingAction ? getPoInvoiceApprovalLabel(pendingAction) : "Confirmar"} factura`}
        content={confirmContent ?? ""}
        confirm={pendingAction ? getPoInvoiceApprovalLabel(pendingAction) : "Confirmar"}
        confirmColor={pendingAction === "reject" ? "warning" : "primary"}
        loading={loading}
      />
    </>
  );
};
