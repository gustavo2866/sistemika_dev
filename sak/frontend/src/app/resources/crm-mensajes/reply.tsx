"use client";

import { useCallback, useState, useEffect } from "react";
import { useNotify, useGetIdentity } from "ra-core";
import type { CRMMensaje } from "./model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ensureReplySubject = (subject?: string | null) => {
  if (!subject) return "RE:";
  const trimmed = subject.trim();
  return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CRMMensajeReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje: CRMMensaje | null;
  onSuccess?: () => void;
}

export const CRMMensajeReplyDialog = ({
  open,
  onOpenChange,
  mensaje,
  onSuccess,
}: CRMMensajeReplyDialogProps) => {
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mensaje) {
      setSubject(ensureReplySubject(mensaje.asunto));
      setReply("");
      setContactoNombre(
        mensaje.contacto?.nombre_completo ?? mensaje.contacto?.nombre ?? ""
      );
      setExpanded(false);
    }
  }, [mensaje]);

  const handleSubmit = useCallback(async () => {
    if (!mensaje) return;
    
    const trimmedContent = reply.trim();
    const trimmedNombre = contactoNombre.trim();
    
    if (!trimmedContent) {
      notify("Completa la respuesta antes de enviar.", { type: "warning" });
      return;
    }
    
    if (!mensaje.contacto_id && !trimmedNombre) {
      notify("El nombre del contacto es obligatorio.", { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const endpoint = `${API_URL}/crm/mensajes/${mensaje.id}/responder`;
      const payload: Record<string, unknown> = {
        asunto: subject || ensureReplySubject(mensaje.asunto),
        contenido: trimmedContent,
      };
      
      if (!mensaje.contacto_id) {
        payload.contacto_nombre = trimmedNombre;
      }

      // Siempre enviar responsable_id: del mensaje o del usuario autenticado
      const responsableId = mensaje.responsable_id ?? identity?.id;
      if (responsableId) {
        payload.responsable_id = responsableId;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error al enviar la respuesta (HTTP ${response.status})`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody?.detail || errorMessage;
        } catch {
          // Ignorar errores al parsear el cuerpo
        }
        throw new Error(errorMessage);
      }

      const resultado = await response.json();
      notify("Respuesta enviada", { type: "success" });

      if (resultado.contacto_creado) {
        notify("Contacto creado automáticamente", { type: "info" });
      }
      if (resultado.oportunidad_creada) {
        notify("Oportunidad creada automáticamente", { type: "info" });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar la respuesta", { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [mensaje, reply, subject, contactoNombre, notify, onOpenChange, onSuccess]);

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!mensaje) return null;

  const contactoLabel =
    mensaje.contacto?.nombre_completo ??
    mensaje.contacto?.nombre ??
    (mensaje.contacto_id ? `Contacto #${mensaje.contacto_id}` : "Sin contacto");

  const oportunidadLabel = mensaje.oportunidad?.id
    ? `#${mensaje.oportunidad.id}`
    : mensaje.oportunidad_id
    ? `#${mensaje.oportunidad_id}`
    : "Sin oportunidad";
  const propiedadLabel = mensaje.oportunidad?.descripcion_estado ?? "Sin oportunidad";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !loading && onOpenChange(isOpen)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Responder Mensaje</DialogTitle>
          <DialogDescription>
            Envía una respuesta al mensaje. Se creará automáticamente un contacto y oportunidad si no existen.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Referencia
            </label>
            <p className="text-sm font-medium">
              {mensaje.contacto_referencia || mensaje.origen_externo_id || "Sin referencia"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contacto / Oportunidad
            </label>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-semibold text-foreground">Contacto:</span> {contactoLabel}
              </p>
              <p>
                {oportunidadLabel} - {propiedadLabel}
              </p>
            </div>
          </div>

          {!mensaje.contacto_id && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre del Contacto *
              </label>
              <Input
                value={contactoNombre}
                onChange={(event) => setContactoNombre(event.target.value)}
                placeholder="Nombre completo del contacto"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asunto
            </label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mensaje original
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Ver menos" : "Ver más"}
              >
                {expanded ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <div
              className={cn(
                "rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground transition-all",
                expanded ? "line-clamp-none" : "line-clamp-3",
              )}
            >
              {mensaje.contenido || "Sin contenido disponible."}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Respuesta *
            </label>
            <Textarea
              rows={6}
              placeholder="Escribí tu respuesta..."
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Send className="mr-2 h-4 w-4" />
            {loading ? "Enviando..." : "Enviar respuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
