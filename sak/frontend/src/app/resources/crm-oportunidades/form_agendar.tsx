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

interface AgendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formValues: {
    titulo: string;
    descripcion: string;
    tipoEvento: string;
    datetime: string;
    asignadoId: string;
  };
  onFormChange: (
    updater:
      | typeof formValues
      | ((prev: AgendarDialogProps["formValues"]) => AgendarDialogProps["formValues"]),
  ) => void;
  tipoEventoOptions: Array<{ value: string; label: string }>;
  responsableOptions: Array<{ value: string; label: string }>;
  onSubmit: () => void;
  disabled?: boolean;
}

export const CRMOportunidadAgendarDialog = ({
  open,
  onOpenChange,
  formValues,
  onFormChange,
  tipoEventoOptions,
  responsableOptions,
  onSubmit,
  disabled = false,
}: AgendarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Agendar visita</DialogTitle>
        <DialogDescription>Crea un evento de visita y avanza al siguiente estado.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-1 text-left">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Título *</Label>
          <input
            type="text"
            value={formValues.titulo}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, titulo: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tipo *</Label>
            <select
              value={formValues.tipoEvento}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, tipoEvento: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              {tipoEventoOptions.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Fecha y hora *</Label>
            <input
              type="datetime-local"
              value={formValues.datetime}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, datetime: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Asignado a *</Label>
          <select
            value={formValues.asignadoId}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, asignadoId: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <option value="">Selecciona responsable</option>
            {responsableOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Descripción</Label>
          <textarea
            rows={3}
            value={formValues.descripcion}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, descripcion: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            placeholder="Notas adicionales de la visita"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={disabled}>
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar visita"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadAgendarDialog;
