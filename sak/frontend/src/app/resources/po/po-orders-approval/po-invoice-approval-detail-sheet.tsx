"use client";

import { RecordContextProvider } from "ra-core";

import {
  PoInvoiceShowContent,
  type PoInvoiceDisplayRecord,
} from "@/app/resources/po/po-invoices/show";
import { getInvoiceStatusBadgeClass } from "@/app/resources/po/po-invoices/model";
import { PoInvoiceApprovalButtons } from "@/app/resources/po/po-invoices/status-actions";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export type PoInvoiceApprovalDetailRecord = PoInvoiceDisplayRecord & {
  id: number | string;
};

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

export const PoInvoiceApprovalDetailSheet = ({
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
  record?: PoInvoiceApprovalDetailRecord | null;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="flex h-[92vh] flex-col gap-0 rounded-t-[24px] border-none bg-[#f5f6f8] p-0 sm:mx-auto sm:max-w-xl"
    >
      <SheetHeader className="gap-1.5 border-b border-slate-200 bg-white pb-4 pr-12 text-left">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="min-w-0 truncate text-left text-[15px] font-semibold text-slate-900 sm:text-lg">
            {record?.numero ? `FC ${record.numero}` : "Detalle factura"}
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {record?.invoice_status?.nombre ? (
              <Badge
                className={`${getInvoiceStatusBadgeClass(record.invoice_status.nombre)} h-5 px-2 py-0 text-[10px] font-medium sm:h-6 sm:text-xs`}
              >
                {record.invoice_status.nombre}
              </Badge>
            ) : null}
            {formatHeaderDate(record?.fecha_emision) ? (
              <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                {formatHeaderDate(record?.fecha_emision)}
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
            No se pudo cargar el detalle de la factura.
          </div>
        )}
      </div>

      <SheetFooter className="border-t border-slate-200 bg-white">
        {record?.id ? (
          <PoInvoiceApprovalButtons
            record={record}
            resource="po-invoices-approval"
            size="default"
            fullWidth
            className="w-full"
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
