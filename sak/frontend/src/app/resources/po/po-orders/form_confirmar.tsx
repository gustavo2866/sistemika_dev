"use client";

import { useMemo, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import { formatCurrency } from "@/lib/formatters";
import type { PoOrderFormValues } from "./model";
import { useRowActionDialog } from "@/components/forms/form_order";

type ConfirmAction = "approve" | "reject";

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

const resolveStatusCandidates = (action: ConfirmAction) =>
  action === "approve"
    ? ["aprobada", "aprobado", "Aprobada", "Aprobado"]
    : ["rechazada", "rechazado", "Rechazada", "Rechazado"];

const resolveStatusLabel = (action: ConfirmAction) =>
  action === "approve" ? "Aprobar" : "Rechazar";

const resolveStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  action: ConfirmAction,
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

export const FormConfirmar = ({
  action,
  disabled,
  visible = true,
}: {
  action: ConfirmAction;
  disabled?: boolean;
  visible?: boolean;
}) => {
  const record = useRecordContext<PoOrderFormValues & { id?: number; proveedor?: { nombre?: string }; solicitante?: { nombre?: string }; order_status?: { nombre?: string } }>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-orders";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRowActionDialog();

  const label = resolveStatusLabel(action);

  const totalLabel = useMemo(
    () => formatCurrency(Number(record?.total ?? 0)),
    [record?.total]
  );

  const statusKey = normalizeStatusName(record?.order_status?.nombre);
  const isEmitida = statusKey === "emitida";

  if (!record?.id || !visible || !isEmitida) return null;

  const runConfirm = async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      const status = await resolveStatusId(dataProvider, action);
      if (!status?.id) {
        notify(`No se encontró el estado para ${label.toLowerCase()}`, {
          type: "warning",
        });
        return;
      }
      await dataProvider.update(resource, {
        id: record.id,
        data: { order_status_id: status.id },
        previousData: record,
      });
      notify(`Orden ${action === "approve" ? "aprobada" : "rechazada"}`, {
        type: "info",
      });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la orden", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    await runConfirm();
    setOpen(false);
  };

  const proveedorLabel =
    record?.proveedor?.nombre ??
    (record as any)?.proveedor_nombre ??
    (record?.proveedor_id ? `#${record.proveedor_id}` : "Sin proveedor");
  const solicitanteLabel =
    record?.solicitante?.nombre ??
    (record as any)?.solicitante_nombre ??
    (record?.solicitante_id ? `#${record.solicitante_id}` : "Sin solicitante");
  const estadoLabel = record?.order_status?.nombre ?? "-";

  const confirmContent = (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas {label.toLowerCase()} la orden?</p>
      <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Titulo:</span>{" "}
          {record?.titulo ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Solicitante:</span>{" "}
          {solicitanteLabel}
        </div>
        <div>
          <span className="font-semibold text-foreground">Proveedor:</span>{" "}
          {proveedorLabel}
        </div>
        <div>
          <span className="font-semibold text-foreground">Estado:</span>{" "}
          {estadoLabel}
        </div>
        <div>
          <span className="font-semibold text-foreground">Monto:</span>{" "}
          {totalLabel}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.stopPropagation();
          if (disabled || loading) return;
          if (dialog) {
            dialog.openDialog({
              title: `${label} orden`,
              content: confirmContent,
              confirmLabel: label,
              confirmColor: action === "reject" ? "warning" : "primary",
              onConfirm: runConfirm,
            });
            return;
          }
          setOpen(true);
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        disabled={disabled || loading}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        {action === "approve" ? (
          <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        ) : (
          <XCircle className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        )}
        {label}
      </DropdownMenuItem>
      {!dialog ? (
        <Confirm
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title={`${label} orden`}
          content={confirmContent}
          confirm={label}
          confirmColor={action === "reject" ? "warning" : "primary"}
          loading={loading}
        />
      ) : null}
    </>
  );
};
