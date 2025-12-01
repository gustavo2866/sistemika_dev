"use client";

import { useCallback, useEffect, useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { cn } from "@/lib/utils";
import { Mail, Phone, CheckCircle2, Clock, NotebookPen, MessageCircle, CalendarPlus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Actividad } from "./model";

const ACTIVIDADES_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ActividadesPanelProps = {
  mensajeId?: number;
  oportunidadId?: number;
  contactoId?: number;
  contactoNombre?: string;
  asuntoMensaje?: string;
  onActividadCreated?: () => void;
  reloadKey?: unknown;
  className?: string;
  forceShowActions?: boolean;
};

export const ActividadesPanel = ({
  mensajeId,
  oportunidadId,
  contactoId,
  contactoNombre: contactoNombreProp,
  asuntoMensaje,
  onActividadCreated,
  reloadKey,
  className,
  forceShowActions = false,
}: ActividadesPanelProps) => {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"list" | "schedule" | "reply">("list");
  
  // Estado para Agendar
  const [scheduleForm, setScheduleForm] = useState({ datetime: "", notes: "" });
  
  // Estado para Responder
  const [respuestaSubject, setRespuestaSubject] = useState("");
  const [respuestaContent, setRespuestaContent] = useState("");
  const [respuestaLoading, setRespuestaLoading] = useState(false);
  const [contactoNombre, setContactoNombre] = useState("");
  
  const notify = useNotify();
  const refresh = useRefresh();

  const ensureReplySubject = (subject?: string | null) => {
    if (!subject) return "RE:";
    const trimmed = subject.trim();
    return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
  };

  useEffect(() => {
    setRespuestaSubject(ensureReplySubject(asuntoMensaje));
    setContactoNombre(contactoNombreProp || "");
  }, [asuntoMensaje, contactoNombreProp]);

  const mensajeIdValue = normalizeIdValue(mensajeId);
  const oportunidadIdValue = normalizeIdValue(oportunidadId);
  const contactoIdValue = normalizeIdValue(contactoId);

  const hasContextIds =
    mensajeIdValue !== undefined ||
    oportunidadIdValue !== undefined ||
    contactoIdValue !== undefined;
  const puedeForzarAcciones = Boolean(forceShowActions && oportunidadIdValue !== undefined);

  const loadActividades = useCallback(async () => {
    if (!hasContextIds) {
      setActividades([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      appendNumericParam(params, "mensaje_id", mensajeIdValue);
      appendNumericParam(params, "oportunidad_id", oportunidadIdValue);
      appendNumericParam(params, "contacto_id", contactoIdValue);
      const query = params.toString();
      if (!mensajeIdValue && !query) {
        setActividades([]);
        setError("GuardÃƒÆ’Ã‚Â¡ el mensaje u oportunidad para ver actividades relacionadas.");
        setLoading(false);
        return;
      }
      const endpoint = query
        ? `${ACTIVIDADES_API_BASE}/crm/mensajes/acciones/buscar-actividades?${query}`
        : `${ACTIVIDADES_API_BASE}/crm/mensajes/${mensajeIdValue}/actividades`;
      console.info("ActividadesPanel ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ fetch", {
        mensajeIdValue,
        oportunidadIdValue,
        contactoIdValue,
        endpoint,
      });
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) {
        const mensajeError =
          normalizeError(data?.detail) ??
          (Array.isArray(data) && data.length ? data.map((item: any) => normalizeError(item)).join(" Ãƒâ€šÃ‚Â· ") : null) ??
          `No se pudieron cargar las actividades (HTTP ${response.status}).`;
        setActividades([]);
        setError(mensajeError);
        return;
      }
      setActividades(data.actividades ?? []);
    } catch (err: any) {
      console.error("ActividadesPanel ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ error", err);
      console.error("Error al cargar actividades:", err);
      setActividades([]);
      setError(err?.message ?? "No se pudieron cargar las actividades");
    } finally {
      setLoading(false);
    }
  }, [mensajeIdValue, oportunidadIdValue, contactoIdValue, hasContextIds]);

  useEffect(() => {
    if (!hasContextIds) {
      setActividades([]);
      return;
    }
    loadActividades();
  }, [hasContextIds, loadActividades, reloadKey]);

  const handleRespuestaSubmit = async () => {
    const mensajeContextId = mensajeIdValue;
    const oportunidadContextId = oportunidadIdValue;
    const contactoContextId = contactoIdValue;
    const trimmedContent = respuestaContent.trim();
    const trimmedNombre = contactoNombre.trim();
    const subjectValue = respuestaSubject?.trim()
      ? respuestaSubject.trim()
      : ensureReplySubject(asuntoMensaje);

    if (!mensajeContextId && !oportunidadContextId) {
      notify("Guarda el mensaje u oportunidad para responder desde este panel.", { type: "warning" });
      return;
    }
    if (!trimmedContent) {
      notify("Completa la respuesta antes de enviar.", { type: "warning" });
      return;
    }
    if (!contactoContextId && !trimmedNombre) {
      notify("El nombre del contacto es obligatorio.", { type: "warning" });
      return;
    }

    const endpoint = mensajeContextId
      ? `${ACTIVIDADES_API_BASE}/crm/mensajes/${mensajeContextId}/responder`
      : `${ACTIVIDADES_API_BASE}/crm/mensajes/acciones/enviar`;

    const payload: Record<string, unknown> = {
      asunto: subjectValue,
      contenido: trimmedContent,
    };

    if (mensajeContextId) {
      payload.contacto_nombre = trimmedNombre;
    } else if (oportunidadContextId) {
      payload.oportunidad_id = oportunidadContextId;
      payload.contacto_id = contactoContextId;
      if (!contactoContextId) {
        payload.contacto_nombre = trimmedNombre;
      }
    }

    setRespuestaLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error al enviar la respuesta (HTTP ${response.status})`;
        try {
          const errorBody = await response.json();
          errorMessage = normalizeError(errorBody) ?? errorMessage;
        } catch {
          // Ignorar errores al parsear el cuerpo
        }
        throw new Error(errorMessage);
      }

      const resultado = await response.json();
      notify("Mensaje guardado para enviar", { type: "success" });

      if (resultado.contacto_creado) {
        notify("Contacto creado automaticamente", { type: "info" });
      }
      if (resultado.oportunidad_creada) {
        notify("Oportunidad creada automaticamente", { type: "info" });
      }

      setRespuestaLoading(false);
      setPanelMode("list");
      setRespuestaContent("");
      setContactoNombre("");
      refresh();
      loadActividades();
      onActividadCreated?.();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo guardar la respuesta", { type: "warning" });
      setRespuestaLoading(false);
    }
  };
  const renderActionButtons = (canReply: boolean) => {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-muted/10 p-3 text-sm shadow-inner">
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-xl border border-transparent bg-gradient-to-r from-blue-600/90 to-blue-600/90 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => canReply && setPanelMode("reply")}
          disabled={!canReply}
          title={canReply ? undefined : "Disponible cuando el panel tiene un mensaje asociado"}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Responder
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-xl border border-transparent bg-gradient-to-r from-primary/90 to-primary/90 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
          onClick={() => setPanelMode("schedule")}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          Agendar
        </Button>
        <p className="text-xs leading-tight text-muted-foreground/90">
          Responde o programa actividades desde este panel sin perder el hilo del mensaje.
        </p>
      </div>
    );
  };

  const renderSchedulePanel = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fecha y hora
        </p>
        <Input
          type="datetime-local"
          value={scheduleForm.datetime}
          onChange={(event) =>
            setScheduleForm((state) => ({ ...state, datetime: event.target.value }))
          }
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notas de agenda
        </p>
        <Textarea
          rows={6}
          value={scheduleForm.notes}
          onChange={(event) =>
            setScheduleForm((state) => ({ ...state, notes: event.target.value }))
          }
          placeholder="Detalla el motivo, lugar o responsables de la actividad."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="flex-1 min-w-36" variant="secondary">
          Guardar agenda
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="flex-1 min-w-24"
          onClick={() => setPanelMode("list")}
        >
          Cerrar panel
        </Button>
      </div>
    </div>
  );

  const renderReplyPanel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Responder Mensaje
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            setPanelMode("list");
            setRespuestaContent("");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nombre del Contacto {!contactoId && <span className="text-red-500">*</span>}
          </p>
          <Input
            value={contactoNombre}
            onChange={(event) => setContactoNombre(event.target.value)}
            placeholder={contactoId ? contactoNombreProp || "Contacto registrado" : "Ingresa el nombre del contacto"}
            disabled={!!contactoId}
            required={!contactoId}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Asunto
          </p>
          <Input
            value={respuestaSubject}
            onChange={(event) => setRespuestaSubject(event.target.value)}
            placeholder="Asunto de la respuesta"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensaje
          </p>
          <Textarea
            rows={10}
            value={respuestaContent}
            onChange={(event) => setRespuestaContent(event.target.value)}
            placeholder="Escribe tu respuesta..."
            className="text-sm min-h-[240px]"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={handleRespuestaSubmit}
          disabled={respuestaLoading}
        >
          <Send className="mr-2 h-4 w-4" />
          {respuestaLoading ? "Enviando..." : "Enviar Respuesta"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPanelMode("list");
            setRespuestaContent("");
          }}
          disabled={respuestaLoading}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );

  const renderActividadesList = () => {
    if (!hasContextIds) {
      return renderInformativeState(
        "AÃƒÆ’Ã‚Âºn no hay contexto para mostrar actividades.",
        "Guarda la oportunidad o vincÃƒÆ’Ã‚Âºlala a un mensaje/contacto para ver el historial."
      );
    }
    if (loading) {
      return <p className="text-sm text-muted-foreground">Cargando actividades...</p>;
    }
    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }
    if (!actividades.length) {
      return <p className="text-sm text-muted-foreground">No hay actividades registradas.</p>;
    }
    return (
      <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
        {actividades.map((actividad) => (
          <li
            key={`${actividad.tipo}-${actividad.id}`}
            className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                actividad.tipo === "mensaje" ? "bg-sky-100 text-sky-600" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {getActividadIcon(actividad)}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <span className="text-xs text-foreground">
                  {actividad.tipo === "mensaje" ? actividad.tipo_mensaje || "Mensaje" : "Evento"}
                </span>
                <span>{formatActividadDate(actividad.fecha)}</span>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {actividad.descripcion || "Sin descripcion disponible."}
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {actividad.estado ? (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-slate-600">
                    {actividad.estado}
                  </span>
                ) : null}
                {actividad.tipo === "mensaje" && actividad.canal ? (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-slate-600">
                    {actividad.canal}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderPanelContent = () => {
    if (panelMode === "schedule") {
      return renderSchedulePanel();
    }
    if (panelMode === "reply") {
      return renderReplyPanel();
    }
    return renderActividadesList();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {(forceShowActions || mensajeId) &&
        renderActionButtons(Boolean(mensajeIdValue || puedeForzarAcciones))}
      <div className={cn("flex-1 space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm", className)}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de Actividades
          </p>
          <span className="text-xs font-semibold text-muted-foreground">
            {actividades.length} actividades
          </span>
        </div>
        {renderPanelContent()}
      </div>
    </div>
  );
};

const renderInformativeState = (title: string, description: string) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
    <NotebookPen className="h-10 w-10 text-muted-foreground/70" />
    <p className="text-base font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground/80">{description}</p>
  </div>
);

const normalizeIdValue = (value?: number | string | null) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const appendNumericParam = (
  params: URLSearchParams,
  key: string,
  value?: number | string | null
) => {
  if (value == null) return;
  
  // Convert string to number if needed
  const numericValue = typeof value === "string" ? Number(value) : value;
  
  // Only append if it's a valid finite number
  if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
    params.set(key, String(numericValue));
  }
};

const normalizeError = (value: any): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeError(item) ?? JSON.stringify(item)).join(" Ãƒâ€šÃ‚Â· ");
  }
  if (typeof value === "object") {
    if (value.msg) return normalizeError(value.msg);
    if (value.detail) return normalizeError(value.detail);
    if (value.error) return normalizeError(value.error);
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return String(value);
};

const formatActividadDate = (value: string) => {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return "Fecha invalida";
  }
  const hoy = new Date();
  const mismaFecha =
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate();
  if (mismaFecha) {
    return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
};

const getActividadIcon = (actividad: Actividad) => {
  if (actividad.tipo === "mensaje") {
    return <Mail className="h-5 w-5" />;
  }
  const estado = actividad.estado?.toLowerCase();
  if (estado === "pendiente") {
    return <Clock className="h-5 w-5" />;
  }
  if (estado === "hecho" || estado === "completado") {
    return <CheckCircle2 className="h-5 w-5" />;
  }
  return <Phone className="h-5 w-5" />;
};
