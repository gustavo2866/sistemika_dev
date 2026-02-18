"use client";

import { useMemo, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import { formatCurrency } from "@/lib/formatters";
import type { PoInvoiceFormValues } from "./model";
import { useRowActionDialog } from "@/components/forms/form_order";

const resolveStatusFinId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  orden: number,
) => {
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

export const FormAutorizar = ({
  disabled,
  visible = true,
}: {
  disabled?: boolean;
  visible?: boolean;
}) => {
  const record = useRecordContext<
    PoInvoiceFormValues & {
      id?: number;
      proveedor?: { nombre?: string };
      invoice_status_fin?: { nombre?: string; orden?: number | null };
    }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-invoices";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRowActionDialog();

  const totalLabel = useMemo(
    () => formatCurrency(Number(record?.total ?? 0)),
    [record?.total],
  );

  const finOrden = record?.invoice_status_fin?.orden;
  const isAgendada = Number(finOrden) === 2;

  if (!record?.id || !visible || !isAgendada) return null;

  const runConfirm = async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      const finStatus = await resolveStatusFinId(dataProvider, 3);
      if (!finStatus?.id) {
        notify("No se encontro el estado financiero Autorizada", {
          type: "warning",
        });
        return;
      }
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          invoice_status_fin_id: finStatus.id,
        },
        previousData: record,
      });
      notify("Factura autorizada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo autorizar la factura", { type: "warning" });
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
  const estadoLabel = record?.invoice_status_fin?.nombre ?? "-";

  const confirmContent = (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas autorizar la factura?</p>
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
          <span className="font-semibold text-foreground">Agenda:</span>{" "}
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
              title: "Autorizar factura",
              content: confirmContent,
              confirmLabel: "Autorizar",
              confirmColor: "primary",
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
        <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Autorizar
      </DropdownMenuItem>
      {!dialog ? (
        <Confirm
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Autorizar factura"
          content={confirmContent}
          confirm="Autorizar"
          confirmColor="primary"
          loading={loading}
        />
      ) : null}
    </>
  );
};
