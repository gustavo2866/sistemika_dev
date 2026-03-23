"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordContextProvider, useDataProvider, useGetOne, useNotify } from "ra-core";
import { CheckCircle2, CheckSquare2, Search, XCircle } from "lucide-react";

import { Confirm } from "@/components/confirm";
import {
  PoOrderDetailContent,
  formatPoOrderNumber,
  type PoOrderDisplayRecord,
} from "@/app/resources/po/po-orders/detail-content";
import {
  PoOrderApprovalButtons,
  buildPoOrderApprovalConfirmContent,
  getPoOrderApprovalLabel,
  runPoOrderApprovalAction,
  type PoOrderApprovalAction,
  type PoOrderApprovalRecord,
} from "@/app/resources/po/po-orders/status-actions";
import { getOrderStatusBadgeClass } from "@/app/resources/po/po-orders/model";
import {
  buildPoInvoiceApprovalConfirmContent,
  getPoInvoiceApprovalLabel,
  runPoInvoiceApprovalAction,
  type PoInvoiceApprovalAction,
  type PoInvoiceApprovalRecord,
} from "@/app/resources/po/po-invoices/status-actions";
import {
  getInvoiceStatusBadgeClass,
  getInvoiceStatusFinBadgeClass,
} from "@/app/resources/po/po-invoices/model";
import {
  PoInvoiceApprovalDetailSheet,
  type PoInvoiceApprovalDetailRecord,
} from "./po-invoice-approval-detail-sheet";
import {
  PoInvoicePaymentButtons,
  PoInvoicePaymentDetailSheet,
} from "./po-invoice-payment-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ApprovalTab = "orders" | "invoices" | "payments";

type PoOrderApprovalListItem = PoOrderApprovalRecord & {
  id: number;
  titulo?: string | null;
  comentario?: string | null;
  created_at?: string | null;
  total?: number | null;
  proveedor?: { id?: number | null; nombre?: string | null } | null;
  solicitante?: { id?: number | null; nombre?: string | null } | null;
  tipo_solicitud?: { id?: number | null; nombre?: string | null } | null;
  order_status?: { id?: number | null; nombre?: string | null } | null;
};

type PoInvoiceApprovalListItem = PoInvoiceApprovalRecord & {
  id: number;
  titulo?: string | null;
  numero?: string | null;
  created_at?: string | null;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  total?: number | null;
  proveedor?: { id?: number | null; nombre?: string | null } | null;
  usuario_responsable?: { id?: number | null; nombre?: string | null } | null;
  invoice_status?: { id?: number | null; nombre?: string | null; orden?: number | null } | null;
  invoice_status_fin?: { id?: number | null; nombre?: string | null; orden?: number | null } | null;
};

type PoOrderApprovalDetailRecord = PoOrderDisplayRecord & {
  id: number | string;
};

const PAGE_SIZE = 10;
const LIST_CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

const truncateText = (value?: string | null, max = 80) => {
  if (!value) return "";
  const normalized = value.trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
};

const dedupeById = <T extends { id: number }>(items: T[]) => {
  const map = new Map<number, T>();
  items.forEach((item) => map.set(Number(item.id), item));
  return Array.from(map.values());
};

const formatListCurrency = (value: unknown) =>
  LIST_CURRENCY_FORMATTER.format(Number(value ?? 0));

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

const useApprovalFeed = <T extends { id: number }>({
  errorMessage,
  resource,
  search,
  sort,
}: {
  errorMessage: string;
  resource: string;
  search: string;
  sort?: { field: string; order: "ASC" | "DESC" };
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async ({
      append,
      pageToLoad,
      query,
      requestId,
    }: {
      append: boolean;
      pageToLoad: number;
      query: string;
      requestId: number;
    }) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await dataProvider.getList<T>(resource, {
          pagination: { page: pageToLoad, perPage: PAGE_SIZE },
          sort: {
            field: sort?.field ?? "created_at",
            order: sort?.order ?? "DESC",
          },
          filter: query ? { q: query } : {},
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const nextTotal = response.total ?? 0;
        setTotal(nextTotal);
        setHasMore(pageToLoad * PAGE_SIZE < nextTotal);
        setPage(pageToLoad);
        setItems((previous) =>
          append ? dedupeById([...previous, ...response.data]) : response.data,
        );
      } catch (error) {
        console.error(error);
        notify(errorMessage, { type: "warning" });
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [dataProvider, errorMessage, notify, resource, sort?.field, sort?.order],
  );

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setItems([]);
    setPage(1);
    setHasMore(true);
    void fetchPage({
      append: false,
      pageToLoad: 1,
      query: search,
      requestId,
    });
  }, [fetchPage, search]);

  const fetchNext = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void fetchPage({
      append: true,
      pageToLoad: page + 1,
      query: search,
      requestId: requestIdRef.current,
    });
  }, [fetchPage, hasMore, loading, loadingMore, page, search]);

  const removeItem = useCallback((recordId: number) => {
    setItems((previous) =>
      previous.filter((item) => Number(item.id) !== recordId),
    );
    setTotal((previous) => Math.max(0, previous - 1));
  }, []);

  const countLabel = useMemo(() => {
    if (loading && items.length === 0) return "...";
    return String(total);
  }, [items.length, loading, total]);

  return {
    countLabel,
    fetchNext,
    hasMore,
    items,
    loading,
    loadingMore,
    removeItem,
    total,
  };
};

const PoOrderQuickActionButtons = ({
  onResolved,
  record,
}: {
  onResolved: (recordId: number) => void;
  record: PoOrderApprovalListItem;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingAction, setPendingAction] = useState<PoOrderApprovalAction | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      await runPoOrderApprovalAction({
        action: pendingAction,
        dataProvider,
        record,
        resource: "po-orders-approval",
      });
      notify(
        pendingAction === "approve" ? "Orden aprobada" : "Orden rechazada",
        { type: "info" },
      );
      onResolved(record.id);
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
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          aria-label="Rechazar"
          title="Rechazar"
          className="h-6 w-6 shrink-0 rounded-full border-emerald-200 px-0 text-[8px] font-semibold text-emerald-700 hover:bg-emerald-50 sm:h-7 sm:w-auto sm:px-3 sm:text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("reject");
          }}
        >
          <XCircle className="h-2.5 w-2.5 sm:mr-1 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Rechazar</span>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={loading}
          aria-label="Aprobar"
          title="Aprobar"
          className="h-6 w-6 shrink-0 rounded-full bg-emerald-500 px-0 text-[8px] font-semibold text-white shadow-sm hover:bg-emerald-600 sm:h-7 sm:w-auto sm:px-3.5 sm:text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("approve");
          }}
        >
          <CheckCircle2 className="h-2.5 w-2.5 sm:mr-1 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Aprobar</span>
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
        content={
          pendingAction ? buildPoOrderApprovalConfirmContent(record, pendingAction) : ""
        }
        confirm={pendingAction ? getPoOrderApprovalLabel(pendingAction) : "Confirmar"}
        confirmColor={pendingAction === "reject" ? "warning" : "primary"}
        loading={loading}
      />
    </>
  );
};

const PoInvoiceQuickActionButtons = ({
  onResolved,
  record,
}: {
  onResolved: (recordId: number) => void;
  record: PoInvoiceApprovalListItem;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingAction, setPendingAction] = useState<PoInvoiceApprovalAction | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      await runPoInvoiceApprovalAction({
        action: pendingAction,
        dataProvider,
        record,
        resource: "po-invoices-approval",
      });
      notify(
        pendingAction === "approve" ? "Factura aprobada" : "Factura rechazada",
        { type: "info" },
      );
      onResolved(record.id);
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
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          aria-label="Rechazar"
          title="Rechazar"
          className="h-6 w-6 shrink-0 rounded-full border-sky-200 px-0 text-[8px] font-semibold text-sky-700 hover:bg-sky-50 sm:h-7 sm:w-auto sm:px-3 sm:text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("reject");
          }}
        >
          <XCircle className="h-2.5 w-2.5 sm:mr-1 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Rechazar</span>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={loading}
          aria-label="Aprobar"
          title="Aprobar"
          className="h-6 w-6 shrink-0 rounded-full bg-sky-600 px-0 text-[8px] font-semibold text-white shadow-sm hover:bg-sky-700 sm:h-7 sm:w-auto sm:px-3.5 sm:text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setPendingAction("approve");
          }}
        >
          <CheckCircle2 className="h-2.5 w-2.5 sm:mr-1 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Aprobar</span>
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
        content={
          pendingAction ? buildPoInvoiceApprovalConfirmContent(record, pendingAction) : ""
        }
        confirm={pendingAction ? getPoInvoiceApprovalLabel(pendingAction) : "Confirmar"}
        confirmColor={pendingAction === "reject" ? "warning" : "primary"}
        loading={loading}
      />
    </>
  );
};

const PoOrderApprovalCard = ({
  onOpen,
  onResolved,
  record,
}: {
  onOpen: (recordId: number) => void;
  onResolved: (recordId: number) => void;
  record: PoOrderApprovalListItem;
}) => {
  const statusName = record.order_status?.nombre ?? "Emitida";
  const providerName = record.proveedor?.nombre ?? "Sin proveedor";
  const requesterName = record.solicitante?.nombre ?? "Sin solicitante";
  const requestType = record.tipo_solicitud?.nombre ?? "Sin tipo";
  const primaryTitle =
    providerName !== "Sin proveedor"
      ? providerName
      : record.titulo || "Orden sin proveedor";
  const secondaryLabel = `OC ${formatPoOrderNumber(record.id)}`;
  const detailPreview =
    truncateText(
      record.titulo && record.titulo !== providerName
        ? record.titulo
        : record.comentario,
      54,
    ) || truncateText(`Tipo: ${requestType}`, 54);
  const comentarioPreview = truncateText(record.comentario, 140);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(record.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(record.id);
        }
      }}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-200 hover:shadow-[0_3px_8px_rgba(0,0,0,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-emerald-500" />

      <div className="pl-4 pr-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-wide text-slate-400">
            {secondaryLabel}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">
            {formatShortDate(record.created_at)}
          </span>
          <Badge
            className={cn(
              "h-4 border-0 px-1.5 py-0 text-[9px] font-semibold capitalize leading-none shadow-none",
              getOrderStatusBadgeClass(statusName),
            )}
          >
            {statusName}
          </Badge>
        </div>

        <h3 className="mt-1 truncate text-[13px] font-semibold leading-snug text-slate-900 sm:text-[15px]">
          {primaryTitle}
        </h3>

        {comentarioPreview ? (
          <p className="mt-0.5 w-full text-[9px] leading-tight text-slate-400 sm:text-[10px]">
            {comentarioPreview}
          </p>
        ) : null}

        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {detailPreview ? (
            <p className="truncate text-[11px] text-slate-400">{detailPreview}</p>
          ) : null}
          <span className="ml-auto shrink-0 text-[11px] text-slate-400">
            Por <span className="font-medium text-slate-600">{requesterName}</span>
          </span>
        </div>

        <div className="mt-2.5 mb-2 h-px bg-slate-100" />

        <div className="flex items-center gap-3">
          <p className="text-[12px] font-bold tracking-tight text-slate-900 tabular-nums sm:text-[16px]">
            {formatListCurrency(record.total)}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <PoOrderQuickActionButtons record={record} onResolved={onResolved} />
          </div>
        </div>
      </div>
    </article>
  );
};

const PoInvoiceApprovalCard = ({
  onOpen,
  onResolved,
  record,
}: {
  onOpen: (recordId: number) => void;
  onResolved: (recordId: number) => void;
  record: PoInvoiceApprovalListItem;
}) => {
  const statusName = record.invoice_status?.nombre ?? "Confirmada";
  const providerName = record.proveedor?.nombre ?? "Sin proveedor";
  const responsibleName =
    record.usuario_responsable?.nombre ?? "Sin responsable";
  const secondaryLabel = record.numero ? `FC ${record.numero}` : `FC #${record.id}`;
  const detailPreview =
    truncateText(record.titulo, 54) ||
    truncateText(`Responsable: ${responsibleName}`, 54);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(record.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(record.id);
        }
      }}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-200 hover:shadow-[0_3px_8px_rgba(0,0,0,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-sky-600" />

      <div className="pl-4 pr-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-wide text-slate-400">
            {secondaryLabel}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">
            {formatShortDate(record.created_at)}
          </span>
          <Badge
            className={cn(
              "h-4 border-0 px-1.5 py-0 text-[9px] font-semibold capitalize leading-none shadow-none",
              getInvoiceStatusBadgeClass(statusName),
            )}
          >
            {statusName}
          </Badge>
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-slate-900 sm:text-[15px]">
            {providerName}
          </h3>
          <span className="ml-auto max-w-[92px] shrink-0 truncate text-right text-[9px] text-slate-400 sm:max-w-[132px] sm:text-[11px]">
            <span className="font-medium text-slate-600">{responsibleName}</span>
          </span>
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {detailPreview ? (
            <p className="truncate text-[11px] text-slate-400">{detailPreview}</p>
          ) : null}
        </div>

        <div className="mt-2.5 mb-2 h-px bg-slate-100" />

        <div className="flex items-center gap-3">
          <p className="text-[12px] font-bold tracking-tight text-slate-900 tabular-nums sm:text-[16px]">
            {formatListCurrency(record.total)}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <PoInvoiceQuickActionButtons record={record} onResolved={onResolved} />
          </div>
        </div>
      </div>
    </article>
  );
};

const PoInvoicePaymentCard = ({
  onOpen,
  onResolved,
  record,
}: {
  onOpen: (recordId: number) => void;
  onResolved: (recordId: number) => void;
  record: PoInvoiceApprovalListItem;
}) => {
  const paymentStatusName = record.invoice_status_fin?.nombre ?? "Agendada";
  const providerName = record.proveedor?.nombre ?? "Sin proveedor";
  const responsibleName =
    record.usuario_responsable?.nombre ?? "Sin responsable";
  const secondaryLabel = record.numero ? `FC ${record.numero}` : `FC #${record.id}`;
  const detailPreview =
    truncateText(record.titulo, 54) ||
    truncateText(`Responsable: ${responsibleName}`, 54);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(record.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(record.id);
        }
      }}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-200 hover:shadow-[0_3px_8px_rgba(0,0,0,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-orange-800" />

      <div className="pl-4 pr-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-wide text-slate-400">
            {secondaryLabel}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">
            {formatShortDate(record.fecha_vencimiento)}
          </span>
          <Badge
            className={cn(
              "h-4 border-0 px-1.5 py-0 text-[9px] font-semibold capitalize leading-none shadow-none",
              getInvoiceStatusFinBadgeClass(paymentStatusName),
            )}
          >
            {paymentStatusName}
          </Badge>
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-slate-900 sm:text-[15px]">
            {providerName}
          </h3>
          <span className="ml-auto max-w-[92px] shrink-0 truncate text-right text-[9px] text-slate-400 sm:max-w-[132px] sm:text-[11px]">
            <span className="font-medium text-slate-600">{responsibleName}</span>
          </span>
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {detailPreview ? (
            <p className="truncate text-[11px] text-slate-400">{detailPreview}</p>
          ) : null}
        </div>

        <div className="mt-2.5 mb-2 h-px bg-slate-100" />

        <div className="flex items-center gap-3">
          <p className="text-[12px] font-bold tracking-tight text-slate-900 tabular-nums sm:text-[16px]">
            {formatListCurrency(record.total)}
          </p>
          <div className="ml-auto">
            <PoInvoicePaymentButtons record={record} onResolved={onResolved} />
          </div>
        </div>
      </div>
    </article>
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

const PoOrderApprovalDetailSheet = ({
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
  record?: PoOrderApprovalDetailRecord | null;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="flex h-[92vh] flex-col gap-0 rounded-t-[24px] border-none bg-[#f5f6f8] p-0 sm:mx-auto sm:max-w-xl"
    >
      <SheetHeader className="gap-1.5 border-b border-slate-200 bg-white pb-4 pr-12 text-left">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="min-w-0 truncate text-left text-[15px] font-semibold text-slate-900 sm:text-lg">
            {record?.id ? `Orden ${formatPoOrderNumber(record.id)}` : "Detalle orden"}
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {record?.order_status?.nombre ? (
              <Badge
                className={cn(
                  "h-5 px-2 py-0 text-[10px] font-medium sm:h-6 sm:text-xs",
                  getOrderStatusBadgeClass(record.order_status.nombre),
                )}
              >
                {record.order_status.nombre}
              </Badge>
            ) : null}
            {formatHeaderDate(record?.created_at) ? (
              <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                {formatHeaderDate(record?.created_at)}
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
            <PoOrderDetailContent compactHeader />
          </RecordContextProvider>
        ) : (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No se pudo cargar el detalle de la orden.
          </div>
        )}
      </div>

      <SheetFooter className="border-t border-slate-200 bg-white">
        {record?.id ? (
          <PoOrderApprovalButtons
            record={record}
            resource="po-orders-approval"
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

export const PoOrdersApprovalList = () => {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("orders");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const orderFeed = useApprovalFeed<PoOrderApprovalListItem>({
    resource: "po-orders-approval",
    search,
    errorMessage: "No se pudieron cargar las OCs emitidas.",
  });
  const invoiceFeed = useApprovalFeed<PoInvoiceApprovalListItem>({
    resource: "po-invoices-approval",
    search,
    errorMessage: "No se pudieron cargar las facturas confirmadas.",
  });
  const paymentFeed = useApprovalFeed<PoInvoiceApprovalListItem>({
    resource: "po-invoices-payments",
    search,
    errorMessage: "No se pudieron cargar los pagos agendados.",
    sort: { field: "fecha_vencimiento", order: "ASC" },
  });

  const { data: selectedOrderRecord, isLoading: selectedOrderLoading } =
    useGetOne<PoOrderApprovalDetailRecord>(
      "po-orders-approval",
      { id: selectedOrderId ?? 0 },
      { enabled: selectedOrderId != null },
    );

  const { data: selectedInvoiceRecord, isLoading: selectedInvoiceLoading } =
    useGetOne<PoInvoiceApprovalDetailRecord>(
      "po-invoices-approval",
      { id: selectedInvoiceId ?? 0 },
      { enabled: selectedInvoiceId != null },
    );

  const { data: selectedPaymentRecord, isLoading: selectedPaymentLoading } =
    useGetOne<PoInvoiceApprovalDetailRecord>(
      "po-invoices-payments",
      { id: selectedPaymentId ?? 0 },
      { enabled: selectedPaymentId != null },
    );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const activeHasMore =
    activeTab === "orders"
      ? orderFeed.hasMore
      : activeTab === "invoices"
        ? invoiceFeed.hasMore
        : paymentFeed.hasMore;
  const activeLoading =
    activeTab === "orders"
      ? orderFeed.loading
      : activeTab === "invoices"
        ? invoiceFeed.loading
        : paymentFeed.loading;
  const activeLoadingMore =
    activeTab === "orders"
      ? orderFeed.loadingMore
      : activeTab === "invoices"
        ? invoiceFeed.loadingMore
        : paymentFeed.loadingMore;
  const activeFetchNext =
    activeTab === "orders"
      ? orderFeed.fetchNext
      : activeTab === "invoices"
        ? invoiceFeed.fetchNext
        : paymentFeed.fetchNext;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !activeHasMore || activeLoading || activeLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        activeFetchNext();
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeFetchNext, activeHasMore, activeLoading, activeLoadingMore, activeTab]);

  const handleOrderResolved = useCallback(
    (recordId: number) => {
      orderFeed.removeItem(recordId);
      if (selectedOrderId === recordId) {
        setSelectedOrderId(null);
      }
    },
    [orderFeed, selectedOrderId],
  );

  const handleInvoiceResolved = useCallback(
    (recordId: number) => {
      invoiceFeed.removeItem(recordId);
      if (selectedInvoiceId === recordId) {
        setSelectedInvoiceId(null);
      }
    },
    [invoiceFeed, selectedInvoiceId],
  );

  const handlePaymentResolved = useCallback(
    (recordId: number) => {
      paymentFeed.removeItem(recordId);
      if (selectedPaymentId === recordId) {
        setSelectedPaymentId(null);
      }
    },
    [paymentFeed, selectedPaymentId],
  );

  const activeItems =
    activeTab === "orders"
      ? orderFeed.items
      : activeTab === "invoices"
        ? invoiceFeed.items
        : paymentFeed.items;

  return (
    <div className="min-h-full bg-[#f8f9fb]">
      <div className="sticky top-0 z-20 bg-[#f8f9fb]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-xl px-1 pt-3 pb-1.5 sm:px-4 lg:ml-0 lg:mr-auto lg:max-w-[50%]">
          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-start gap-2">
              <CheckSquare2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
              <h1 className="text-[17px] font-bold tracking-tight text-slate-900">
                Aprobar Compras
              </h1>
            </div>

            <div className="mt-2.5">
              <div className="grid w-full grid-cols-3 gap-1 rounded-full bg-slate-100 p-0.5 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("orders");
                    setSelectedInvoiceId(null);
                    setSelectedPaymentId(null);
                  }}
                  className={cn(
                    "w-full rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors sm:px-3 sm:py-1 sm:text-[12px]",
                    activeTab === "orders"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-emerald-700/80 hover:text-emerald-700",
                  )}
                >
                  {`Ordenes(${orderFeed.countLabel})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("invoices");
                    setSelectedOrderId(null);
                    setSelectedPaymentId(null);
                  }}
                  className={cn(
                    "w-full rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors sm:px-3 sm:py-1 sm:text-[12px]",
                    activeTab === "invoices"
                      ? "bg-white text-sky-700 shadow-sm"
                      : "text-sky-600/80 hover:text-sky-700",
                  )}
                >
                  {`Facturas(${invoiceFeed.countLabel})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("payments");
                    setSelectedOrderId(null);
                    setSelectedInvoiceId(null);
                  }}
                  className={cn(
                    "w-full rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors sm:px-3 sm:py-1 sm:text-[12px]",
                    activeTab === "payments"
                      ? "bg-white text-orange-800 shadow-sm"
                      : "text-orange-700/80 hover:text-orange-800",
                  )}
                >
                  {`Pagos(${paymentFeed.countLabel})`}
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por numero, titulo, proveedor"
                className="h-5 border-0 bg-transparent px-0 text-[12px] text-slate-700 placeholder:text-slate-400 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5 px-1 pb-4 pt-1 sm:px-4 lg:ml-0 lg:mr-auto lg:max-w-[50%]">
        {activeLoading && activeItems.length === 0 ? (
          <>
            <ApprovalCardSkeleton />
            <ApprovalCardSkeleton />
            <ApprovalCardSkeleton />
          </>
        ) : activeItems.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">
              {activeTab === "orders"
                ? "No hay OCs emitidas para aprobar"
                : activeTab === "invoices"
                  ? "No hay facturas confirmadas para aprobar"
                  : "No hay pagos agendados para aprobar"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {search
                ? "No encontramos resultados con ese criterio."
                : activeTab === "orders"
                  ? "Cuando aparezcan ordenes emitidas, las vas a ver aca."
                  : activeTab === "invoices"
                    ? "Cuando aparezcan facturas confirmadas, las vas a ver aca."
                    : "Cuando aparezcan pagos agendados, los vas a ver aca."}
            </p>
          </div>
        ) : (
          <>
            {activeTab === "orders"
              ? orderFeed.items.map((record) => (
                  <PoOrderApprovalCard
                    key={record.id}
                    record={record}
                    onOpen={setSelectedOrderId}
                    onResolved={handleOrderResolved}
                  />
                ))
              : activeTab === "invoices"
                ? invoiceFeed.items.map((record) => (
                    <PoInvoiceApprovalCard
                      key={record.id}
                      record={record}
                      onOpen={setSelectedInvoiceId}
                      onResolved={handleInvoiceResolved}
                    />
                  ))
                : paymentFeed.items.map((record) => (
                    <PoInvoicePaymentCard
                      key={record.id}
                      record={record}
                      onOpen={setSelectedPaymentId}
                      onResolved={handlePaymentResolved}
                    />
                  ))}

            {activeLoadingMore ? (
              <>
                <ApprovalCardSkeleton />
                <ApprovalCardSkeleton />
              </>
            ) : null}

            {activeHasMore ? (
              <div ref={sentinelRef} className="h-8" aria-hidden="true" />
            ) : (
              <div className="py-4 text-center text-xs uppercase tracking-[0.22em] text-slate-400">
                Fin del feed
              </div>
            )}
          </>
        )}
      </div>

      <PoOrderApprovalDetailSheet
        open={selectedOrderId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
        record={selectedOrderRecord}
        loading={selectedOrderLoading}
        onResolved={handleOrderResolved}
      />

      <PoInvoiceApprovalDetailSheet
        open={selectedInvoiceId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceId(null);
        }}
        record={selectedInvoiceRecord}
        loading={selectedInvoiceLoading}
        onResolved={handleInvoiceResolved}
      />

      <PoInvoicePaymentDetailSheet
        open={selectedPaymentId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedPaymentId(null);
        }}
        record={selectedPaymentRecord}
        loading={selectedPaymentLoading}
        onResolved={handlePaymentResolved}
      />
    </div>
  );
};
