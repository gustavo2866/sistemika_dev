"use client";

import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CRMOportunidad } from "../crm-oportunidades/model";

interface CRMOportunidadDescartarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad | null;
  onCompleted?: () => void;
  disabled?: boolean;
}

export const CRMOportunidadDescartarDialog = ({
  open,
  onOpenChange,
  record,
  onCompleted,
  disabled = false,
}: CRMOportunidadDescartarDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!record) return;
    setIsSubmitting(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { activo: false },
        previousData: record,
      });
      notify("Oportunidad descartada exitosamente", { type: "success" });
      refresh();
      onOpenChange(false);
      onCompleted?.();
    } catch (error: any) {
      notify(error.message || "Error al descartar la oportunidad", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Descartar oportunidad</DialogTitle>
          <DialogDescription>
            Esta accion marcara la oportunidad como inactiva. Podras reactivarla mas tarde si es necesario.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled || isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={disabled || isSubmitting}
          >
            {disabled || isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descartar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CRMOportunidadDescartarDialog;
