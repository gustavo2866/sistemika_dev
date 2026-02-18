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
import type { PoInvoiceFormValues } from "./model";
import { useRowActionDialog } from "@/components/forms/form_order";

type ApproveAction = "approve" | "reject";

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

const resolveStatusCandidates = (action: ApproveAction) =>
  action === "approve"
    ? ["aprobada", "aprobado", "Aprobada", "Aprobado"]
    : ["rechazada", "rechazado", "Rechazada", "Rechazado"];

const resolveStatusLabel = (action: ApproveAction) =>
  action === "approve" ? "Aprobar" : "Rechazar";

const resolveStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  action: ApproveAction,
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
  action: ApproveAction,
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

export const FormAprobar = ({
  action,
  disabled,
  visible = true,
}: {
  action: ApproveAction;
  disabled?: boolean;
  visible?: boolean;
}) => {
  const record = useRecordContext<
    PoInvoiceFormValues & {
      id?: number;
      proveedor?: { nombre?: string };
      invoice_status?: { nombre?: string; orden?: number | null };
    }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-invoices";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRowActionDialog();

  const label = resolveStatusLabel(action);

  const totalLabel = useMemo(
    () => formatCurrency(Number(record?.total ?? 0)),
    [record?.total],
  );

  const statusKey = normalizeStatusName(record?.invoice_status?.nombre);
  const statusOrden = record?.invoice_status?.orden;
  const isConfirmada = statusKey === "confirmada" && Number(statusOrden) === 2;

  if (!record?.id || !visible || !isConfirmada) return null;

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
      const finStatus = await resolveStatusFinId(dataProvider, action);
      if (!finStatus?.id) {
        notify(
          action === "approve"
            ? "No se encontro el estado financiero Agendada"
            : "No se encontro el estado financiero Cancelada",
          { type: "warning" },
        );
        return;
      }
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          invoice_status_id: status.id,
          invoice_status_fin_id: finStatus.id,
        },
        previousData: record,
      });
      notify(`Factura ${action === "approve" ? "aprobada" : "rechazada"}`, {
        type: "info",
      });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la factura", { type: "warning" });
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
  const estadoLabel = record?.invoice_status?.nombre ?? "-";

  const confirmContent = (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas {label.toLowerCase()} la factura?</p>
      <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Titulo:</span>{" "}
          {record?.titulo ?? "-"}
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
              title: `${label} factura`,
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
          title={`${label} factura`}
          content={confirmContent}
          confirm={label}
          confirmColor={action === "reject" ? "warning" : "primary"}
          loading={loading}
        />
      ) : null}
    </>
  );
};
