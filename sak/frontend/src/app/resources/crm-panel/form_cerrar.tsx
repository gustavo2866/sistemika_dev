"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
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
import type { CRMOportunidad } from "../crm-oportunidades/model";

interface CerrarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad | null;
  onCompleted?: () => void;
  disabled?: boolean;
}

export const CRMOportunidadCerrarDialog = ({
  open,
  onOpenChange,
  record,
  onCompleted,
  disabled = false,
}: CerrarDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [perderMotivoId, setPerderMotivoId] = useState("");
  const [perderNota, setPerderNota] = useState("");

  const { data: motivosData = [] } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "nombre", order: "ASC" },
  });

  const motivosChoices = useMemo(
    () =>
      motivosData.map((motivo: any) => ({
        value: String(motivo.id),
        label: motivo.nombre ?? `Motivo #${motivo.id}`,
      })),
    [motivosData]
  );

  useEffect(() => {
    if (!open) return;
    setPerderMotivoId("");
    setPerderNota("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!perderMotivoId && motivosChoices.length > 0) {
      setPerderMotivoId(motivosChoices[0].value);
    }
  }, [open, perderMotivoId, motivosChoices]);

  const handleSubmit = async () => {
    if (!record) return;
    if (!perderMotivoId) {
      notify("Por favor selecciona un motivo", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: {
          estado: "6-perdida",
          fecha_estado: new Date().toISOString(),
          perder_motivo_id: Number(perderMotivoId),
          perder_nota: perderNota || null,
        },
        previousData: record,
      });

      notify("Oportunidad cerrada como perdida", { type: "success" });
      refresh();
      onOpenChange(false);
      onCompleted?.();
    } catch (error: any) {
      notify(error.message || "Error al cerrar la oportunidad", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
              onChange={(event) => setPerderMotivoId(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Selecciona motivo</option>
              {motivosChoices.map((motivo) => (
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
              onChange={(event) => setPerderNota(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              placeholder="Informacion adicional (opcional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled || isSubmitting}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={disabled || isSubmitting}>
            {disabled || isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar oportunidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CRMOportunidadCerrarDialog;
