"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { Download } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

type PoOrderSummary = {
  id?: number | string | null;
  titulo?: string | null;
  total?: number | string | null;
  created_at?: string | null;
};

type PoOrderDetailRaw = {
  id?: number | string | null;
  order_id?: number | string | null;
  articulo_id?: number | string | null;
  descripcion?: string | null;
  cantidad?: number | string | null;
  precio?: number | string | null;
  importe?: number | string | null;
  centro_costo_id?: number | string | null;
  oportunidad_id?: number | string | null;
};

type PoOrderLoadDialogProps = {
  proveedorId?: number | null;
  onConfirm: (details: PoOrderDetailRaw[]) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

const STATUS_CANDIDATES = ["aprobada", "aprobado", "Aprobada", "Aprobado"] as const;

const resolveApprovedStatusId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
) => {
  for (const candidate of STATUS_CANDIDATES) {
    const { data } = await dataProvider.getList("po-order-status", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { nombre: candidate },
    });
    const status = data?.[0];
    if (status?.id) {
      return status.id as number;
    }
  }
  return null;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatOrderTitle = (order: PoOrderSummary) => {
  const rawId = order.id ?? "";
  const id = String(rawId).trim();
  const titulo = String(order.titulo ?? "").trim();
  if (titulo.length > 0) return titulo;
  return id.length > 0 ? `OC #${id}` : "Orden de compra";
};

export const PoOrderLoadDialog = ({
  proveedorId,
  onConfirm,
  disabled = false,
  open,
  onOpenChange,
  showTrigger = true,
}: PoOrderLoadDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [orders, setOrders] = useState<PoOrderSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const isControlled = typeof open === "boolean";
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
        return;
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const isDisabled = disabled || proveedorId == null;

  useEffect(() => {
    if (!dialogOpen) return;
    if (proveedorId == null) {
      setOrders([]);
      return;
    }

    let active = true;
    setLoading(true);

    (async () => {
      try {
        const statusId = await resolveApprovedStatusId(dataProvider);
        if (!active) return;
        if (!statusId) {
          setOrders([]);
          return;
        }

        const { data } = await dataProvider.getList("po-orders", {
          pagination: { page: 1, perPage: 100 },
          sort: { field: "id", order: "DESC" },
          filter: {
            proveedor_id: proveedorId,
            order_status_id: statusId,
          },
        });

        if (!active) return;
        setOrders((data ?? []) as PoOrderSummary[]);
      } catch (error) {
        console.error(error);
        if (active) {
          notify("No se pudieron cargar las ordenes aprobadas", { type: "warning" });
          setOrders([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [dialogOpen, proveedorId, dataProvider, notify]);

  useEffect(() => {
    if (!dialogOpen) {
      setSelectedIds([]);
    }
  }, [dialogOpen]);

  const toggleSelection = (orderId: number) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const handleConfirm = async () => {
    const ids = selectedIds.filter((id) => Number.isFinite(id));
    if (!ids.length) {
      setDialogOpen(false);
      return;
    }

    setLoadingDetails(true);
    try {
      const responses = await Promise.all(
        ids.map((id) => dataProvider.getOne("po-orders", { id })),
      );
      const details = responses.flatMap((response) => {
        const record = response?.data as { detalles?: PoOrderDetailRaw[] } | undefined;
        return Array.isArray(record?.detalles) ? record.detalles : [];
      });

      onConfirm(details);
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
      notify("No se pudieron cargar los detalles de las ordenes", { type: "warning" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const emptyState = useMemo(() => {
    if (proveedorId == null) {
      return "Selecciona un proveedor para ver ordenes aprobadas.";
    }
    if (loading) {
      return "Cargando ordenes...";
    }
    return "No hay ordenes aprobadas disponibles.";
  }, [proveedorId, loading]);

  return (
    <>
      {showTrigger ? (
        <DropdownMenuItem
          onSelect={(event) => {
            if (isDisabled) {
              event.preventDefault();
              return;
            }
            setDialogOpen(true);
          }}
          disabled={isDisabled}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          <Download className="h-3 w-3" />
          Cargar OC
        </DropdownMenuItem>
      ) : null}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Cargar Ordenes de Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <p>Selecciona una o mas OCs en estado aprobada.</p>
            <div className="rounded-md border border-border/70 bg-muted/10">
              {orders.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                  {emptyState}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {orders.map((order) => {
                    const rawId = order.id ?? 0;
                    const numericId = Number(rawId);
                    const canSelect = Number.isFinite(numericId) && numericId > 0;
                    const isChecked = canSelect && selectedIds.includes(numericId);
                    const totalLabel = formatCurrency(toNumber(order.total));

                    return (
                      <div
                        key={`${rawId}`}
                        role="button"
                        tabIndex={canSelect ? 0 : -1}
                        aria-pressed={isChecked}
                        aria-disabled={!canSelect}
                        onClick={() => {
                          if (!canSelect) return;
                          toggleSelection(numericId);
                        }}
                        onKeyDown={(event) => {
                          if (!canSelect) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleSelection(numericId);
                          }
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2 text-left transition",
                          "hover:bg-muted/60",
                          isChecked && "bg-muted",
                          !canSelect && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          className="mt-0.5"
                          disabled={!canSelect}
                        />
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-foreground">
                            {formatOrderTitle(order)}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            #{rawId} · Total {totalLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={loadingDetails}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loadingDetails || selectedIds.length === 0}
            >
              Cargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
