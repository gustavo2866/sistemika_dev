"use client";

import { useCallback, useState, useEffect } from "react";
import { useNotify, useGetIdentity, useDataProvider } from "ra-core";
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
  const dataProvider = useDataProvider();
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [tipoOperacionId, setTipoOperacionId] = useState("");
  const [tipoOperacionLoading, setTipoOperacionLoading] = useState(false);

  useEffect(() => {
    if (mensaje) {
      setSubject(ensureReplySubject(mensaje.asunto));
      setReply("");
      setContactoNombre(
        mensaje.contacto?.nombre_completo ?? mensaje.contacto?.nombre ?? ""
      );
      setExpanded(false);
      if (mensaje.oportunidad_id) {
        setTipoOperacionId("");
      }
    }
  }, [mensaje]);

  useEffect(() => {
    if (!open || !mensaje || mensaje.oportunidad_id) {
      return;
    }
    let cancelled = false;
    const loadTiposOperacion = async () => {
      setTipoOperacionLoading(true);
      try {
        const { data } = await dataProvider.getList("crm/catalogos/tipos-operacion", {
          pagination: { page: 1, perPage: 50 },
          sort: { field: "id", order: "ASC" },
          filter: {},
        });
        const normalize = (value?: string | null) => value?.toLowerCase() ?? "";
        const filtered = (data ?? []).filter((item: any) => {
          const text = `${normalize(item?.nombre)} ${normalize(item?.codigo)}`;
          return text.includes("venta") || text.includes("alquiler");
        });
        const base = (filtered.length ? filtered : data) ?? [];
        const mapped = base
          .filter((item: any) => item?.id != null)
          .map((item: any) => ({
            id: String(item.id),
            label: item.nombre ?? item.codigo ?? `#${item.id}`,
          }));
        if (!cancelled) {
          setTipoOperacionOptions(mapped);
        }
      } catch (error) {
        console.error("No se pudieron cargar los tipos de operación:", error);
        if (!cancelled) {
          setTipoOperacionOptions([]);
        }
      } finally {
        if (!cancelled) {
          setTipoOperacionLoading(false);
        }
      }
    };
    loadTiposOperacion();
    return () => {
      cancelled = true;
    };
  }, [open, mensaje?.id, mensaje?.oportunidad_id, dataProvider]);

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
    
    if (!mensaje.oportunidad_id && !tipoOperacionId) {
      notify("Selecciona el tipo de operación (venta o alquiler).", { type: "warning" });
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
      if (!mensaje.oportunidad_id && tipoOperacionId) {
        payload.tipo_operacion_id = Number(tipoOperacionId);
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

      setTipoOperacionId("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar la respuesta", { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [mensaje, reply, subject, contactoNombre, notify, onOpenChange, onSuccess, identity?.id, tipoOperacionId]);

  const handleCancel = () => {
    setTipoOperacionId("");
    onOpenChange(false);
  };

  if (!mensaje) return null;

  const contactoLabel =
    mensaje.contacto?.nombre_completo ??
    mensaje.contacto?.nombre ??
    (mensaje.contacto_id ? `Contacto #${mensaje.contacto_id}` : "No agendado");

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
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          <section className="space-y-4 rounded-2xl border border-border/40 bg-muted/10 p-4">
            <div className="space-y-2 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Contexto
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Referencia</p>
                  <p className="font-medium text-foreground">
                    {mensaje.contacto_referencia || mensaje.origen_externo_id || "Sin referencia"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado actual
                  </p>
                  <div className="rounded-lg border bg-background/80 p-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Contacto:</span> {contactoLabel}
                    </p>
                    <p>
                      {oportunidadLabel} · {propiedadLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {!mensaje.contacto_id && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Nombre del contacto *
                  </p>
                  <Input
                    value={contactoNombre}
                    onChange={(event) => setContactoNombre(event.target.value)}
                    placeholder="Nombre completo del contacto"
                    className="h-10"
                  />
                </div>
              )}
              {!mensaje.oportunidad_id && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipo de operación *
                  </p>
                  <select
                    value={tipoOperacionId}
                    onChange={(event) => setTipoOperacionId(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona venta o alquiler</option>
                    {tipoOperacionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {tipoOperacionLoading ? (
                    <p className="text-[11px] text-muted-foreground">Cargando opciones...</p>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/40 bg-background p-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Asunto</p>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-10" />
            </div>
            <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-[0_0_20px_rgba(37,99,235,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Respuesta *
              </p>
              <Textarea
                rows={6}
                placeholder="Escribí tu respuesta..."
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                className="min-h-[150px] resize-none border border-primary/40 bg-white/95 shadow-inner focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>
          </section>
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
