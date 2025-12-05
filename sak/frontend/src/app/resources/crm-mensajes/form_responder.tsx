"use client";

import { useCallback, useState, useEffect } from "react";
import { useNotify, useGetIdentity, useDataProvider } from "ra-core";
import type { CRMMensaje } from "./model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ensureReplySubject = (subject?: string | null) => {
  if (!subject) return "RE:";
  const trimmed = subject.trim();
  return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FIELD_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const INPUT_BASE_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 bg-white/95 px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
const TEXTAREA_CLASS =
  "min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 resize-none";
const SECTION_CARD_CLASS =
  "rounded-2xl border border-slate-200/60 bg-white/95 p-4 shadow-sm";

interface CRMMensajeReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje: CRMMensaje | null;
  onSuccess?: () => void;
}

export const CRMMensajeReplyDialog = ({ open, onOpenChange, mensaje, onSuccess }: CRMMensajeReplyDialogProps) => {
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [tipoOperacionId, setTipoOperacionId] = useState("");
  const [tipoOperacionLoading, setTipoOperacionLoading] = useState(false);

  useEffect(() => {
    if (!mensaje) return;
    setSubject(ensureReplySubject(mensaje.asunto));
    setReply("");
    setContactoNombre(mensaje.contacto?.nombre_completo ?? mensaje.contacto?.nombre ?? "");
    if (mensaje.oportunidad_id) {
      setTipoOperacionId("");
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
        console.error("No se pudieron cargar los tipos de operacion", error);
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
  }, [open, mensaje, dataProvider]);

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
      notify("Selecciona el tipo de operacion (venta o alquiler).", { type: "warning" });
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
          // ignore
        }
        throw new Error(errorMessage);
      }

      const resultado = await response.json();
      notify("Respuesta enviada", { type: "success" });
      if (resultado.contacto_creado) {
        notify("Contacto creado automaticamente", { type: "info" });
      }
      if (resultado.oportunidad_creada) {
        notify("Oportunidad creada automaticamente", { type: "info" });
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
  const contactoReferencia =
    mensaje.contacto_referencia ?? mensaje.origen_externo_id ?? mensaje.contacto_alias ?? "Sin referencia";
  const oportunidadLabel = mensaje.oportunidad?.descripcion_estado ?? "Sin oportunidad asociada";
  const propiedadLabel =
    mensaje.oportunidad?.propiedad?.nombre ??
    (mensaje.oportunidad?.propiedad?.id ? `Propiedad #${mensaje.oportunidad.propiedad.id}` : "");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !loading && onOpenChange(isOpen)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/98 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.2)] flex flex-col">
        <DialogHeader className="border-b border-slate-100 px-5 py-3.5">
          <DialogTitle className="text-xl font-semibold text-slate-900">Responder mensaje</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <section className={SECTION_CARD_CLASS}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <p className={FIELD_LABEL_CLASS}>Contacto</p>
                  <p className="text-sm font-semibold text-slate-900">{contactoLabel}</p>
                  <p className="text-xs text-slate-500">{contactoReferencia}</p>
                </div>
                <div className="space-y-1.5">
                  <p className={FIELD_LABEL_CLASS}>Oportunidad</p>
                  <p className="text-sm font-semibold text-slate-900">{oportunidadLabel}</p>
                  {propiedadLabel ? <p className="text-xs text-slate-500">{propiedadLabel}</p> : null}
                </div>
              </div>
              {(!mensaje.contacto_id || !mensaje.oportunidad_id) && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {!mensaje.contacto_id && (
                    <div className="space-y-1">
                      <p className={FIELD_LABEL_CLASS}>Nombre del contacto *</p>
                      <Input
                        value={contactoNombre}
                        onChange={(event) => setContactoNombre(event.target.value)}
                        placeholder="Nombre completo del contacto"
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                  )}
                  {!mensaje.oportunidad_id && (
                    <div className="space-y-1">
                      <p className={FIELD_LABEL_CLASS}>Tipo de operacion *</p>
                      <select
                        value={tipoOperacionId}
                        onChange={(event) => setTipoOperacionId(event.target.value)}
                        className={INPUT_BASE_CLASS}
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
              )}
            </section>

            <section className={SECTION_CARD_CLASS}>
              <div className="space-y-1">
                <p className={FIELD_LABEL_CLASS}>Asunto</p>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className={INPUT_BASE_CLASS}
                />
              </div>
              <div className="mt-4 space-y-1">
                <p className={FIELD_LABEL_CLASS}>Respuesta *</p>
                <Textarea
                  rows={6}
                  placeholder="Escribi tu respuesta..."
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  className={TEXTAREA_CLASS}
                />
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-3">
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
