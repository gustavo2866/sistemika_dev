"use client";

import { useCallback, useMemo, useState } from "react";
import { Show } from "@/components/show";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import type { CRMMensaje } from "./model";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const CRMMensajeReply = () => (
  <Show resource="crm/mensajes">
    <CRMMensajeReplyForm />
  </Show>
);

const ensureReplySubject = (subject?: string | null) => {
  if (!subject) return "RE:";
  const trimmed = subject.trim();
  return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
};

const CRMMensajeReplyForm = () => {
  const record = useRecordContext<CRMMensaje>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState(() => ensureReplySubject(record?.asunto));
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactoLabel = useMemo(() => {
    if (!record) return "Sin contacto";
    return (
      record.contacto?.nombre_completo ??
      record.contacto?.nombre ??
      (record.contacto_id ? `Contacto #${record.contacto_id}` : "Sin contacto")
    );
  }, [record]);

  const oportunidadLabel = record?.oportunidad?.id
    ? `#${record.oportunidad.id}`
    : record?.oportunidad_id
    ? `#${record.oportunidad_id}`
    : "Sin oportunidad";
  const propiedadLabel = record?.oportunidad?.descripcion_estado ?? "Sin oportunidad";

  const handleCancel = () => {
    if (!record) {
      redirect("list", "crm/mensajes");
    } else {
      redirect("show", "crm/mensajes", record.id);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!record) return;
    if (!reply.trim()) {
      notify("Completa la respuesta antes de enviar.", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await dataProvider.create("crm/mensajes", {
        data: {
          tipo: "salida",
          canal: record.canal,
          contacto_id: record.contacto_id,
          contacto_referencia: record.contacto_referencia,
          oportunidad_id: record.oportunidad_id,
          asunto: subject || ensureReplySubject(record.asunto),
          estado: "pendiente_envio",
          contenido: reply,
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
      redirect("show", "crm/mensajes", record.id);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar la respuesta", { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [dataProvider, notify, record, reply, subject, redirect]);

  if (!record) return null;

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
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mensaje original
                </p>
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
                {record.contenido || "Sin contenido disponible."}
              </div>
            </div>
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
          Respuesta
        </p>
        <Textarea
          rows={8}
          placeholder="Escribí tu respuesta..."
          value={reply}
          onChange={(event) => setReply(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="flex-1 sm:flex-none" onClick={handleCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={handleSubmit}
          disabled={loading}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {loading ? "Enviando..." : "Enviar respuesta"}
        </Button>
      </div>
    </Card>
  );
};
