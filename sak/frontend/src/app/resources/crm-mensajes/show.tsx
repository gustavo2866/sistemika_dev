"use client";

import { useEffect, useState } from "react";
import { Show } from "@/components/show";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
} from "ra-core";
import type { CRMMensaje } from "./model";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircle,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { ActividadesPanel } from "../crm-actividades/Panel";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
  type CRMOportunidadEstado,
} from "../crm-oportunidades/model";

const ensureReplySubject = (subject?: string | null) => {
  if (!subject) return "RE:";
  const trimmed = subject.trim();
  return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const CRMMensajeShow = () => (
  <Show showBreadcrumb={false}>
    <CRMMensajeMinimalView />
  </Show>
);

const CRMMensajeMinimalView = () => {
  const record = useRecordContext<CRMMensaje>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const initialAction = (location.state as { action?: string } | null)?.action;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardLoading, setDiscardLoading] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replySubject, setReplySubject] = useState(() => ensureReplySubject(record?.asunto));
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [contactoNombre, setContactoNombre] = useState("");
  const [actividadesReload, setActividadesReload] = useState(0);
  const [cameFromAction, setCameFromAction] = useState(false);

  useEffect(() => {
    if (initialAction === "discard") {
      setDiscardOpen(true);
      setCameFromAction(true);
    }
    if (initialAction) {
      navigate(".", { replace: true, state: null });
    }
  }, [initialAction, navigate]);

  useEffect(() => {
    setReplySubject(ensureReplySubject(record?.asunto));

    // Inicializar nombre del contacto si existe
    if (record?.contacto?.nombre_completo) {
      setContactoNombre(record.contacto.nombre_completo);
    } else {
      setContactoNombre("");
    }
  }, [record?.asunto, record?.contacto]);

  if (!record) return null;

  const contactoNombreReal = record.contacto?.nombre_completo ?? record.contacto?.nombre ?? "";
  const referenciaBase = record.contacto_referencia || record.origen_externo_id || "Sin referencia";
  const referenciaTexto =
    record.contacto_id && contactoNombreReal
      ? `${referenciaBase} -> ${contactoNombreReal}`
      : referenciaBase;
  const oportunidadTexto = record.oportunidad_id
    ? `${record.oportunidad?.descripcion_estado ?? record.oportunidad?.nombre ?? "Sin titulo"} (${record.oportunidad_id})`
    : "";
  const hasOportunidad = Boolean(record.oportunidad_id);
  const estadoOportunidad = hasOportunidad ? (record.oportunidad?.estado as CRMOportunidadEstado | undefined) : undefined;
  const estadoNumero = estadoOportunidad ? estadoOportunidad.split("-")[0] : undefined;
  const estadoNombre = estadoOportunidad ? formatEstadoOportunidad(estadoOportunidad) : undefined;
  const estadoBadgeText =
    estadoNumero && estadoNombre
      ? `${estadoNumero} ${estadoNombre}`
      : estadoNombre ?? estadoNumero ?? "OK";
  const estadoBadgeClass = estadoOportunidad
    ? CRM_OPORTUNIDAD_ESTADO_BADGES[estadoOportunidad]
    : "bg-slate-400 text-white";

  const handleDescartar = async () => {
    setDiscardLoading(true);
    try {
      await dataProvider.update("crm/mensajes", {
        id: record.id,
        data: { ...record, estado: "descartado" },
        previousData: record,
      });
      notify("Mensaje descartado", { type: "success" });
      setDiscardOpen(false);
      redirect("list", "crm/mensajes");
    } catch (error: any) {
      notify(error?.message ?? "No se pudo descartar el mensaje", { type: "warning" });
    } finally {
      setDiscardLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!record) return;
    if (!replyContent.trim()) {
      notify("Completa la respuesta antes de enviar.", { type: "warning"});
      return;
    }
    
    // Debug: verificar valores antes de enviar
    console.log("DEBUG handleReplySubmit:");
    console.log("  - record.contacto_id:", record.contacto_id);
    console.log("  - contactoNombre:", contactoNombre);
    console.log("  - contactoNombre.trim():", contactoNombre.trim());
    
    // Validar nombre de contacto si no existe
    if (!record.contacto_id && !contactoNombre.trim()) {
      notify("El nombre del contacto es obligatorio.", { type: "warning" });
      return;
    }
    
    setReplyLoading(true);
    try {
      const payloadToSend = {
        texto: replyContent,
      };
      
      console.log("Payload a enviar:", payloadToSend);
      
      const response = await fetch(`${API_URL}/crm/mensajes/${record.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al enviar la respuesta");
      }
      
      const resultado = await response.json();
      notify("Respuesta guardada para enviar", { type: "success" });
      
      if (resultado.contacto_creado) {
        notify("Contacto creado automáticamente", { type: "info" });
      }
      if (resultado.oportunidad_creada) {
        notify("Oportunidad creada automáticamente", { type: "info" });
      }
      
      setReplyLoading(false);
      setReplyDialogOpen(false);
      setReplyContent("");
      setContactoNombre("");
      refresh();
      setActividadesReload((prev) => prev + 1);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo guardar la respuesta", { type: "warning" });
      setReplyLoading(false);
    }
  };



  return (
    <>
      <div className="mr-auto flex w-full max-w-6xl flex-col gap-6 rounded-[32px] border border-border/60 bg-background/80 p-4 shadow-lg backdrop-blur lg:flex-row lg:items-stretch">
        <Card className="flex w-full flex-col gap-6 rounded-[28px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-8 shadow-xl lg:basis-[64%] lg:self-stretch">
          <div className="flex flex-col gap-2 border-b border-border/30 pb-2 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Seccion</p>
              <h2 className="text-3xl font-semibold text-foreground">Mensaje</h2>
            </div>
            <div className="lg:ml-auto">
              {record.estado === "nuevo" && (
                <Button
                  variant="outline"
                  className="w-full border border-destructive/60 text-destructive hover:bg-destructive/10 sm:w-auto"
                  onClick={() => setDiscardOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Descartar
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-background/80 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                {record.fecha_mensaje ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fecha mensaje
                    </p>
                    <p className="text-sm">
                      {new Date(record.fecha_mensaje).toLocaleDateString("es-AR")}{" "}
                      {new Date(record.fecha_mensaje).toLocaleTimeString("es-AR")}
                    </p>
                  </div>
                ) : null}
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Referencia
                </p>
                <p className="text-base font-medium">{referenciaTexto}</p>
              </div>
              <div className="w-full lg:w-56">
                <div className="rounded-xl border border-border/30 bg-background text-xs text-muted-foreground text-left shadow-sm space-y-2">
                  <div className="px-3 pt-2">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                        Oportunidad
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-8 w-8 border border-border/40 bg-white/90 text-foreground hover:bg-muted/30"
                        disabled={hasOportunidad}
                      >
                        {hasOportunidad ? (
                          <span
                            className={cn(
                              "inline-flex min-h-[1.2rem] min-w-[3.5rem] items-center justify-center rounded-full px-2 text-[8px] font-semibold uppercase leading-none text-white shadow-sm",
                              estadoBadgeClass,
                            )}
                          >
                            {estadoBadgeText}
                          </span>
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {hasOportunidad ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">{oportunidadTexto}</p>
                        <p className="text-[9px] font-medium text-muted-foreground">{estadoBadgeText}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No se registró una oportunidad vinculada.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border/30 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <p className="text-xl font-semibold leading-snug text-slate-800">{record.asunto || "Sin asunto"}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mensaje
              </p>
              <div className="ml-auto flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full border-border/60 bg-background/80 sm:w-auto"
                  onClick={() => setReplyDialogOpen(true)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Responder
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border/40 bg-background/95 p-5 text-base leading-7 text-foreground shadow-inner min-h-[180px] max-h-[320px] overflow-y-auto">
              {record.contenido || "Sin contenido disponible."}
            </div>
          </div>
          <div className="flex justify-end border-t border-border/30 pt-4">
            <Button
              variant="ghost"
              className="min-w-32 border border-transparent bg-background/70 text-muted-foreground hover:bg-background"
              onClick={() => redirect("list", "crm/mensajes")}
            >
              Cancelar
            </Button>
          </div>
        </Card>
        <Card className="flex w-full flex-col gap-4 rounded-[28px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-6 shadow-xl lg:basis-[36%] lg:self-stretch">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Acciones pendientes
            </p>
            <h3 className="text-xl font-semibold text-foreground">Actividades</h3>
          </div>
          <div className="flex-1">
            <ActividadesPanel
              mensajeId={record.id}
              oportunidadId={record.oportunidad_id ?? undefined}
              contactoId={record.contacto_id ?? undefined}
              contactoNombre={record.contacto?.nombre_completo ?? undefined}
              asuntoMensaje={record.asunto ?? undefined}
              onActividadCreated={() => {
                refresh();
                setActividadesReload((prev) => prev + 1);
              }}
              reloadKey={actividadesReload}
            />
          </div>
        </Card>
      </div>
      <Dialog open={replyDialogOpen} onOpenChange={(open) => setReplyDialogOpen(open)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Responder mensaje</DialogTitle>
            <DialogDescription>
              Redacta la respuesta para este contacto manteniendo el contexto visible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre del Contacto {!record.contacto_id && <span className="text-red-500">*</span>}
              </p>
              <Input
                value={contactoNombre}
                onChange={(event) => setContactoNombre(event.target.value)}
                placeholder={record.contacto_id ? record.contacto?.nombre_completo || "Contacto registrado" : "Ingresa el nombre del contacto"}
                disabled={!!record.contacto_id}
                required={!record.contacto_id}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asunto
              </p>
              <Input
                value={replySubject}
                onChange={(event) => setReplySubject(event.target.value)}
                placeholder="Ingresa el asunto de la respuesta"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Respuesta
              </p>
              <Textarea
                rows={12}
                className="min-h-[260px]"
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder="Escribe tu respuesta..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplyDialogOpen(false)} disabled={replyLoading}>
              Cancelar
            </Button>
            <Button onClick={handleReplySubmit} disabled={replyLoading}>
              {replyLoading ? "Guardando..." : "Guardar respuesta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="bg-white" overlayClassName="bg-transparent backdrop-blur-none">
          <DialogHeader>
            <DialogTitle>Descartar mensaje</DialogTitle>
            <DialogDescription>
              Esta accion marcara el mensaje como descartado. Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button 
              variant="ghost" 
              onClick={() => {
                if (cameFromAction) {
                  redirect("list", "crm/mensajes");
                } else {
                  setDiscardOpen(false);
                }
              }} 
              disabled={discardLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleDescartar} disabled={discardLoading}>
              {discardLoading ? "Descartando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};


