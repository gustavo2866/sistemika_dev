"use client";

import { useState } from "react";
import { useRecordContext } from "ra-core";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PoSolicitud } from "./model";
import { usePoSolicitudConfirm } from "./form_hooks";

const ConfirmDialog = ({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : onClose())}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Confirmar solicitud</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Al confirmar, la solicitud quedará en estado Pendiente esperando
        aprobación.
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
        <Button type="button" onClick={onConfirm} disabled={loading}>
          Confirmar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FormConfirmar = () => {
  const record = useRecordContext<PoSolicitud>();
  const [open, setOpen] = useState(false);
  const { canConfirm, confirm, loading } = usePoSolicitudConfirm();

  if (!canConfirm) return null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
      >
        <CheckCircle2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
        Confirmar
      </Button>
      <ConfirmDialog
        open={open}
        loading={loading}
        onClose={() => setOpen(false)}
        onConfirm={() => confirm(() => setOpen(false))}
      />
    </>
  );
};
