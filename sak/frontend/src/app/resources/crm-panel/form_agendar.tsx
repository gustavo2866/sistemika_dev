"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetIdentity, useGetList, useNotify, useRefresh } from "ra-core";
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

type AgendarFormValues = {
  titulo: string;
  descripcion: string;
  tipoEvento: string;
  datetime: string;
  asignadoId: string;
};

interface AgendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad | null;
  onCompleted?: () => void;
  disabled?: boolean;
}

export const CRMOportunidadAgendarDialog = ({
  open,
  onOpenChange,
  record,
  onCompleted,
  disabled = false,
}: AgendarDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<AgendarFormValues>({
    titulo: "",
    descripcion: "",
    tipoEvento: "",
    datetime: "",
    asignadoId: "",
  });
  const { data: tiposEventoData = [] } = useGetList("crm/catalogos/tipos-evento", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: responsablesData = [] } = useGetList("users", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "nombre", order: "ASC" },
  });

  const tipoEventoChoices = useMemo(
    () =>
      tiposEventoData.map((tipo: any) => ({
        value: String(tipo.id),
        label: tipo.nombre ?? tipo.descripcion ?? `Tipo #${tipo.id}`,
      })),
    [tiposEventoData]
  );

  const responsableChoices = useMemo(
    () =>
      responsablesData.map((user: any) => ({
        value: String(user.id),
        label: user.nombre ?? user.email ?? `Usuario #${user.id}`,
      })),
    [responsablesData]
  );

  useEffect(() => {
    if (!open) return;
    if (!record) {
      setFormValues({
        titulo: "",
        descripcion: "",
        tipoEvento: "",
        datetime: "",
        asignadoId: "",
      });
      return;
    }
    setFormValues({
      titulo: `Visita ${record.titulo || ""}`,
      descripcion: "",
      tipoEvento: "",
      datetime: "",
      asignadoId: identity?.id ? String(identity.id) : "",
    });
  }, [open, record, identity]);

  useEffect(() => {
    if (!open) return;
    if (!formValues.tipoEvento && tipoEventoChoices.length > 0) {
      setFormValues((prev) => ({ ...prev, tipoEvento: tipoEventoChoices[0].value }));
    }
  }, [open, formValues.tipoEvento, tipoEventoChoices]);

  const handleSubmit = async () => {
    if (!record) return;
    if (!formValues.titulo || !formValues.tipoEvento || !formValues.datetime || !formValues.asignadoId) {
      notify("Por favor completa todos los campos requeridos", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dataProvider.create("crm/eventos", {
        data: {
          titulo: formValues.titulo,
          descripcion: formValues.descripcion,
          tipo_evento_id: Number(formValues.tipoEvento),
          fecha: formValues.datetime,
          asignado_id: Number(formValues.asignadoId),
          oportunidad_id: record.id,
          estado: 1,
        },
      });

      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { estado: "2-visita", fecha_estado: new Date().toISOString() },
        previousData: record,
      });

      notify("Visita agendada exitosamente", { type: "success" });
      refresh();
      onOpenChange(false);
      onCompleted?.();
    } catch (error: any) {
      notify(error.message || "Error al agendar la visita", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>Crea un evento de visita y avanza al siguiente estado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 text-left">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">T?tulo *</Label>
            <input
              type="text"
              value={formValues.titulo}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, titulo: event.target.value }))
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
                  setFormValues((prev) => ({ ...prev, tipoEvento: event.target.value }))
                }
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {tipoEventoChoices.map((choice) => (
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
                  setFormValues((prev) => ({ ...prev, datetime: event.target.value }))
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
                setFormValues((prev) => ({ ...prev, asignadoId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Selecciona responsable</option>
              {responsableChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Descripci?n</Label>
            <textarea
              rows={3}
              value={formValues.descripcion}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, descripcion: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              placeholder="Notas adicionales de la visita"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled || isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={disabled || isSubmitting}>
            {disabled || isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar visita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CRMOportunidadAgendarDialog;
