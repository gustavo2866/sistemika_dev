"use client";

import { useCallback, useMemo, useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ESTADOS_PROPIEDAD_OPTIONS,
  type PropiedadEstado,
  TRANSICIONES_ESTADO_PROPIEDAD,
  formatEstadoPropiedad,
} from "../model";

type ChangeStateDialogProps = {
  propiedadId: number;
  currentEstado: PropiedadEstado;
  estadoFecha?: string | null;  // Fecha del estado actual para validación
  className?: string;
  onCompleted?: () => void;
  trigger?: React.ReactNode;  // Trigger personalizado opcional
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Función helper para formatear fecha para input datetime-local
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const ChangeStateDialog = ({ propiedadId, currentEstado, estadoFecha, className, onCompleted, trigger }: ChangeStateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<PropiedadEstado>(currentEstado);
  const [comentario, setComentario] = useState("");
  const [fecha, setFecha] = useState<string>(() => formatDateForInput(new Date()));
  const [notifDestinatario, setNotifDestinatario] = useState("");
  const [loading, setLoading] = useState(false);
  const [fechaError, setFechaError] = useState<string | null>(null);
  const notify = useNotify();
  const refresh = useRefresh();

  // Calcular la fecha mínima permitida (fecha del estado actual)
  const minFecha = useMemo(() => {
    if (!estadoFecha) return null;
    try {
      const date = new Date(estadoFecha);
      return formatDateForInput(date);
    } catch {
      return null;
    }
  }, [estadoFecha]);

  const opcionesDisponibles = useMemo(() => {
    const posibles = TRANSICIONES_ESTADO_PROPIEDAD[currentEstado] ?? [];
    return ESTADOS_PROPIEDAD_OPTIONS.filter((option) => posibles.includes(option.value));
  }, [currentEstado]);

  // Validar fecha cuando cambia
  const handleFechaChange = useCallback((value: string) => {
    setFecha(value);
    
    if (minFecha && value < minFecha) {
      setFechaError(`La fecha no puede ser anterior a ${new Date(minFecha).toLocaleString('es-AR')}`);
    } else {
      setFechaError(null);
    }
  }, [minFecha]);

  const handleSubmit = useCallback(async () => {
    if (!propiedadId) return;
    
    // Validar fecha antes de enviar
    if (fechaError) {
      notify(fechaError, { type: "error" });
      return;
    }
    
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      // Convertir fecha local a ISO string para el backend
      const fechaISO = new Date(fecha).toISOString();
      
      const response = await fetch(`${API_URL}/propiedades/${propiedadId}/cambiar-estado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nuevo_estado: nuevoEstado,
          comentario: comentario || undefined,
          fecha: fechaISO,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail ?? "No se pudo cambiar el estado");
      }

      notify(`Estado actualizado a ${formatEstadoPropiedad(nuevoEstado)}`, { type: "success" });
      setOpen(false);
      setComentario("");
      setFecha(formatDateForInput(new Date()));
      setNotifDestinatario("");
      setFechaError(null);
      onCompleted?.();
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      notify(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [comentario, notify, nuevoEstado, onCompleted, propiedadId, refresh, fecha, fechaError]);

  if (!opcionesDisponibles.length) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <div onClick={() => setOpen(true)}>
          {trigger}
        </div>
      ) : (
        <DialogTrigger asChild>
          <Button className={className} size="sm" variant="default">
            Cambiar estado
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar estado de la propiedad</DialogTitle>
          <DialogDescription>
            Estado actual: <strong>{formatEstadoPropiedad(currentEstado)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nuevo-estado">Nuevo estado</Label>
            <Select value={nuevoEstado} onValueChange={(value) => setNuevoEstado(value as PropiedadEstado)}>
              <SelectTrigger id="nuevo-estado">
                <SelectValue placeholder="Seleccione un estado" />
              </SelectTrigger>
              <SelectContent>
                {opcionesDisponibles.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha-estado">Fecha del cambio</Label>
            <Input
              id="fecha-estado"
              type="datetime-local"
              value={fecha}
              onChange={(e) => handleFechaChange(e.target.value)}
              min={minFecha || undefined}
              className={fechaError ? "border-red-500" : ""}
            />
            {fechaError && (
              <p className="text-xs text-red-600">{fechaError}</p>
            )}
            {minFecha && !fechaError && (
              <p className="text-xs text-muted-foreground">
                La fecha debe ser igual o posterior al {new Date(minFecha).toLocaleString('es-AR', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comentario-estado">Comentario</Label>
            <Textarea
              id="comentario-estado"
              rows={4}
              placeholder="Detalle las tareas o motivo de la transicion"
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-destinatario">Avisar a (opcional)</Label>
            <Input
              id="notif-destinatario"
              placeholder="correo@empresa.com"
              value={notifDestinatario}
              onChange={(event) => setNotifDestinatario(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Este campo es informativo por ahora y permite registrar a quien se notifico manualmente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !!fechaError}>
            {loading ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
