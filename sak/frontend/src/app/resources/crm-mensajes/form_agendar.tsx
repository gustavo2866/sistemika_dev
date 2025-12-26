import { useState, useEffect, useCallback } from "react";
import { useNotify, useDataProvider, useRefresh, useGetIdentity } from "ra-core";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CRMMensaje } from "./model";
import { EVENT_TYPE_CHOICES, DEFAULT_EVENT_STATE, getDefaultDateTime } from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje: CRMMensaje | null;
  onSuccess?: () => void;
}

const FIELD_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const INPUT_BASE_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 bg-white/95 px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
const TEXTAREA_CLASS =
  "min-h-[90px] w-full rounded-xl border border-slate-200 bg-white/95 p-2.5 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 resize-none";
const SECTION_CARD_CLASS =
  "rounded-2xl border border-slate-200/60 bg-white/95 p-3 shadow-sm";

export const ScheduleDialog = ({ open, onOpenChange, mensaje, onSuccess }: ScheduleDialogProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    tipoEvento: EVENT_TYPE_CHOICES[0].value,
    datetime: getDefaultDateTime(),
    asignadoId: "",
    contactoNombre: "",
    tipoOperacionId: "",
  });
  const [responsables, setResponsables] = useState<Array<{ value: string; label: string }>>([]);
  const [responsablesLoading, setResponsablesLoading] = useState(false);
  const [tipoOperacionOptions, setTipoOperacionOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [tipoOperacionLoading, setTipoOperacionLoading] = useState(false);

  const notify = useNotify();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  const contactoNombrePrimario =
    mensaje?.contacto?.nombre_completo ??
    mensaje?.contacto?.nombre ??
    (mensaje?.contacto_id ? `Contacto #${mensaje.contacto_id}` : "No agendado");

  const contactoReferencia =
    mensaje?.contacto_referencia ??
    mensaje?.origen_externo_id ??
    mensaje?.contacto_alias ??
    "Sin referencia";

  const oportunidadLabel =
    mensaje?.oportunidad?.descripcion_estado ??
    (mensaje?.oportunidad_id ? "Oportunidad vinculada" : "Sin oportunidad asociada");
  const showContactField = Boolean(mensaje && !mensaje.contacto_id);
  const showTipoOperacionField = Boolean(mensaje && !mensaje.oportunidad_id);

  const loadResponsables = useCallback(async () => {
    setResponsablesLoading(true);
    try {
      const { data } = await dataProvider.getList("users", {
        pagination: { page: 1, perPage: 50 },
        sort: { field: "nombre", order: "ASC" },
      });
      const mapped =
        data?.map((user: any) => ({
          value: String(user.id),
          label: user.nombre_completo || user.full_name || user.nombre || user.email || `Usuario #${user.id}`,
        })) ?? [];
      setResponsables(mapped);
    } catch (error) {
      console.error("No se pudieron cargar los responsables", error);
      notify("No se pudieron cargar los responsables", { type: "warning" });
    } finally {
      setResponsablesLoading(false);
    }
  }, [dataProvider, notify]);

  useEffect(() => {
    if (open && !responsables.length && !responsablesLoading) {
      loadResponsables();
    }
  }, [open, responsables.length, responsablesLoading, loadResponsables]);

  useEffect(() => {
    if (!open || !mensaje || mensaje.oportunidad_id) return;
    let cancelled = false;
    const loadTipoOperaciones = async () => {
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
        const mapped =
          base
            ?.filter((item: any) => item?.id != null)
            .map((item: any) => ({
              value: String(item.id),
              label: item.nombre ?? item.codigo ?? `#${item.id}`,
            })) ?? [];
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
    loadTipoOperaciones();
    return () => {
      cancelled = true;
    };
  }, [open, mensaje, dataProvider]);

  useEffect(() => {
    if (mensaje) {
      setForm({
        titulo: "",
        descripcion: "",
        tipoEvento: EVENT_TYPE_CHOICES[0].value,
        datetime: getDefaultDateTime(),
        asignadoId:
          identity?.id != null ? String(identity.id) : mensaje.responsable_id ? String(mensaje.responsable_id) : "",
        contactoNombre: mensaje.contacto?.nombre_completo ?? mensaje.contacto?.nombre ?? "",
        tipoOperacionId: "",
      });
    }
  }, [mensaje, identity]);

  const handleDialogChange = (open: boolean) => {
    if (submitting) return;
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!mensaje) return;
    if (!form.titulo.trim()) {
      notify("Ingresa un titulo para la actividad.", { type: "warning" });
      return;
    }
    if (!form.datetime) {
      notify("Selecciona fecha y hora.", { type: "warning" });
      return;
    }
    if (!form.asignadoId) {
      notify("Selecciona la persona asignada.", { type: "warning" });
      return;
    }
    if (!mensaje.contacto_id && !form.contactoNombre.trim()) {
      notify("Ingresa el nombre del contacto.", { type: "warning" });
      return;
    }
    if (!mensaje.oportunidad_id && !form.tipoOperacionId) {
      notify("Selecciona el tipo de operacion.", { type: "warning" });
      return;
    }

    const fechaIso = new Date(form.datetime).toISOString();
    const asignadoIdNumber = Number(form.asignadoId);
    const payload: Record<string, unknown> = {
      fecha_evento: fechaIso,
      titulo: form.titulo.trim(),
      tipo_evento: form.tipoEvento,
      estado_evento: DEFAULT_EVENT_STATE,
      asignado_a_id: asignadoIdNumber,
      responsable_id: mensaje.responsable_id ?? asignadoIdNumber,
    };

    const descripcion = form.descripcion.trim();
    if (descripcion) {
      payload.descripcion = descripcion;
    }

    if (!mensaje.contacto_id) {
      payload.contacto_nombre = form.contactoNombre.trim();
    }

    if (!mensaje.oportunidad_id && form.tipoOperacionId) {
      payload.tipo_operacion_id = Number(form.tipoOperacionId);
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/crm/mensajes/${mensaje.id}/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error al agendar evento (HTTP ${response.status})`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody?.detail || errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      notify("Evento agendado correctamente", { type: "success" });

      if (result?.contacto_creado) {
        notify("Contacto creado automaticamente", { type: "info" });
      }
      if (result?.oportunidad_creada) {
        notify("Oportunidad creada automaticamente", { type: "info" });
      }

      onOpenChange(false);
      setForm({
        titulo: "",
        descripcion: "",
        tipoEvento: EVENT_TYPE_CHOICES[0].value,
        datetime: getDefaultDateTime(),
        asignadoId: identity?.id != null ? String(identity.id) : "",
        contactoNombre: "",
        tipoOperacionId: "",
      });
      refresh();
      onSuccess?.();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo agendar el evento", { type: "warning" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-xl overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/98 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <DialogHeader className="border-b border-slate-100 px-5 py-3.5">
          <DialogTitle className="text-xl font-semibold text-slate-900">Agendar actividad</DialogTitle>
        </DialogHeader>
        {mensaje ? (
          <div className="space-y-3 px-5 py-4">
            <section className={SECTION_CARD_CLASS}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Contacto</p>
                  <p className="text-sm font-semibold text-slate-900">{contactoNombrePrimario}</p>
                  <p className="text-xs text-slate-500">{contactoReferencia}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Oportunidad</p>
                  <p className="text-sm font-semibold text-slate-900">{oportunidadLabel}</p>
                </div>
              </div>
              {mensaje && (showContactField || showTipoOperacionField) ? (
                <div
                  className={`mt-3 grid gap-3 ${
                    showContactField && showTipoOperacionField ? "md:grid-cols-2" : "md:grid-cols-1"
                  }`}
                >
                  {showContactField && (
                    <div className="space-y-1">
                      <p className={FIELD_LABEL_CLASS}>Nombre del contacto *</p>
                      <Input
                        value={form.contactoNombre}
                        onChange={(event) =>
                          setForm((state) => ({ ...state, contactoNombre: event.target.value }))
                        }
                        placeholder="Nombre completo del contacto"
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                  )}
                  {showTipoOperacionField && (
                    <div className="space-y-1">
                      <p className={FIELD_LABEL_CLASS}>Tipo de operacion *</p>
                      <select
                        value={form.tipoOperacionId}
                        onChange={(event) =>
                          setForm((state) => ({ ...state, tipoOperacionId: event.target.value }))
                        }
                        className={INPUT_BASE_CLASS}
                      >
                        <option value="">Selecciona venta o alquiler</option>
                        {tipoOperacionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {tipoOperacionLoading ? (
                        <p className="text-xs text-muted-foreground">Cargando opciones...</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
            <section className={SECTION_CARD_CLASS}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className={FIELD_LABEL_CLASS}>Tipo de evento *</p>
                  <select
                    value={form.tipoEvento}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, tipoEvento: event.target.value }))
                    }
                    className={INPUT_BASE_CLASS}
                  >
                    {EVENT_TYPE_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className={FIELD_LABEL_CLASS}>Fecha y hora *</p>
                  <Input
                    type="datetime-local"
                    value={form.datetime}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, datetime: event.target.value }))
                    }
                    className={INPUT_BASE_CLASS}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className={FIELD_LABEL_CLASS}>Asignado a *</p>
                  {responsables.length ? (
                    <select
                      value={form.asignadoId}
                      onChange={(event) =>
                        setForm((state) => ({ ...state, asignadoId: event.target.value }))
                      }
                      className={INPUT_BASE_CLASS}
                    >
                      <option value="">Seleccionar responsable</option>
                      {responsables.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="ID del responsable"
                      value={form.asignadoId}
                      onChange={(event) =>
                        setForm((state) => ({ ...state, asignadoId: event.target.value }))
                      }
                      className={INPUT_BASE_CLASS}
                    />
                  )}
                  {responsablesLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando responsables...</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className={FIELD_LABEL_CLASS}>Titulo *</p>
                  <Input
                    value={form.titulo}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, titulo: event.target.value }))
                    }
                    placeholder="Ej: Coordinar visita"
                    className={INPUT_BASE_CLASS}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <p className={FIELD_LABEL_CLASS}>Descripcion</p>
                <Textarea
                  rows={4}
                  value={form.descripcion}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, descripcion: event.target.value }))
                  }
                  placeholder="Notas adicionales o contexto de la actividad."
                  className={TEXTAREA_CLASS}
                />
              </div>
            </section>
          </div>
        ) : null}
        <DialogFooter className="border-t border-slate-100 px-5 py-3">
          <Button variant="ghost" onClick={() => handleDialogChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
