"use client";

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

interface CRMOportunidadDescartarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export const CRMOportunidadDescartarDialog = ({
  open,
  onOpenChange,
  onConfirm,
  disabled = false,
}: CRMOportunidadDescartarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>Descartar oportunidad</DialogTitle>
        <DialogDescription>
          Esta acción marcará la oportunidad como inactiva. Podrás reactivarla más tarde si es necesario.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={disabled}>
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descartar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadDescartarDialog;
