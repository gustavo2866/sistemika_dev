"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNotify, useRefresh, useGetIdentity, useGetList } from "ra-core";
import { cn } from "@/lib/utils";
import { Mail, Phone, CheckCircle2, Clock, NotebookPen, MessageCircle, Calendar, CalendarPlus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Actividad } from "./model";

const ACTIVIDADES_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EVENT_TYPE_CHOICES = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunón" },
  { value: "visita", label: "Visita" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "otro", label: "Otro" },
];
const DEFAULT_EVENT_STATE = "1-pendiente";

type ScheduleFormState = {
  datetime: string;
  titulo: string;
  descripcion: string;
  tipoEvento: string;
  asignadoId: string;
};

type ResponsableRecord = {
  id: number;
  nombre?: string;
  nombre_completo?: string;
  full_name?: string;
  email?: string;
};

const getCurrentDateTimeForInput = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const createDefaultScheduleForm = (asignadoId = ""): ScheduleFormState => ({
  datetime: getCurrentDateTimeForInput(),
  titulo: "",
  descripcion: "",
  tipoEvento: EVENT_TYPE_CHOICES[0].value,
  asignadoId,
});

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
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => createDefaultScheduleForm());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [readOnlyPanel, setReadOnlyPanel] = useState<"schedule" | "reply" | null>(null);
  const scheduleDraftRef = useRef<ScheduleFormState>(createDefaultScheduleForm());
  const replyDraftRef = useRef({ subject: "", content: "", contactoNombre: "" });
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  
  // Estado para Responder
  const [respuestaSubject, setRespuestaSubject] = useState("");
  const [respuestaContent, setRespuestaContent] = useState("");
  const [respuestaLoading, setRespuestaLoading] = useState(false);
  const [contactoNombre, setContactoNombre] = useState("");
  
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  const { data: responsablesData } = useGetList<ResponsableRecord>("users", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "nombre", order: "ASC" },
  });

  const ensureReplySubject = (subject?: string | null) => {
    if (!subject) return "RE:";
    const trimmed = subject.trim();
    return trimmed.toUpperCase().startsWith("RE:") ? trimmed : `RE: ${trimmed}`;
  };

  useEffect(() => {
    setRespuestaSubject(ensureReplySubject(asuntoMensaje));
    setContactoNombre(contactoNombreProp || "");
  }, [asuntoMensaje, contactoNombreProp]);

  useEffect(() => {
    if (readOnlyPanel === "schedule") return;
    scheduleDraftRef.current = scheduleForm;
  }, [scheduleForm, readOnlyPanel]);

  useEffect(() => {
    if (readOnlyPanel === "reply") return;
    replyDraftRef.current = {
      subject: respuestaSubject,
      content: respuestaContent,
      contactoNombre,
    };
  }, [respuestaSubject, respuestaContent, contactoNombre, readOnlyPanel]);

  useEffect(() => {
    if (identity?.id) {
      setScheduleForm((prev) => (prev.asignadoId ? prev : { ...prev, asignadoId: String(identity.id) }));
    }
  }, [identity?.id]);

  const responsableOptions = useMemo(() => {
    const base = (responsablesData ?? []).map((user) => ({
      value: String(user.id),
      label: user.nombre_completo || user.full_name || user.nombre || user.email || `Usuario #${user.id}`,
    }));
    if (identity?.id) {
      const idValue = String(identity.id);
      const hasIdentity = base.some((option) => option.value === idValue);
      if (!hasIdentity) {
        const label = identity.fullName || identity.name || identity.email || `Usuario #${identity.id}`;
        base.unshift({ value: idValue, label });
      }
    }
    return base;
  }, [responsablesData, identity]);

  const mensajeIdValue = normalizeIdValue(mensajeId);
  const oportunidadIdValue = normalizeIdValue(oportunidadId);
  const contactoIdValue = normalizeIdValue(contactoId);

  const hasContextIds =
    mensajeIdValue !== undefined ||
    oportunidadIdValue !== undefined ||
    contactoIdValue !== undefined;
  const puedeForzarAcciones = Boolean(forceShowActions && oportunidadIdValue !== undefined);

  const isScheduleReadOnly = readOnlyPanel === "schedule";
  const isReplyReadOnly = readOnlyPanel === "reply";

  const exitReadOnlyModes = () => {
    if (readOnlyPanel === "schedule") {
      setScheduleForm(scheduleDraftRef.current);
    }
    if (readOnlyPanel === "reply") {
      setRespuestaSubject(replyDraftRef.current.subject);
      setRespuestaContent(replyDraftRef.current.content);
      setContactoNombre(replyDraftRef.current.contactoNombre);
    }
    setReadOnlyPanel(null);
  };

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
        setError("GuardÃÆÃâÃâÃÂ¡ el mensaje u oportunidad para ver actividades relacionadas.");
        setLoading(false);
        return;
      }
      const endpoint = query
        ? `${ACTIVIDADES_API_BASE}/crm/mensajes/acciones/buscar-actividades?${query}`
        : `${ACTIVIDADES_API_BASE}/crm/mensajes/${mensajeIdValue}/actividades`;
      console.info("ActividadesPanel ÃÆÃÂ¢ÃÂ¢Ã¢âÂ¬ÃÂ ÃÂ¢Ã¢âÂ¬Ã¢âÂ¢ fetch", {
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
          (Array.isArray(data) && data.length ? data.map((item: any) => normalizeError(item)).join(" ÃÆÃ¢â¬Å¡ÃâÃÂ· ") : null) ??
          `No se pudieron cargar las actividades (HTTP ${response.status}).`;
        setActividades([]);
        setError(mensajeError);
        return;
      }
      setActividades(data.actividades ?? []);
    } catch (err: any) {
      console.error("ActividadesPanel ÃÆÃÂ¢ÃÂ¢Ã¢âÂ¬ÃÂ ÃÂ¢Ã¢âÂ¬Ã¢âÂ¢ error", err);
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

  const handleActividadClick = (actividad: Actividad) => {
    if (actividad.tipo === "mensaje") {
      replyDraftRef.current = {
        subject: respuestaSubject,
        content: respuestaContent,
        contactoNombre,
      };
      const subjectFromTipo =
        actividad.tipo_mensaje?.toLowerCase() === "entrada" ? "Mensaje recibido" : "Mensaje enviado";
      setRespuestaSubject(subjectFromTipo);
      setRespuestaContent(actividad.descripcion || "");
      setPanelMode("reply");
      setReadOnlyPanel("reply");
      return;
    }
    scheduleDraftRef.current = scheduleForm;
    setScheduleForm({
      datetime: formatInputDateTime(actividad.fecha),
      titulo: actividad.titulo || actividad.descripcion || "",
      descripcion: actividad.descripcion || "",
      tipoEvento:
        actividad.tipo_evento && EVENT_TYPE_CHOICES.some((choice) => choice.value === actividad.tipo_evento)
          ? actividad.tipo_evento
          : EVENT_TYPE_CHOICES[0].value,
      asignadoId: scheduleForm.asignadoId,
    });
    setPanelMode("schedule");
    setReadOnlyPanel("schedule");
  };

  const handleScheduleSubmit = async () => {
    if (isScheduleReadOnly) {
      return;
    }
    const oportunidadContextId = oportunidadIdValue;
    const { datetime, titulo, descripcion, tipoEvento, asignadoId } = scheduleForm;

    if (!oportunidadContextId) {
      notify("Necesitás guardar la oportunidad antes de agendar un evento.", { type: "warning" });
      return;
    }
    if (!datetime) {
      notify("Seleccioná fecha y hora para la actividad.", { type: "warning" });
      return;
    }
    if (!titulo.trim()) {
      notify("Ingresá un t?tulo para la actividad.", { type: "warning" });
      return;
    }
    if (!tipoEvento) {
      notify("Elegí un tipo de evento.", { type: "warning" });
      return;
    }
    if (!asignadoId) {
      notify("Seleccioná a quién se asigna el evento.", { type: "warning" });
      return;
    }

    const fechaISO = new Date(datetime).toISOString();
    const payload: Record<string, unknown> = {
      oportunidad_id: oportunidadContextId,
      fecha_evento: fechaISO,
      titulo: titulo.trim(),
      tipo_evento: tipoEvento,
      estado_evento: DEFAULT_EVENT_STATE,
      asignado_a_id: Number(asignadoId),
    };
    if (descripcion.trim()) {
      payload.descripcion = descripcion.trim();
    }

    setScheduleLoading(true);
    try {
      const response = await fetch(`${ACTIVIDADES_API_BASE}/crm/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error al agendar evento (HTTP ${response.status})`;
        try {
          const errorBody = await response.json();
          errorMessage = normalizeError(errorBody) ?? errorMessage;
        } catch {
          // Ignorar parsing
        }
        throw new Error(errorMessage);
      }

      notify("Evento agendado", { type: "success" });
      setScheduleForm((prev) =>
        createDefaultScheduleForm(prev.asignadoId || (identity?.id ? String(identity.id) : ""))
      );
      setPanelMode("list");
      refresh();
      loadActividades();
      onActividadCreated?.();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo agendar el evento", { type: "warning" });
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleRespuestaSubmit = async () => {
    if (isReplyReadOnly) {
      return;
    }
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
      texto: trimmedContent,
    };

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
          onClick={() => {
            if (!canReply) return;
            exitReadOnlyModes();
            setPanelMode("reply");
          }}
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
          onClick={() => {
            exitReadOnlyModes();
            setPanelMode("schedule");
          }}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          Agendar
        </Button>
      </div>
    );
  };

  const renderSchedulePanel = () => (
    <div className="space-y-4">
      {isScheduleReadOnly && (
        <p className="text-xs italic text-muted-foreground">
          Modo solo lectura. Usa "Agendar" para crear o editar actividades.
        </p>
      )}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Título del evento *
        </p>
        <Input
          value={scheduleForm.titulo}
          onChange={(event) =>
            setScheduleForm((state) => ({ ...state, titulo: event.target.value }))
          }
          placeholder="Ej: Coordinar visita inicial"
          disabled={isScheduleReadOnly}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fecha y hora *
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                if (isScheduleReadOnly) return;
                if (dateInputRef.current?.showPicker) {
                  dateInputRef.current.showPicker();
                  return;
                }
                dateInputRef.current?.focus();
              }}
              disabled={isScheduleReadOnly}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
          <Input
            ref={dateInputRef}
            type="datetime-local"
            value={scheduleForm.datetime}
            onChange={(event) =>
              setScheduleForm((state) => ({ ...state, datetime: event.target.value }))
            }
            disabled={isScheduleReadOnly}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de evento *
          </p>
          <Select
            value={scheduleForm.tipoEvento}
            onValueChange={(value) =>
              setScheduleForm((state) => ({ ...state, tipoEvento: value }))
            }
            disabled={isScheduleReadOnly}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_CHOICES.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Descripción / notas
        </p>
        <Textarea
          rows={6}
          value={scheduleForm.descripcion}
          onChange={(event) =>
            setScheduleForm((state) => ({ ...state, descripcion: event.target.value }))
          }
          placeholder="Detalla el objetivo, lugar o contexto de la actividad."
          disabled={isScheduleReadOnly}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Asignado a *
        </p>
        {responsableOptions.length > 0 ? (
          <Select
            value={scheduleForm.asignadoId}
            onValueChange={(value) =>
              setScheduleForm((state) => ({ ...state, asignadoId: value }))
            }
            disabled={isScheduleReadOnly}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Seleccionar usuario" />
            </SelectTrigger>
            <SelectContent>
              {responsableOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            type="number"
            placeholder="ID del usuario responsable"
            value={scheduleForm.asignadoId}
            onChange={(event) =>
              setScheduleForm((state) => ({ ...state, asignadoId: event.target.value }))
            }
            disabled={isScheduleReadOnly}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="flex-1 min-w-36 bg-black text-white hover:bg-black/90"
          variant="secondary"
          onClick={handleScheduleSubmit}
          disabled={scheduleLoading || isScheduleReadOnly}
        >
          {scheduleLoading ? "Guardando..." : "Guardar agenda"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="flex-1 min-w-24"
          onClick={() => {
            exitReadOnlyModes();
            setPanelMode("list");
          }}
          disabled={scheduleLoading}
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
            if (isReplyReadOnly) {
              exitReadOnlyModes();
            } else {
              setRespuestaContent("");
            }
            setPanelMode("list");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isReplyReadOnly && (
        <p className="text-xs italic text-muted-foreground">
          Modo solo lectura. Usa "Responder" para redactar una respuesta.
        </p>
      )}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nombre del Contacto {!contactoId && <span className="text-red-500">*</span>}
          </p>
          <Input
            value={contactoNombre}
            onChange={(event) => setContactoNombre(event.target.value)}
            placeholder={contactoId ? contactoNombreProp || "Contacto registrado" : "Ingresa el nombre del contacto"}
            disabled={!!contactoId || isReplyReadOnly}
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
            disabled={isReplyReadOnly}
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
            disabled={isReplyReadOnly}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={handleRespuestaSubmit}
          disabled={respuestaLoading || isReplyReadOnly}
        >
          <Send className="mr-2 h-4 w-4" />
          {respuestaLoading ? "Enviando..." : "Enviar Respuesta"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isReplyReadOnly) {
              exitReadOnlyModes();
              setPanelMode("list");
              return;
            }
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
        "AÃÆÃâÃâÃÂºn no hay contexto para mostrar actividades.",
        "Guarda la oportunidad o vincÃÆÃâÃâÃÂºlala a un mensaje/contacto para ver el historial."
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
      <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {actividades.map((actividad) => (
          <li
            key={`${actividad.tipo}-${actividad.id}`}
            className="flex gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 p-2.5 shadow-sm cursor-pointer transition hover:border-primary/40"
            onClick={() => handleActividadClick(actividad)}
            role="button"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                actividad.tipo === "mensaje" ? "bg-sky-100 text-sky-600" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {getActividadIcon(actividad)}
            </span>
            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <span className="text-xs text-foreground truncate">
                  {actividad.tipo === "mensaje" ? actividad.tipo_mensaje || "Mensaje" : "Evento"}
                </span>
                <span className="shrink-0">{formatActividadDate(actividad.fecha)}</span>
              </div>
              <p className="text-sm text-foreground line-clamp-2 leading-tight">
                {actividad.descripcion || actividad.titulo || "Sin descripcion disponible."}
              </p>
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
    return value.map((item) => normalizeError(item) ?? JSON.stringify(item)).join(" ÃÆÃ¢â¬Å¡ÃâÃÂ· ");
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

const formatInputDateTime = (value: string) => {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return "";
  }
  const offsetMinutes = fecha.getTimezoneOffset();
  const local = new Date(fecha.getTime() - offsetMinutes * 60000);
  return local.toISOString().slice(0, 16);
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
    const canal = actividad.canal?.toLowerCase();
    const isWhatsapp = canal === "whatsapp";
    const isEntrada = actividad.tipo_mensaje?.toLowerCase() === "entrada";
    if (isWhatsapp) {
      return isEntrada ? <MessageCircle className="h-5 w-5" /> : <Send className="h-5 w-5" />;
    }
    return isEntrada ? <Mail className="h-5 w-5" /> : <Send className="h-5 w-5" />;
  }
  const estado = actividad.estado?.toLowerCase();
  if (estado === "pendiente") {
    return <Clock className="h-5 w-5" />;
  }
  if (estado === "hecho" || estado === "completado") {
    return <CheckCircle2 className="h-5 w-5" />;
  }
  return <NotebookPen className="h-5 w-5" />;
};
