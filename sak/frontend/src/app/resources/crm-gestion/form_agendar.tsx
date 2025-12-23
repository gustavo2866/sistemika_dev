"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
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
import { splitDateTime, type GestionItem } from "./model";

type FormAgendarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvento: GestionItem | null;
  onSuccess?: (evento: GestionItem, fechaEvento: string) => void;
  onError?: (error: unknown) => void;
};

export const FormAgendarDialog = ({
  open,
  onOpenChange,
  selectedEvento,
  onSuccess,
  onError,
}: FormAgendarDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);
  const initial = useMemo(
    () => splitDateTime(selectedEvento?.fecha_evento),
    [selectedEvento]
  );
  const [agendaDate, setAgendaDate] = useState(initial.date);
  const [agendaTime, setAgendaTime] = useState(initial.time);

  useEffect(() => {
    if (!open) return;
    const next = splitDateTime(selectedEvento?.fecha_evento);
    setAgendaDate(next.date);
    setAgendaTime(next.time);
  }, [open, selectedEvento]);

  const handleSubmit = async () => {
    if (!selectedEvento || !agendaDate || !agendaTime) {
      notify("Selecciona fecha y hora", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      const fecha_evento = `${agendaDate}T${agendaTime}`;
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: { fecha_evento },
        previousData: selectedEvento,
      });
      notify("Evento actualizado", { type: "success" });
      refresh();
      onSuccess?.(selectedEvento, fecha_evento);
      onOpenChange(false);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo actualizar el evento", { type: "error" });
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return (
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
                onChange={(event) => setAgendaDate(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hora</Label>
              <input
                type="time"
                value={agendaTime}
                onChange={(event) => setAgendaTime(event.target.value)}
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
          <Button onClick={handleSubmit} disabled={loading} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
            {loading ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
