"use client";

import { useMemo, useState } from "react";
import { useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PoOrderFormValues } from "./model";
import { type PoOrderRecord, usePoOrderStatusTransition } from "./form_hooks";

const buttonClasses = "h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px] gap-1";

export const FormGenerar = ({ disabled }: { disabled?: boolean } = {}) => {
  const record = useRecordContext<PoOrderRecord>();
  const { control } = useFormContext<PoOrderFormValues>();
  const proveedorId = useWatch({ control, name: "proveedor_id" }) as number | undefined;
  const detalles = useWatch({ control, name: "detalles" }) as
    | Array<{ precio?: unknown }>
    | undefined;
  const rows = Array.isArray(detalles) ? detalles : [];
  const hasDetalles = rows.length > 0;
  const [open, setOpen] = useState(false);
  const { cambiarEstado, loading } = usePoOrderStatusTransition();
  const isCreate = !record?.id;
  const statusKey = String(record?.order_status?.nombre ?? "")
    .trim()
    .toLowerCase();
  const statusOrden = record?.order_status?.orden;
  const isEditAllowed = Boolean(record?.id && (statusOrden === 1 || statusOrden === 2));

  const canOrdenCompra = useMemo(() => {
    const proveedorOk = Number.isFinite(Number(proveedorId)) && Number(proveedorId) > 0;
    if (rows.length === 0) return false;
    const preciosOk = rows.every((row) => Number(row?.precio ?? 0) > 0);
    return proveedorOk && preciosOk;
  }, [proveedorId, detalles]);

  if (!isCreate && !isEditAllowed) return null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setOpen(true)}
        className={buttonClasses}
        disabled={loading || !hasDetalles || disabled}
      >
        <CheckCircle2 className="size-3 sm:size-4" />
        Generar
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : setOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Selecciona una opción para continuar.</p>
            <div className="space-y-1 text-xs">
              {statusKey !== "solicitada" ? (
                <p>
                  <span className="font-semibold text-foreground">Generar Solicitud:</span>{" "}
                  deja la orden en estado solicitada. Compras se encarga de la gestión.
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-foreground">Orden Compra:</span>{" "}
                deja la orden en estado emitida. El gerente debe aprobarla.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            {statusKey !== "solicitada" ? (
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  cambiarEstado("solicitada");
                }}
                disabled={loading}
              >
                Generar Solicitud
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                cambiarEstado("emitida");
              }}
              disabled={loading || !canOrdenCompra}
            >
              Orden Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
