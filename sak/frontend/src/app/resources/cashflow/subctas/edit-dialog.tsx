"use client";

import { useRef } from "react";
import { ResourceContextProvider, useGetList } from "ra-core";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErpCashSubctaEdit } from "./edit";
import type { ErpCashSubcta } from "./model";

export type CashSubcuentaTarget = { tipo: number; numero: number };

export const CashSubcuentaEditDialog = ({ target, onClose, onSaved }: {
  target: CashSubcuentaTarget;
  onClose: () => void;
  onSaved?: () => void;
}) => {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const query = useGetList<ErpCashSubcta>("erp/cash/subctas", {
    filter: { tpo_subcta: target.tipo, nro_subcta: target.numero },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const record = query.data?.[0];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[88vh] !w-[94vw] !max-w-[760px] gap-2 overflow-y-auto p-4"
        onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base">Editar subcuenta Cash</DialogTitle>
          <DialogDescription>Subcuenta {target.tipo} / {target.numero}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Cargando subcuenta…
          </div>
        ) : query.error ? (
          <div className="space-y-2 p-4 text-center text-xs text-destructive">
            <p>No se pudo cargar la subcuenta.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Reintentar</Button>
          </div>
        ) : record ? (
          <ResourceContextProvider value="erp/cash/subctas">
            <ErpCashSubctaEdit embedded id={record.id} redirect={false} onCancel={onClose} onSaved={() => { onClose(); onSaved?.(); }} />
          </ResourceContextProvider>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">La subcuenta no se encuentra en el catálogo Cash.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
