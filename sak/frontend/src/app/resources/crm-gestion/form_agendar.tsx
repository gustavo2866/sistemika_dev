"use client";

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

type FormAgendarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendaDate: string;
  agendaTime: string;
  onAgendaDateChange: (value: string) => void;
  onAgendaTimeChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export const FormAgendarDialog = ({
  open,
  onOpenChange,
  agendaDate,
  agendaTime,
  onAgendaDateChange,
  onAgendaTimeChange,
  onSubmit,
  loading,
}: FormAgendarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Agendar evento</DialogTitle>
        <DialogDescription>Selecciona fecha y hora.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-1 text-left">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <input
              type="date"
              value={agendaDate}
              onChange={(event) => onAgendaDateChange(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hora</Label>
            <input
              type="time"
              value={agendaTime}
              onChange={(event) => onAgendaTimeChange(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
        >
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={loading} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
          {loading ? "Agendando..." : "Agendar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
