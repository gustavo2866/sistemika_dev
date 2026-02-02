"use client";

import { useState } from "react";
import { useRecordContext } from "ra-core";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type PoSolicitud } from "./model";
import { usePoSolicitudEmit } from "./form_hooks";

const EmitConfirmDialog = ({
  open,
  loading,
  onClose,
  onEmit,
  onEmitAndShow,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onEmit: () => void;
  onEmitAndShow: () => void;
}) => (
  <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : onClose())}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Emitir solicitud</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        ¿Querés emitir la solicitud? Se guardarán los cambios pendientes.
      </p>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={onEmit} disabled={loading}>
          Emitir
        </Button>
        <Button type="button" onClick={onEmitAndShow} disabled={loading}>
          Emitir y abrir
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FormEmitir = ({ onClose }: { onClose: () => void }) => {
  const record = useRecordContext<PoSolicitud>();
  const [emitOpen, setEmitOpen] = useState(false);
  const { canEmit, emit, loading: emitLoading } = usePoSolicitudEmit({
    onClose,
  });

  if (!record?.id || !canEmit) return null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setEmitOpen(true)}
        className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
      >
        <CheckCircle2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
        Emitir
      </Button>
      <EmitConfirmDialog
        open={emitOpen}
        loading={emitLoading}
        onClose={() => setEmitOpen(false)}
        onEmit={() => emit(false)}
        onEmitAndShow={() => emit(true)}
      />
    </>
  );
};