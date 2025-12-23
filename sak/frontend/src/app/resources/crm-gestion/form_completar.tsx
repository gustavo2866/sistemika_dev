"use client";

import { useEffect, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_OPORTUNIDAD_ESTADO_CHOICES } from "@/app/resources/crm-oportunidades/model";
import { getContactName, getTipoLabel, type GestionItem } from "./model";

type FormCompletarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvento: GestionItem | null;
  onSuccess?: (evento: GestionItem) => void;
  onError?: (error: unknown) => void;
};

const getContactNameSafe = (item: GestionItem | null) => {
  if (!item) return "Sin contacto";
  return getContactName(item);
};

export const FormCompletarDialog = ({
  open,
  onOpenChange,
  selectedEvento,
  onSuccess,
  onError,
}: FormCompletarDialogProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [resultado, setResultado] = useState("");
  const [nuevoEstadoOportunidad, setNuevoEstadoOportunidad] = useState("");
  const [motivoPerdidaId, setMotivoPerdidaId] = useState("");
  const [motivoPerdidaError, setMotivoPerdidaError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResultado("");
    const estadoActual =
      selectedEvento?.oportunidad_estado ?? selectedEvento?.oportunidad?.estado ?? "";
    setNuevoEstadoOportunidad(estadoActual || "");
    setMotivoPerdidaId("");
    setMotivoPerdidaError("");
  }, [open, selectedEvento]);

  const handleNuevoEstadoChange = (value: string) => {
    setNuevoEstadoOportunidad(value);
    if (value !== "6-perdida") {
      setMotivoPerdidaId("");
      setMotivoPerdidaError("");
    }
  };

  const handleMotivoPerdidaChange = (value: string) => {
    setMotivoPerdidaId(value);
    if (value) {
      setMotivoPerdidaError("");
    }
  };

  const handleSubmit = async () => {
    if (!selectedEvento) return;
    const isPerdida = nuevoEstadoOportunidad === "6-perdida";
    if (isPerdida && !motivoPerdidaId) {
      setMotivoPerdidaError("Selecciona un motivo de perdida");
      notify("Selecciona un motivo de perdida", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: {
          estado_evento: "2-realizado",
          resultado,
          fecha_estado: new Date().toISOString(),
        },
        previousData: selectedEvento,
      });
      const estadoActual =
        selectedEvento.oportunidad_estado ?? selectedEvento.oportunidad?.estado ?? "";
      const shouldUpdateOportunidad =
        Boolean(nuevoEstadoOportunidad) &&
        Boolean(selectedEvento.oportunidad?.id) &&
        nuevoEstadoOportunidad !== estadoActual;

      if (shouldUpdateOportunidad) {
        await dataProvider.update("crm/oportunidades", {
          id: selectedEvento.oportunidad?.id,
          data: {
            estado: nuevoEstadoOportunidad,
            motivo_perdida_id: isPerdida ? Number(motivoPerdidaId) || null : null,
            fecha_estado: new Date().toISOString(),
          },
          previousData: selectedEvento.oportunidad,
        });
      }

      notify("Evento completado", { type: "success" });
      refresh();
      onSuccess?.(selectedEvento);
      onOpenChange(false);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo completar el evento", { type: "error" });
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const { data: motivosPerdida = [] } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedEvento?.tipo_evento
              ? `Completar ${selectedEvento.tipo_evento}`
              : "Completar evento"}
          </DialogTitle>
          <DialogDescription>Registra el resultado y marca como completado.</DialogDescription>
        </DialogHeader>
        {selectedEvento ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">
                {getTipoLabel(selectedEvento.tipo_evento)}
              </span>
              <span className="text-slate-400">•</span>
              <span className="truncate">{selectedEvento.titulo || "Sin titulo"}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span>Contacto: {getContactNameSafe(selectedEvento)}</span>
              <span className="text-slate-400">•</span>
              <span>
                Oportunidad:{" "}
                {selectedEvento.oportunidad?.id
                  ? `#${String(selectedEvento.oportunidad.id).padStart(6, "0")} ${selectedEvento.oportunidad_titulo ?? ""}`
                  : "Sin oportunidad"}
              </span>
            </div>
            <div className="mt-1">
              Estado actual oportunidad:{" "}
              {selectedEvento.oportunidad_estado ??
                selectedEvento.oportunidad?.estado ??
                "Sin estado"}
            </div>
          </div>
        ) : null}
        <div className="space-y-3 py-1 text-left">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Resultado</Label>
            <textarea
              rows={3}
              value={resultado}
              onChange={(event) => setResultado(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
              placeholder="Resultado de la actividad"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Nuevo estado de la oportunidad
            </Label>
            <Select value={nuevoEstadoOportunidad} onValueChange={handleNuevoEstadoChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                {CRM_OPORTUNIDAD_ESTADO_CHOICES.map((estado) => (
                  <SelectItem key={estado.id} value={estado.id}>
                    {estado.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {nuevoEstadoOportunidad === "6-perdida" ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Motivo de perdida
              </Label>
              <Select value={motivoPerdidaId} onValueChange={handleMotivoPerdidaChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {(motivosPerdida as any[]).map((motivo) => (
                    <SelectItem key={motivo.id} value={String(motivo.id)}>
                      {motivo.codigo ? `${motivo.codigo} - ${motivo.nombre}` : motivo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {motivoPerdidaError ? (
                <p className="text-xs text-destructive">{motivoPerdidaError}</p>
              ) : null}
            </div>
          ) : null}
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
            {loading ? "Guardando..." : "Completar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
