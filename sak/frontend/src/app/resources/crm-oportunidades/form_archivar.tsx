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

interface CRMOportunidadArchivarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export const CRMOportunidadArchivarDialog = ({
  open,
  onOpenChange,
  onConfirm,
  disabled = false,
}: CRMOportunidadArchivarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>Archivar oportunidad</DialogTitle>
        <DialogDescription>
          Esta acción oculta la oportunidad del panel manteniendo el historial intacto. ¿Deseas continuar?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={disabled}>
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archivar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadArchivarDialog;
