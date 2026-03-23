"use client";

import { useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

import { ensureCentroCostoIfMissing } from "./form_hooks";
import { type PoOrderFormValues, normalizeStatusName } from "./model";

export type PoOrderApprovalAction = "approve" | "reject";

export type PoOrderApprovalRecord = {
  id?: number | string;
  titulo?: string | null;
  total?: number | null;
  solicitante_id?: number | null;
  proveedor_id?: number | null;
  centro_costo_id?: number | null;
  oportunidad_id?: number | null;
  order_status_id?: number | null;
  proveedor?: { nombre?: string | null } | null;
  solicitante?: { nombre?: string | null } | null;
  order_status?: { nombre?: string | null } | null;
};

const resolveStatusCandidates = (action: PoOrderApprovalAction) =>
  action === "approve"
    ? ["aprobada", "aprobado", "Aprobada", "Aprobado"]
    : ["rechazada", "rechazado", "Rechazada", "Rechazado"];

export const getPoOrderApprovalLabel = (action: PoOrderApprovalAction) =>
  action === "approve" ? "Aprobar" : "Rechazar";

const resolveStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  action: PoOrderApprovalAction,
) => {
  const candidates = resolveStatusCandidates(action);
  for (const candidate of candidates) {
    const { data } = await dataProvider.getList("po-order-status", {
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

export const canResolvePoOrder = (
  record?: Pick<PoOrderApprovalRecord, "order_status"> | null,
) => normalizeStatusName(record?.order_status?.nombre) === "emitida";

const getProveedorLabel = (record?: PoOrderApprovalRecord | null) =>
  record?.proveedor?.nombre ??
  (record as { proveedor_nombre?: string } | undefined)?.proveedor_nombre ??
  (record?.proveedor_id ? `#${record.proveedor_id}` : "Sin proveedor");

const getSolicitanteLabel = (record?: PoOrderApprovalRecord | null) =>
  record?.solicitante?.nombre ??
  (record as { solicitante_nombre?: string } | undefined)?.solicitante_nombre ??
  (record?.solicitante_id ? `#${record.solicitante_id}` : "Sin solicitante");

export const buildPoOrderApprovalConfirmContent = (
  record: PoOrderApprovalRecord | null | undefined,
  action: PoOrderApprovalAction,
) => {
  const label = getPoOrderApprovalLabel(action);

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas {label.toLowerCase()} la orden?</p>
      <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Titulo:</span>{" "}
          {record?.titulo ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Solicitante:</span>{" "}
          {getSolicitanteLabel(record)}
        </div>
        <div>
          <span className="font-semibold text-foreground">Proveedor:</span>{" "}
          {getProveedorLabel(record)}
        </div>
        <div>
          <span className="font-semibold text-foreground">Estado:</span>{" "}
          {record?.order_status?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Monto:</span>{" "}
          {formatCurrency(Number(record?.total ?? 0))}
        </div>
      </div>
    </div>
  );
};

export const runPoOrderApprovalAction = async ({
  action,
  dataProvider,
  record,
  resource,
}: {
  action: PoOrderApprovalAction;
  dataProvider: ReturnType<typeof useDataProvider>;
  record: PoOrderApprovalRecord;
  resource: string;
}) => {
  if (!record?.id) {
    throw new Error("La orden no tiene identificador.");
  }

  const status = await resolveStatusId(dataProvider, action);
  if (!status?.id) {
    throw new Error(`No se encontro el estado para ${getPoOrderApprovalLabel(action).toLowerCase()}.`);
  }

  const resolvedValues = await ensureCentroCostoIfMissing({
    dataProvider,
    values: record as Partial<PoOrderFormValues>,
  });
  const centroId = (resolvedValues as PoOrderFormValues | undefined)?.centro_costo_id;

  await dataProvider.update(resource, {
    id: record.id,
    data: {
      order_status_id: status.id,
      ...(centroId ? { centro_costo_id: centroId } : {}),
    },
    previousData: record,
  });

  return status;
};

export const PoOrderApprovalButtons = ({
  className,
  fullWidth = false,
  layout = "default",
  onResolved,
  record,
  resource = "po-orders",
  size = "sm",
}: {
  className?: string;
  fullWidth?: boolean;
  layout?: "default" | "compact";
  onResolved?: (action: PoOrderApprovalAction) => void;
  record: PoOrderApprovalRecord | null | undefined;
  resource?: string;
  size?: "sm" | "default" | "lg" | "icon";
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingAction, setPendingAction] = useState<PoOrderApprovalAction | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmContent = useMemo(() => {
    if (!pendingAction) return null;
    return buildPoOrderApprovalConfirmContent(record, pendingAction);
  }, [pendingAction, record]);

  if (!record?.id || !canResolvePoOrder(record)) return null;

  const handleConfirm = async () => {
    if (!pendingAction || !record?.id) return;
    setLoading(true);
    try {
      await runPoOrderApprovalAction({
        action: pendingAction,
        dataProvider,
        record,
        resource,
      });
      notify(
        `Orden ${pendingAction === "approve" ? "aprobada" : "rechazada"}`,
        { type: "info" },
      );
      onResolved?.(pendingAction);
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "No se pudo actualizar la orden",
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
              ? "h-8 rounded-full bg-emerald-600 px-3 text-[13px] text-white hover:bg-emerald-700"
              : "bg-emerald-600 text-white hover:bg-emerald-700",
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
        title={`${pendingAction ? getPoOrderApprovalLabel(pendingAction) : "Confirmar"} orden`}
        content={confirmContent ?? ""}
        confirm={pendingAction ? getPoOrderApprovalLabel(pendingAction) : "Confirmar"}
        confirmColor={pendingAction === "reject" ? "warning" : "primary"}
        loading={loading}
      />
    </>
  );
};
