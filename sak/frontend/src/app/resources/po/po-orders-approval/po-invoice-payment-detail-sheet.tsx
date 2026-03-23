"use client";

import { useState } from "react";
import { RecordContextProvider, useDataProvider, useNotify } from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  PoInvoiceShowContent,
  type PoInvoiceDisplayRecord,
} from "@/app/resources/po/po-invoices/show";
import { getInvoiceStatusFinBadgeClass } from "@/app/resources/po/po-invoices/model";
import { Confirm } from "@/components/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PoInvoicePaymentDetailRecord = PoInvoiceDisplayRecord & {
  id: number | string;
  proveedor?: { id?: number | null; nombre?: string | null } | null;
  invoice_status_fin?: { id?: number | null; nombre?: string | null; orden?: number | null } | null;
};

type PoInvoicePaymentAction = "approve" | "reject";

const formatHeaderDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatListCurrency = (value: unknown) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const getPoInvoicePaymentLabel = (action: PoInvoicePaymentAction) =>
  action === "approve" ? "Aprobar" : "Rechazar";

const resolveInvoiceStatusFinByOrden = async (
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

const buildPoInvoicePaymentConfirmContent = (
  record: PoInvoicePaymentDetailRecord | null | undefined,
  action: PoInvoicePaymentAction,
) => (
  <div className="space-y-2 text-sm text-muted-foreground">
    <p>Seguro que deseas {getPoInvoicePaymentLabel(action).toLowerCase()} el pago?</p>
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
        {record?.proveedor?.nombre ?? "Sin proveedor"}
      </div>
      <div>
        <span className="font-semibold text-foreground">Agenda:</span>{" "}
        {record?.invoice_status_fin?.nombre ?? "-"}
      </div>
      <div>
        <span className="font-semibold text-foreground">Monto:</span>{" "}
        {formatListCurrency(record?.total)}
      </div>
    </div>
  </div>
);

const runPoInvoicePaymentAction = async ({
  action,
  dataProvider,
  record,
  resource,
}: {
  action: PoInvoicePaymentAction;
  dataProvider: ReturnType<typeof useDataProvider>;
  record: PoInvoicePaymentDetailRecord;
  resource: string;
}) => {
  const orden = action === "approve" ? 3 : 5;
  const finStatus = await resolveInvoiceStatusFinByOrden(dataProvider, orden);

  if (!record?.id) {
    throw new Error("La factura no tiene identificador.");
  }
  if (!finStatus?.id) {
    throw new Error(
      action === "approve"
        ? "No se encontro el estado financiero Autorizada."
        : "No se encontro el estado financiero Cancelada.",
    );
  }

  await dataProvider.update(resource, {
    id: record.id,
    data: { invoice_status_fin_id: finStatus.id },
    previousData: record,
  });
};

export const PoInvoicePaymentButtons = ({
  fullWidth = false,
  onResolved,
  record,
}: {
  fullWidth?: boolean;
  onResolved: (recordId: number) => void;
  record: PoInvoicePaymentDetailRecord;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingAction, setPendingAction] = useState<PoInvoicePaymentAction | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      await runPoInvoicePaymentAction({
        action: pendingAction,
        dataProvider,
        record,
        resource: "po-invoices-payments",
      });
      notify(
        pendingAction === "approve" ? "Pago aprobado" : "Pago rechazado",
        { type: "info" },
      );
      onResolved(record.id as number);
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "No se pudo actualizar el pago",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={cn("flex items-center gap-1.5", fullWidth && "w-full")}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          aria-label="Rechazar"
          title="Rechazar"
          className={cn(
            fullWidth
              ? "h-7 rounded-full border-rose-200 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
              : "h-6 w-6 rounded-full border-rose-200 px-0 text-[8px] font-semibold text-rose-700 hover:bg-rose-50 sm:h-7 sm:w-auto sm:px-3 sm:text-[11px]",
            fullWidth && "flex-1",
          )}
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("reject");
          }}
        >
          <XCircle className={cn("h-2.5 w-2.5", fullWidth ? "mr-1 h-3.5 w-3.5" : "sm:mr-1 sm:h-3.5 sm:w-3.5")} />
          <span className={cn(!fullWidth && "hidden sm:inline")}>Rechazar</span>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={loading}
          aria-label="Aprobar"
          title="Aprobar"
          className={cn(
            fullWidth
              ? "h-7 rounded-full bg-orange-800 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-orange-900"
              : "h-6 w-6 rounded-full bg-orange-800 px-0 text-[8px] font-semibold text-white shadow-sm hover:bg-orange-900 sm:h-7 sm:w-auto sm:px-3 sm:text-[11px]",
            fullWidth && "flex-1",
          )}
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("approve");
          }}
        >
          <CheckCircle2 className={cn("h-2.5 w-2.5", fullWidth ? "mr-1 h-3.5 w-3.5" : "sm:mr-1 sm:h-3.5 sm:w-3.5")} />
          <span className={cn(!fullWidth && "hidden sm:inline")}>Aprobar</span>
        </Button>
      </div>
      <Confirm
        isOpen={Boolean(pendingAction)}
        onClose={() => {
          if (loading) return;
          setPendingAction(null);
        }}
        onConfirm={handleConfirm}
        title={`${pendingAction ? getPoInvoicePaymentLabel(pendingAction) : "Confirmar"} pago`}
        content={
          pendingAction ? buildPoInvoicePaymentConfirmContent(record, pendingAction) : ""
        }
        confirm={pendingAction ? getPoInvoicePaymentLabel(pendingAction) : "Confirmar"}
        confirmColor={pendingAction === "reject" ? "warning" : "primary"}
        loading={loading}
      />
    </>
  );
};

const ApprovalCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-2.5 w-12" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
    </div>
    <div className="mt-1.5 flex items-baseline gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
    <div className="mt-1 flex items-center gap-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="ml-auto h-2.5 w-16" />
    </div>
    <div className="mt-2 flex items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <div className="ml-auto flex gap-1.5">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  </div>
);

export const PoInvoicePaymentDetailSheet = ({
  loading,
  onOpenChange,
  onResolved,
  open,
  record,
}: {
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (recordId: number) => void;
  open: boolean;
  record?: PoInvoicePaymentDetailRecord | null;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="flex h-[92vh] flex-col gap-0 rounded-t-[24px] border-none bg-[#f5f6f8] p-0 sm:mx-auto sm:max-w-xl"
    >
      <SheetHeader className="gap-1.5 border-b border-slate-200 bg-white pb-4 pr-12 text-left">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="min-w-0 truncate text-left text-[15px] font-semibold text-slate-900 sm:text-lg">
            {record?.numero ? `Pago ${record.numero}` : "Detalle pago"}
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {record?.invoice_status_fin?.nombre ? (
              <Badge
                className={`${getInvoiceStatusFinBadgeClass(record.invoice_status_fin.nombre)} h-5 px-2 py-0 text-[10px] font-medium sm:h-6 sm:text-xs`}
              >
                {record.invoice_status_fin.nombre}
              </Badge>
            ) : null}
            {formatHeaderDate(record?.fecha_vencimiento) ? (
              <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                {formatHeaderDate(record?.fecha_vencimiento)}
              </span>
            ) : null}
          </div>
        </div>
        <SheetDescription asChild>
          <div className="flex min-w-0 flex-col text-left text-slate-500">
            <span className="truncate text-[12px] font-semibold text-slate-700 sm:text-[15px]">
              {record?.proveedor?.nombre || "-"}
            </span>
            <span className="truncate text-[10px] sm:text-[12px]">
              {record?.titulo || "-"}
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            <ApprovalCardSkeleton />
            <ApprovalCardSkeleton />
          </div>
        ) : record ? (
          <RecordContextProvider value={record}>
            <PoInvoiceShowContent showCancelButton={false} compactHeader />
          </RecordContextProvider>
        ) : (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No se pudo cargar el detalle del pago.
          </div>
        )}
      </div>

      <SheetFooter className="border-t border-slate-200 bg-white">
        {record?.id ? (
          <PoInvoicePaymentButtons
            record={record}
            fullWidth
            onResolved={() => {
              onResolved(Number(record.id));
              onOpenChange(false);
            }}
          />
        ) : null}
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
