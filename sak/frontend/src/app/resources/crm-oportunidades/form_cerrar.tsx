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
import { Label } from "@/components/ui/label";

interface CerrarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motivoOptions: Array<{ value: string; label: string }>;
  perderMotivoId: string;
  onPerderMotivoChange: (value: string) => void;
  perderNota: string;
  onPerderNotaChange: (value: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export const CRMOportunidadCerrarDialog = ({
  open,
  onOpenChange,
  motivoOptions,
  perderMotivoId,
  onPerderMotivoChange,
  perderNota,
  onPerderNotaChange,
  onConfirm,
  disabled = false,
}: CerrarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>Cerrar oportunidad como perdida</DialogTitle>
        <DialogDescription>Selecciona el motivo y confirma el cierre.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2 text-left">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Motivo *</Label>
          <select
            value={perderMotivoId}
            onChange={(event) => onPerderMotivoChange(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <option value="">Selecciona motivo</option>
            {motivoOptions.map((motivo) => (
              <option key={motivo.value} value={motivo.value}>
                {motivo.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Notas</Label>
          <textarea
            rows={3}
            value={perderNota}
            onChange={(event) => onPerderNotaChange(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            placeholder="Información adicional (opcional)"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={disabled}>
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar oportunidad"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadCerrarDialog;
