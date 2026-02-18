"use client";

import { useMemo, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
  useSaveContext,
} from "ra-core";
import { CheckCircle2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { useFormContext, useWatch } from "react-hook-form";
import type { PoInvoiceFormValues } from "./model";
import { handleFormTabLoop, useRowActionDialog } from "@/components/forms/form_order";

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

const STATUS_CANDIDATES = ["confirmada", "confirmado", "Confirmada", "Confirmado"] as const;

const resolveStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
) => {
  for (const candidate of STATUS_CANDIDATES) {
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

const resolveStatusByOrden = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  orden: number,
) => {
  const { data } = await dataProvider.getList("po-invoice-status", {
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

const resolveStatusFinByOrden = async (
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

const allDetallesHavePoOrder = (detalles?: Array<any>) =>
  Array.isArray(detalles) &&
  detalles.length > 0 &&
  detalles.every((detalle) => Boolean(detalle?.poOrderDetail_id));

const buttonClasses = "h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px] gap-1";

export const FormConfirmar = ({
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
      invoice_status?: { nombre?: string };
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

  const statusKey = normalizeStatusName(record?.invoice_status?.nombre);
  const isBorrador = statusKey === "borrador";

  if (!record?.id || !visible || !isBorrador) return null;

  const runConfirm = async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      const detalles = (record as any)?.detalles as Array<any> | undefined;
      const allLinked = allDetallesHavePoOrder(detalles);
      const targetStatus = allLinked
        ? await resolveStatusByOrden(dataProvider, 3)
        : await resolveStatusId(dataProvider);
      const targetFin = allLinked
        ? await resolveStatusFinByOrden(dataProvider, 2)
        : await resolveStatusFinByOrden(dataProvider, 1);

      if (!targetStatus?.id) {
        notify(
          allLinked ? "No se encontró el estado Aprobada" : "No se encontró el estado Confirmada",
          { type: "warning" },
        );
        return;
      }
      if (!targetFin?.id) {
        notify(
          allLinked
            ? "No se encontró el estado financiero Agendada"
            : "No se encontró el estado financiero Inicial",
          { type: "warning" },
        );
        return;
      }
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          invoice_status_id: targetStatus.id,
          invoice_status_fin_id: targetFin.id,
        },
        previousData: record,
      });
      notify(allLinked ? "Factura aprobada y agendada" : "Factura confirmada", {
        type: "info",
      });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo confirmar la factura", { type: "warning" });
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
      <p>Seguro que deseas confirmar la factura?</p>
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
              title: "Confirmar factura",
              content: confirmContent,
              confirmLabel: "Confirmar",
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
        Confirmar
      </DropdownMenuItem>
      {!dialog ? (
        <Confirm
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Confirmar factura"
          content={confirmContent}
          confirm="Confirmar"
          confirmColor="primary"
          loading={loading}
        />
      ) : null}
    </>
  );
};

export const FormConfirmarButton = ({
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
      invoice_status?: { nombre?: string };
    }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-invoices";
  const saveContext = useSaveContext();
  const form = useFormContext<PoInvoiceFormValues>();
  const detalles = useWatch({ control: form.control, name: "detalles" }) as
    | Array<unknown>
    | undefined;
  const hasDetalles = Array.isArray(detalles) && detalles.length > 0;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalLabel = useMemo(
    () => formatCurrency(Number(record?.total ?? 0)),
    [record?.total],
  );

  const statusKey = normalizeStatusName(record?.invoice_status?.nombre);
  const isBorrador = statusKey === "borrador";
  const isCreate = !record?.id;

  if (!visible || (!isCreate && !isBorrador)) return null;

  const handleConfirm = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      notify("Completa los campos requeridos", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      const allLinked = allDetallesHavePoOrder(detalles as Array<any> | undefined);
      const targetStatus = allLinked
        ? await resolveStatusByOrden(dataProvider, 3)
        : await resolveStatusId(dataProvider);
      const targetFin = allLinked
        ? await resolveStatusFinByOrden(dataProvider, 2)
        : await resolveStatusFinByOrden(dataProvider, 1);
      if (!targetStatus?.id) {
        notify(
          allLinked ? "No se encontró el estado Aprobada" : "No se encontró el estado Confirmada",
          { type: "warning" },
        );
        return;
      }
      if (!targetFin?.id) {
        notify(
          allLinked
            ? "No se encontró el estado financiero Agendada"
            : "No se encontró el estado financiero Inicial",
          { type: "warning" },
        );
        return;
      }

      if (saveContext?.save) {
        const previousStatus = form.getValues("invoice_status_id");
        const previousFin = form.getValues("invoice_status_fin_id");
        form.setValue("invoice_status_id", targetStatus.id, { shouldDirty: true });
        form.setValue("invoice_status_fin_id", targetFin.id, { shouldDirty: true });
        const errors = await saveContext.save({
          ...form.getValues(),
          invoice_status_id: targetStatus.id,
          invoice_status_fin_id: targetFin.id,
        });
        if (errors) {
          form.setValue("invoice_status_id", previousStatus, { shouldDirty: true });
          form.setValue("invoice_status_fin_id", previousFin, { shouldDirty: true });
          return;
        }
        notify(allLinked ? "Factura aprobada y agendada" : "Factura confirmada", {
          type: "info",
        });
        refresh();
        return;
      }

      if (!record?.id) return;
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          invoice_status_id: targetStatus.id,
          invoice_status_fin_id: targetFin.id,
        },
        previousData: record,
      });
      notify(allLinked ? "Factura aprobada y agendada" : "Factura confirmada", {
        type: "info",
      });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo confirmar la factura", { type: "warning" });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const proveedorLabel =
    record?.proveedor?.nombre ??
    (record as any)?.proveedor_nombre ??
    (record?.proveedor_id ? `#${record.proveedor_id}` : "Sin proveedor");
  const estadoLabel = record?.invoice_status?.nombre ?? "Borrador";

  const confirmContent = (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Seguro que deseas confirmar la factura?</p>
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
      <Button
        type="button"
        variant="default"
        onClick={() => setOpen(true)}
        onKeyDown={handleFormTabLoop}
        className={buttonClasses}
        disabled={disabled || loading || !hasDetalles}
      >
        <CheckCircle2 className="size-3 sm:size-4" />
        Confirmar
      </Button>
      <Confirm
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Confirmar factura"
        content={confirmContent}
        confirm="Confirmar"
        confirmColor="primary"
        loading={loading}
      />
    </>
  );
};
