"use client";

import { useState } from "react";
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
import { MessageCircle, CalendarPlus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const CRMMensajeShow = () => (
  <Show>
    <CRMMensajeMinimalView />
  </Show>
);

const CRMMensajeMinimalView = () => {
  const record = useRecordContext<CRMMensaje>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardLoading, setDiscardLoading] = useState(false);

  if (!record) return null;

  const contactoLabel =
    record.contacto?.nombre_completo ??
    (record.contacto_id ? `Contacto #${record.contacto_id}` : "Sin contacto");
  const oportunidadLabel = record.oportunidad?.id
    ? `#${record.oportunidad.id}`
    : record.oportunidad_id
    ? `#${record.oportunidad_id}`
    : "Sin oportunidad";
  const propiedadLabel = record.oportunidad?.nombre ?? "Sin propiedad";

  const handleResponder = async () => {
    if (!replyText.trim()) {
      notify("Completa la respuesta antes de enviar.", { type: "warning" });
      return;
    }
    setReplyLoading(true);
    try {
      await dataProvider.create("crm/mensajes", {
        data: {
          tipo: "salida",
          canal: record.canal,
          contacto_id: record.contacto_id,
          contacto_referencia: record.contacto_referencia,
          oportunidad_id: record.oportunidad_id,
          asunto: record.asunto ? `Re: ${record.asunto}` : "Respuesta CRM",
          estado: "pendiente_envio",
          contenido: replyText,
          fecha_mensaje: new Date().toISOString(),
          responsable_id: record.responsable_id,
        },
      });
      if (record.estado === "nuevo") {
        await dataProvider.update("crm/mensajes", {
          id: record.id,
          data: { ...record, estado: "recibido" },
          previousData: record,
        });
      }
      notify("Respuesta enviada", { type: "success" });
      setReplyOpen(false);
      setReplyText("");
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar la respuesta", { type: "warning" });
    } finally {
      setReplyLoading(false);
    }
  };

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

  return (
    <Card className="mr-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Referencia
            </p>
            <p className="text-base font-medium">
              {record.contacto_referencia || record.origen_externo_id || "Sin referencia"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
            </p>
            <p className="text-lg font-semibold">{record.asunto || "Sin asunto"}</p>
          </div>
        </div>
        <div className="w-full space-y-3 text-right lg:w-72">
          {record.fecha_mensaje ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {new Date(record.fecha_mensaje).toLocaleDateString("es-AR")}{" "}
              {new Date(record.fecha_mensaje).toLocaleTimeString("es-AR")}
            </div>
          ) : null}
          <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-semibold text-foreground">Contacto:</span> {contactoLabel}
            </p>
            <p>
              {oportunidadLabel} - {propiedadLabel}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mensaje
        </p>
        <div className="rounded-xl border bg-muted/30 p-4 text-base leading-7 text-foreground min-h-[280px]">
          {record.contenido || "Sin contenido disponible."}
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => redirect("list", "crm/mensajes")}>
          Cancelar
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={() => {
            setReplyText("");
            setReplyOpen(true);
          }}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Responder
        </Button>
        <Button variant="secondary" className="flex-1 sm:flex-none">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Agendar
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none text-destructive border-destructive/40 hover:bg-destructive/10"
          onClick={() => setDiscardOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Descartar
        </Button>
      </div>

      <Dialog open={replyOpen} onOpenChange={(open) => !replyLoading && setReplyOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder mensaje</DialogTitle>
            <DialogDescription>
              La respuesta se enviara como mensaje de salida a{" "}
              {record.contacto_referencia || "la referencia actual"}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={6}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Escribi tu respuesta..."
          />
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setReplyOpen(false)} disabled={replyLoading}>
              Cancelar
            </Button>
            <Button onClick={handleResponder} disabled={replyLoading}>
              {replyLoading ? "Enviando..." : "Confirmar envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={(open) => !discardLoading && setDiscardOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar mensaje</DialogTitle>
            <DialogDescription>
              Esta accion marcara el mensaje como descartado. Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDiscardOpen(false)} disabled={discardLoading}>
              Cancelar
            </Button>
            <Button onClick={handleDescartar} disabled={discardLoading}>
              {discardLoading ? "Descartando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
