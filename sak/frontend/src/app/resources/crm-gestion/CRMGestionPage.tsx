"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckSquare2,
  ListChecks,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Phone,
  Home,
  Plus,
  Search,
  User,
} from "lucide-react";
import {
  CreateBase,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useInput,
  useNotify,
  useRefresh,
} from "ra-core";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { ComboboxQuery, ResponsableSelector } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBucket, KanbanBucketBody, KanbanBucketEmpty } from "@/components/kanban";
import { useKanbanDragDrop } from "@/components/kanban/use-kanban-drag-drop";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { Input } from "@/components/ui/input";
import { CRM_OPORTUNIDAD_ESTADO_CHOICES } from "@/app/resources/crm-oportunidades/model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type GestionSummary = {
  kpis: {
    visitas_hoy: number;
    llamadas_pendientes: number;
    eventos_semana: number;
    tareas_completadas: number;
  };
  buckets: {
    overdue: number;
    today: number;
    tomorrow: number;
    week: number;
    next: number;
  };
};

type GestionItem = {
  id: number;
  titulo?: string | null;
  descripcion?: string | null;
  fecha_evento?: string | null;
  estado_evento?: string | null;
  tipo_evento?: string | null;
  bucket: string;
  is_completed: boolean;
  is_cancelled: boolean;
  oportunidad_estado?: string | null;
  oportunidad_titulo?: string | null;
  oportunidad?: {
    id: number;
    titulo?: string | null;
    estado?: string | null;
    contacto?: {
      nombre?: string | null;
      nombre_completo?: string | null;
    } | null;
  } | null;
  asignado_a?: {
    id: number;
    nombre?: string | null;
  } | null;
};

type ContactoActivoOption = {
  id: number;
  nombre_completo: string;
  oportunidad_id: number;
  oportunidad_titulo?: string | null;
};

const getAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDateTime = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const datePart = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const timePart = date
    .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(":", ";");
  return `${datePart} ${timePart}`;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const splitDateTime = (fecha?: string | null) => {
  if (!fecha) return { date: "", time: "" };
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return { date: formatDateInput(date), time: formatTimeInput(date) };
};

const DateTimeSplitInput = ({
  source,
  labelDate,
  labelTime,
  defaultValue,
}: {
  source: string;
  labelDate: string;
  labelTime: string;
  defaultValue?: string;
}) => {
  const { field } = useInput({ source, defaultValue });
  const initial = splitDateTime(field.value as string);
  const [dateValue, setDateValue] = useState(initial.date);
  const [timeValue, setTimeValue] = useState(initial.time);

  useEffect(() => {
    const next = splitDateTime(field.value as string);
    if (next.date !== dateValue) setDateValue(next.date);
    if (next.time !== timeValue) setTimeValue(next.time);
  }, [field.value, dateValue, timeValue]);

  const syncValue = (nextDate: string, nextTime: string) => {
    if (!nextDate || !nextTime) {
      field.onChange("");
      return;
    }
    field.onChange(`${nextDate}T${nextTime}`);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {labelDate}
        </Label>
        <Input
          type="date"
          value={dateValue}
          onChange={(event) => {
            const next = event.target.value;
            setDateValue(next);
            syncValue(next, timeValue);
          }}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {labelTime}
        </Label>
        <Input
          type="time"
          value={timeValue}
          onChange={(event) => {
            const next = event.target.value;
            setTimeValue(next);
            syncValue(dateValue, next);
          }}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
        />
      </div>
    </div>
  );
};

const formatDate = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

const getContactName = (item: GestionItem) => {
  const contacto = item.oportunidad?.contacto;
  return contacto?.nombre_completo || contacto?.nombre || "Sin contacto";
};

const getOpportunityIdLabel = (item: GestionItem) => {
  if (!item.oportunidad?.id) return "";
  return `(#${String(item.oportunidad.id).padStart(6, "0")})`;
};

const getDisplayTitle = (item: GestionItem) => {
  const title = item.titulo?.trim() ?? "";
  const tipo = item.tipo_evento ? item.tipo_evento.trim() : "";
  if (!tipo) return title || "Sin titulo";
  const normalized = tipo.toLowerCase();
  if (title.toLowerCase().startsWith(normalized)) return title;
  const capitalized = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  return title ? `${capitalized} - ${title}` : capitalized;
};

const getTipoLabel = (tipo?: string | null) => {
  const normalized = normalizeTipo(tipo);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeTipo = (tipo?: string | null) => {
  if (!tipo) return "";
  const value = tipo.trim().toLowerCase();
  if (value.startsWith("llamad")) return "llamada";
  if (value.startsWith("visita")) return "visita";
  if (value.startsWith("tarea")) return "tarea";
  if (value.startsWith("event")) return "evento";
  return value;
};

const truncateTitle = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const typeBadge = (tipo?: string | null) => {
  switch (normalizeTipo(tipo)) {
    case "llamada":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "visita":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "evento":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "tarea":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const getTypeIcon = (tipo?: string | null) => {
  switch (normalizeTipo(tipo)) {
    case "llamada":
      return Phone;
    case "visita":
      return Home;
    case "evento":
      return Calendar;
    case "tarea":
      return CheckSquare2;
    default:
      return CalendarCheck;
  }
};

const AgendaCard = ({
  item,
  compact,
  onAgendar,
  onQuickSchedule,
  onCompletar,
}: {
  item: GestionItem;
  compact?: boolean;
  onAgendar?: (item: GestionItem) => void;
  onQuickSchedule?: (item: GestionItem, bucket: string) => void;
  onCompletar?: (item: GestionItem) => void;
}) => {
  const isCompleted = item.is_completed;
  if (compact) {
    const summaryText = `${formatDateTime(item.fecha_evento)} ${truncateTitle(getDisplayTitle(item), 25)} ${getContactName(item)}`.trim();
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white px-3 py-2", isCompleted ? "opacity-70" : "")}>
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          {isCompleted ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : null}
          <span className={cn("truncate flex-1", isCompleted ? "opacity-80" : "")}>
            {summaryText}
          </span>
          {(() => {
            const Icon = getTypeIcon(item.tipo_evento);
            return <Icon className="h-3 w-3 text-slate-500" />;
          })()}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3",
        isCompleted ? "opacity-70" : "",
        compact ? "py-2" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-[9px] font-semibold text-slate-700 sm:text-xs">
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {formatDateTime(item.fecha_evento)}
            </span>
            <p className={cn("text-[11px] font-semibold text-slate-900 sm:text-sm", isCompleted ? "line-through" : "")}>
              <span className="sm:hidden">{truncateTitle(getDisplayTitle(item), 25)}</span>
              <span className="hidden sm:inline">{getDisplayTitle(item)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 sm:text-xs">
            <span className="flex items-center gap-2">
              <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {getContactName(item)} {getOpportunityIdLabel(item)}
            </span>
          </div>
            {!compact ? (
              <div className="mt-1 flex items-center gap-3 text-[9px] text-slate-500 sm:text-[10px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => event.stopPropagation()}
                      className="h-5 border-slate-200 px-1.5 text-[9px] sm:h-6 sm:text-[10px]"
                    >
                      <CalendarPlus className="h-3 w-3" />
                      Agendar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickSchedule?.(item, "today");
                      }}
                    >
                      Hoy
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickSchedule?.(item, "tomorrow");
                      }}
                    >
                      Mañana
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickSchedule?.(item, "week");
                      }}
                    >
                      Semana
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickSchedule?.(item, "next");
                      }}
                    >
                      Proximos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onAgendar?.(item);
                      }}
                    >
                      Editar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCompletar?.(item);
                  }}
                  className="h-5 border-slate-200 px-1.5 text-[9px] sm:h-6 sm:text-[10px]"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Completar
                </Button>
              </div>
            ) : null}
        </div>
        <span
          className={cn(
            "inline-flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase sm:text-[10px]",
            typeBadge(item.tipo_evento)
          )}
        >
          {(() => {
            const Icon = getTypeIcon(item.tipo_evento);
            return <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />;
          })()}
          {!isCompleted ? (
            <span className="text-[8px] font-medium uppercase text-slate-600 sm:text-[9px]">
              {getTipoLabel(item.tipo_evento)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
};

const CrearEventoFormContent = () => {
  const form = useFormContext();
  const { field: asignadoField } = useController({ name: "asignado_a_id" });
  const oportunidadId = useWatch({ control: form.control, name: "oportunidad_id" });
  const contactoId = useWatch({ control: form.control, name: "contacto_id" });
  const tipoId = useWatch({ control: form.control, name: "tipo_id" });
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: Number(oportunidadId) || 0 },
    { enabled: Boolean(oportunidadId) }
  );
  const { data: tiposEventoCatalogo = [] } = useGetList("crm/catalogos/tipos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: tipoEventoCatalogo } = useGetOne(
    "crm/catalogos/tipos-evento",
    { id: Number(tipoId) || 0 },
    { enabled: Boolean(tipoId) }
  );
  const { data: motivosEventoCatalogo = [] } = useGetList("crm/catalogos/motivos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: contactosActivos = [] } = useGetList<ContactoActivoOption>(
    "crm/gestion/contactos-activos",
    {
      pagination: { page: 1, perPage: 200 },
      filter: {},
      sort: { field: "nombre_completo", order: "ASC" },
    }
  );

  useEffect(() => {
    if (oportunidad?.contacto_id) {
      form.setValue("contacto_id", oportunidad.contacto_id, { shouldDirty: true });
    } else if (!oportunidadId) {
      form.setValue("contacto_id", null, { shouldDirty: true });
    }
  }, [oportunidad, oportunidadId, form]);

  useEffect(() => {
    if (!tipoId && tiposEventoCatalogo.length > 0) {
      const defaultTipo =
        tiposEventoCatalogo.find((tipo: any) => tipo.codigo === "llamada") ??
        tiposEventoCatalogo[0];
      if (defaultTipo) {
        form.setValue("tipo_id", defaultTipo.id, { shouldDirty: true });
      }
    }
  }, [tipoId, tiposEventoCatalogo, form]);

  useEffect(() => {
    if (tipoEventoCatalogo?.codigo) {
      form.setValue("tipo_evento", tipoEventoCatalogo.codigo, { shouldDirty: true });
    } else if (!tipoId) {
      form.setValue("tipo_evento", "", { shouldDirty: true });
    }
  }, [tipoEventoCatalogo, tipoId, form]);

  useEffect(() => {
    if (!form.getValues("motivo_id") && motivosEventoCatalogo.length > 0) {
      form.setValue("motivo_id", motivosEventoCatalogo[0].id, { shouldDirty: true });
    }
  }, [motivosEventoCatalogo, form]);

  const selectedContacto = useMemo(
    () =>
      contactosActivos.find(
        (contacto) => String(contacto.id) === String(contactoId ?? "")
      ),
    [contactosActivos, contactoId]
  );

  useEffect(() => {
    if (selectedContacto?.oportunidad_id) {
      form.setValue("oportunidad_id", selectedContacto.oportunidad_id, { shouldDirty: true });
    } else {
      form.setValue("oportunidad_id", null, { shouldDirty: true });
    }
  }, [selectedContacto, form]);

  const contactoOportunidadLabel = selectedContacto
    ? `#${String(selectedContacto.oportunidad_id).padStart(6, "0")} ${selectedContacto.oportunidad_titulo ?? ""}`.trim()
    : "";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ReferenceInput
          source="tipo_id"
          reference="crm/catalogos/tipos-evento"
          label="Tipo de evento"
          perPage={200}
          filter={{ activo: true }}
        >
          <SelectInput
            optionText="nombre"
            className="w-full"
            triggerProps={{
              className: "h-8 text-[11px] sm:h-9 sm:text-sm",
            }}
          />
        </ReferenceInput>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Contacto
          </Label>
          <ComboboxQuery
            source="contacto_id"
            resource="crm/gestion/contactos-activos"
            labelField="nombre_completo"
            limit={200}
            placeholder="Selecciona un contacto"
            className="w-full"
          />
        </div>
      </div>
      {selectedContacto ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Oportunidad
          </Label>
          <Input
            readOnly
            value={contactoOportunidadLabel}
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 sm:px-3 sm:py-2 sm:text-sm"
          />
        </div>
      ) : null}
      <DateTimeSplitInput source="fecha_evento" labelDate="Fecha" labelTime="Hora" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Asignado a
          </Label>
          <ResponsableSelector
            includeTodos={false}
            value={asignadoField.value ? String(asignadoField.value) : ""}
            onValueChange={(value) =>
              asignadoField.onChange(value ? Number(value) : null)
            }
            triggerClassName="h-8 text-[11px] sm:h-9 sm:text-sm"
          />
        </div>
        <TextInput
          source="titulo"
          label="Titulo"
          className="w-full [&_input]:h-8 [&_input]:text-[11px] sm:[&_input]:h-9 sm:[&_input]:text-sm"
        />
      </div>
      <TextInput
        source="descripcion"
        label="Descripcion"
        multiline
        rows={3}
        className="w-full [&_textarea]:text-[11px] sm:[&_textarea]:text-sm"
      />
      <TextInput source="tipo_evento" label={false} className="hidden" />
      <TextInput source="motivo_id" label={false} className="hidden" />
      <TextInput source="oportunidad_id" label={false} className="hidden" />
      <TextInput source="estado_evento" label={false} className="hidden" defaultValue="1-pendiente" />
    </div>
  );
};

export const CRMGestionPage = () => {
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: motivosPerdida = [] } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const [summary, setSummary] = useState<GestionSummary | null>(null);
  const [items, setItems] = useState<GestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [crearDialogOpen, setCrearDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<GestionItem | null>(null);
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaTime, setAgendaTime] = useState("");
  const [completarResultado, setCompletarResultado] = useState("");
  const [nuevoEstadoOportunidad, setNuevoEstadoOportunidad] = useState<string>("");
  const [motivoPerdidaId, setMotivoPerdidaId] = useState<string>("");
  const [motivoPerdidaError, setMotivoPerdidaError] = useState<string>("");
  const [formLoading, setFormLoading] = useState(false);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({
    today: false,
    overdue: false,
    tomorrow: true,
    week: true,
    next: true,
  });


  const autoSelectedOwnerRef = useRef(false);
  useEffect(() => {
    if (identity?.id && ownerFilter === "todos" && !autoSelectedOwnerRef.current) {
      setOwnerFilter(String(identity.id));
      autoSelectedOwnerRef.current = true;
    }
  }, [identity, ownerFilter]);



  const ownerId = ownerFilter !== "todos" ? ownerFilter : undefined;

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/crm/gestion/summary${ownerId ? `?owner_id=${ownerId}` : ""}`,
        { headers: { ...getAuthHeaders() } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as GestionSummary;
      setSummary(payload);
    } catch {
      setError("No se pudo cargar la informacion de gestion.");
    }
  }, [ownerId]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ownerId) params.set("owner_id", ownerId);
      if (search.trim()) params.set("q", search.trim());
      if (typeFilter !== "todos") {
        params.set("tipo_evento", typeFilter);
      }
      const url = `${API_URL}/crm/gestion/items${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { data: GestionItem[] };
      setItems(payload.data ?? []);
      setError(null);
    } catch {
      setError("No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }, [ownerId, search, typeFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchItems]);

  const grouped = useMemo(() => {
    const result: Record<string, GestionItem[]> = {
      today: [],
      overdue: [],
      tomorrow: [],
      week: [],
      next: [],
    };
    items.forEach((item) => {
      const key = item.bucket || "next";
      if (key === "overdue" && item.is_completed) {
        return;
      }
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    Object.keys(result).forEach((key) => {
      result[key] = result[key].slice().sort((a, b) => {
        const timeA = a.fecha_evento ? new Date(a.fecha_evento).getTime() : Number.POSITIVE_INFINITY;
        const timeB = b.fecha_evento ? new Date(b.fecha_evento).getTime() : Number.POSITIVE_INFINITY;
        return timeA - timeB;
      });
    });
    return result;
  }, [items]);

  const moveItemToBucket = useCallback(
    async (item: GestionItem, bucket: string) => {
      try {
        const response = await fetch(`${API_URL}/crm/gestion/move`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ evento_id: item.id, to_bucket: bucket }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchItems();
      } catch {
        setError("No se pudo mover el evento.");
      }
    },
    [fetchItems]
  );

  const {
    dragOverBucket,
    handleDragStart,
    handleDragEnd,
    handleBucketDragOver,
    handleBucketDrop,
    handleBucketDragLeave,
  } = useKanbanDragDrop<GestionItem, string>({
    onItemDropped: moveItemToBucket,
    getItemId: (item) => item.id,
  });

  const openAgendaDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    const initial = splitDateTime(item.fecha_evento);
    setAgendaDate(initial.date);
    setAgendaTime(initial.time);
    setAgendaDialogOpen(true);
  };

  const openCompletarDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    setCompletarResultado("");
    const estadoActual =
      item.oportunidad_estado ?? item.oportunidad?.estado ?? "";
    setNuevoEstadoOportunidad(estadoActual || "");
    setMotivoPerdidaId("");
    setMotivoPerdidaError("");
    setCompletarDialogOpen(true);
  };

  const openCrearDialog = () => {
    setCrearDialogOpen(true);
  };

  const defaultFechaEvento = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return `${formatDateInput(now)}T${formatTimeInput(now)}`;
  }, []);

  const handleAgendaSubmit = useCallback(async () => {
    if (!selectedEvento || !agendaDate || !agendaTime) {
      notify("Selecciona fecha y hora", { type: "warning" });
      return;
    }
    setFormLoading(true);
    try {
      const fecha_evento = `${agendaDate}T${agendaTime}`;
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: { fecha_evento },
        previousData: selectedEvento,
      });
      notify("Evento actualizado", { type: "success" });
      setAgendaDialogOpen(false);
      setSelectedEvento(null);
      refresh();
      fetchItems();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo actualizar el evento", { type: "error" });
    } finally {
      setFormLoading(false);
    }
  }, [selectedEvento, agendaDate, agendaTime, dataProvider, notify, refresh, fetchItems]);

  const handleCompletarSubmit = useCallback(async () => {
    if (!selectedEvento) return;
    const isPerdida = nuevoEstadoOportunidad === "6-perdida";
    if (isPerdida && !motivoPerdidaId) {
      setMotivoPerdidaError("Selecciona un motivo de perdida");
      notify("Selecciona un motivo de perdida", { type: "warning" });
      return;
    }
    setFormLoading(true);
    try {
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: {
          estado_evento: "2-realizado",
          resultado: completarResultado,
          fecha_estado: new Date().toISOString(),
        },
        previousData: selectedEvento,
      });
      const estadoActual =
        selectedEvento.oportunidad_estado ?? selectedEvento.oportunidad?.estado ?? "";
      const shouldUpdateOportunidad =
        Boolean(nuevoEstadoOportunidad) &&
        Boolean(selectedEvento.oportunidad?.id) &&
        nuevoEstadoOportunidad !== estadoActual;

      if (shouldUpdateOportunidad) {
        await dataProvider.update("crm/oportunidades", {
          id: selectedEvento.oportunidad?.id,
          data: {
            estado: nuevoEstadoOportunidad,
            motivo_perdida_id: isPerdida ? Number(motivoPerdidaId) || null : null,
            fecha_estado: new Date().toISOString(),
          },
          previousData: selectedEvento.oportunidad,
        });
      }

      notify("Evento completado", { type: "success" });
      setCompletarDialogOpen(false);
      setSelectedEvento(null);
      refresh();
      fetchItems();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo completar el evento", { type: "error" });
    } finally {
      setFormLoading(false);
    }
  }, [
    selectedEvento,
    completarResultado,
    nuevoEstadoOportunidad,
    motivoPerdidaId,
    dataProvider,
    notify,
    refresh,
    fetchItems,
  ]);


  const renderDraggable = (item: GestionItem, compact?: boolean) => (
    <div
      key={item.id}
      draggable
      onDragStart={(event) => handleDragStart(event, item)}
      onDragEnd={handleDragEnd}
      style={{ cursor: "grab" }}
    >
      <AgendaCard
        item={item}
        compact={compact}
        onAgendar={openAgendaDialog}
        onQuickSchedule={moveItemToBucket}
        onCompletar={openCompletarDialog}
      />
    </div>
  );

  const agendaItems = grouped.today;
  const overdueCount = grouped.overdue?.length ?? 0;
  const tomorrowCount = grouped.tomorrow?.length ?? 0;
  const weekCount = grouped.week?.length ?? 0;
  const nextCount = grouped.next?.length ?? 0;
  const totalPendientes =
    (summary?.buckets?.overdue ?? 0) +
    (summary?.buckets?.tomorrow ?? 0) +
    (summary?.buckets?.week ?? 0) +
    (summary?.buckets?.next ?? 0);

  const toggleBucket = (bucketKey: string) => {
    setCollapsedBuckets((prev) => ({ ...prev, [bucketKey]: !prev[bucketKey] }));
  };

  const renderBucketBody = (
    bucketKey: string,
    emptyMessage: string,
    compact?: boolean,
    autoHeight?: boolean
  ) => {
    const bodyClass = dragOverBucket === bucketKey ? "ring-1 ring-primary/40 bg-primary/5" : "";
    const heightClass = bucketKey === "today" ? "h-auto sm:h-[380px]" : "";
    const bucketItems = grouped[bucketKey] ?? [];
    if (collapsedBuckets[bucketKey]) {
      return null;
    }
    return (
      <KanbanBucketBody
        className={cn(bodyClass, heightClass, autoHeight ? "h-auto min-h-[96px]" : "")}
        onDragOver={(event) => handleBucketDragOver(event, bucketKey)}
        onDrop={(event) => handleBucketDrop(event, bucketKey)}
        onDragLeave={handleBucketDragLeave}
      >
        {bucketItems.length === 0 ? (
          <KanbanBucketEmpty message={emptyMessage} />
        ) : (
          bucketItems.map((item) => renderDraggable(item, compact || item.is_completed))
        )}
      </KanbanBucketBody>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start justify-between gap-3 sm:block">
          <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Gestion</h1>
          <p className="text-xs text-muted-foreground">
            Agenda, seguimiento y organizacion de tareas
          </p>
          </div>
          <div className="w-[45vw] sm:hidden">
            <ResponsableSelector
              value={ownerFilter}
              onValueChange={setOwnerFilter}
              placeholder="Responsable"
              triggerClassName="h-8 rounded-full text-[10px]"
              hideLabel
              hideLabelOnSmall
            />
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex w-[45vw] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:w-auto sm:py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full text-[10px] outline-none sm:w-44 sm:text-sm"
            />
          </div>
          <div className="hidden w-[45vw] sm:block sm:w-auto">
            <ResponsableSelector
              value={ownerFilter}
              onValueChange={setOwnerFilter}
              placeholder="Responsable"
              triggerClassName="h-8 rounded-full text-[10px] sm:h-9 sm:text-sm"
              hideLabel
              hideLabelOnSmall
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "todos", label: "Todos", icon: ListChecks },
          { id: "llamada", label: "Llamadas", icon: Phone },
          { id: "visita", label: "Visitas", icon: Home },
          { id: "tarea", label: "Tareas", icon: CheckSquare2 },
          { id: "evento", label: "Eventos", icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTypeFilter(tab.id)}
            className={cn(
              "relative inline-flex w-[20%] items-center justify-between gap-1 rounded-lg border px-1.5 py-1 text-[7px] font-semibold shadow-sm sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-xs",
              typeFilter === tab.id
                ? "border-blue-500 bg-blue-500 text-white shadow-blue-200"
                : "border-slate-200 bg-white text-slate-700"
            )}
          >
            <span className="inline-flex items-center gap-0.5 sm:gap-2">
              <tab.icon className="h-2 w-2 sm:h-3.5 sm:w-3.5" />
              {tab.label}
            </span>
            <span className="absolute -top-1 -right-1 inline-flex h-3 min-w-[12px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[6px] font-semibold text-white sm:static sm:ml-2 sm:h-auto sm:min-w-0 sm:bg-slate-100 sm:px-2 sm:py-0.5 sm:text-[11px] sm:text-slate-700">
              {tab.id === "todos" ? totalPendientes : null}
              {tab.id === "llamada" ? summary?.kpis?.llamadas_pendientes ?? 0 : null}
              {tab.id === "visita" ? summary?.kpis?.visitas_hoy ?? 0 : null}
              {tab.id === "tarea" ? summary?.kpis?.tareas_completadas ?? 0 : null}
              {tab.id === "evento" ? summary?.kpis?.eventos_semana ?? 0 : null}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}


      <KanbanBucket
        accentClass="from-white to-white"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-4",
          collapsedBuckets.today ? "min-h-0 py-3" : ""
        )}
      >
        <div
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50 sm:px-3"
          role="button"
          tabIndex={0}
          onClick={() => toggleBucket("today")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleBucket("today");
            }
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <CalendarDays className="h-7 w-7 text-slate-600 sm:h-9 sm:w-9" />
            <span className="text-[10px] text-slate-500 sm:text-xs">
              Agenda del {formatDate(agendaItems[0]?.fecha_evento)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
              onClick={(event) => {
                event.stopPropagation();
                openCrearDialog();
              }}
            >
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Nuevo
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-50 sm:px-2.5 sm:py-1.5 sm:text-xs"
              onClick={(event) => {
                event.stopPropagation();
                toggleBucket("today");
              }}
            >
              {collapsedBuckets.today ? (
                <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              ) : (
                <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              )}
              <span className="sr-only">Expandir agenda</span>
            </button>
          </div>
        </div>
        {collapsedBuckets.today ? null : (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {renderBucketBody("today", "Sin eventos para hoy")}
          </div>
        )}
      </KanbanBucket>

      <KanbanBucket accentClass="from-white to-white" className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pendientes</h2>
            <p className="text-xs text-slate-500">
              {summary?.buckets?.overdue ?? 0} vencidas, {summary?.buckets?.tomorrow ?? 0} mañana,{" "}
              {summary?.buckets?.week ?? 0} semana, {summary?.buckets?.next ?? 0} proximas
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
            <AlarmClock className="h-3 w-3" />
            {summary?.buckets?.overdue ?? 0} vencidos
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleBucket("overdue")}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500 text-white sm:h-7 sm:w-7">
                  <AlarmClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Vencidos</p>
                  <p className="text-[10px] text-slate-500 sm:text-xs">{overdueCount} pendientes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]">
                  {overdueCount}
                </span>
                {collapsedBuckets.overdue ? (
                  <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
                )}
              </div>
            </button>
            <div className="px-4 pb-3">{renderBucketBody("overdue", "Sin vencidas", false, true)}</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleBucket("tomorrow")}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500 text-white sm:h-7 sm:w-7">
                  <CalendarRange className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Mañana</p>
                  <p className="text-[10px] text-slate-500 sm:text-xs">{tomorrowCount} pendientes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-semibold text-white sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]">
                  {tomorrowCount}
                </span>
                {collapsedBuckets.tomorrow ? (
                  <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
                )}
              </div>
            </button>
            <div className="px-4 pb-3">
              {renderBucketBody("tomorrow", "Sin pendientes para mañana", false, true)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleBucket("week")}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500 text-white sm:h-7 sm:w-7">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Esta Semana</p>
                  <p className="text-[10px] text-slate-500 sm:text-xs">{weekCount} pendientes</p>
                </div>
              </div>
              {collapsedBuckets.week ? (
                <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              ) : (
                <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              )}
            </button>
            <div className="px-4 pb-3">
              {renderBucketBody("week", "Sin eventos esta semana", false, true)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleBucket("next")}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500 text-white sm:h-7 sm:w-7">
                  <CalendarClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Proximos</p>
                  <p className="text-[10px] text-slate-500 sm:text-xs">{nextCount} pendientes</p>
                </div>
              </div>
              {collapsedBuckets.next ? (
                <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              ) : (
                <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
              )}
            </button>
            <div className="px-4 pb-3">
              {renderBucketBody("next", "Sin proximos eventos", false, true)}
            </div>
          </div>
        </div>
      </KanbanBucket>

      <KanbanBucket accentClass="from-indigo-500 to-purple-600">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Acciones Rapidas</h2>
          <div className="space-y-2">
            {[
              { label: "Nueva Llamada", icon: Phone },
              { label: "Agendar Visita", icon: Home },
              { label: "Crear Evento", icon: Calendar },
              { label: "Nueva Tarea", icon: CheckSquare2 },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </KanbanBucket>

      {loading ? (
        <div className="text-xs text-muted-foreground">Actualizando agenda...</div>
      ) : null}
      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar evento</DialogTitle>
            <DialogDescription>Selecciona fecha y hora.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                  Fecha
                </Label>
                <input
                  type="date"
                  value={agendaDate}
                  onChange={(event) => setAgendaDate(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                  Hora
                </Label>
                <input
                  type="time"
                  value={agendaTime}
                  onChange={(event) => setAgendaTime(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAgendaDialogOpen(false)}
              disabled={formLoading}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button onClick={handleAgendaSubmit} disabled={formLoading} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={completarDialogOpen} onOpenChange={setCompletarDialogOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedEvento?.tipo_evento
                ? `Completar ${selectedEvento.tipo_evento}`
                : "Completar evento"}
            </DialogTitle>
            <DialogDescription>Registra el resultado y marca como completado.</DialogDescription>
          </DialogHeader>
          {selectedEvento ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">
                  {getTipoLabel(selectedEvento.tipo_evento)}
                </span>
                <span className="text-slate-400">•</span>
                <span className="truncate">{selectedEvento.titulo || "Sin titulo"}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span>Contacto: {getContactName(selectedEvento)}</span>
                <span className="text-slate-400">•</span>
                <span>
                  Oportunidad:{" "}
                  {selectedEvento.oportunidad?.id
                    ? `#${String(selectedEvento.oportunidad.id).padStart(6, "0")} ${selectedEvento.oportunidad_titulo ?? ""}`
                    : "Sin oportunidad"}
                </span>
              </div>
              <div className="mt-1">
                Estado actual oportunidad:{" "}
                {selectedEvento.oportunidad_estado ??
                  selectedEvento.oportunidad?.estado ??
                  "Sin estado"}
              </div>
            </div>
          ) : null}
          <div className="space-y-3 py-1 text-left">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Resultado
              </Label>
              <textarea
                rows={3}
                value={completarResultado}
                onChange={(event) => setCompletarResultado(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
                placeholder="Resultado de la actividad"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Nuevo estado de la oportunidad
              </Label>
              <Select
                value={nuevoEstadoOportunidad}
                onValueChange={setNuevoEstadoOportunidad}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_OPORTUNIDAD_ESTADO_CHOICES.map((estado) => (
                    <SelectItem key={estado.id} value={estado.id}>
                      {estado.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nuevoEstadoOportunidad === "6-perdida" ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Motivo de pérdida
                </Label>
                <Select
                  value={motivoPerdidaId}
                  onValueChange={(value) => {
                    setMotivoPerdidaId(value);
                    if (value) {
                      setMotivoPerdidaError("");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(motivosPerdida as any[]).map((motivo) => (
                      <SelectItem key={motivo.id} value={String(motivo.id)}>
                        {motivo.codigo ? `${motivo.codigo} - ${motivo.nombre}` : motivo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {motivoPerdidaError ? (
                  <p className="text-xs text-destructive">{motivoPerdidaError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompletarDialogOpen(false)}
              disabled={formLoading}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button onClick={handleCompletarSubmit} disabled={formLoading} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Completar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={crearDialogOpen} onOpenChange={setCrearDialogOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear evento</DialogTitle>
            <DialogDescription>Completa los datos para crear el evento.</DialogDescription>
          </DialogHeader>
          <CreateBase
            resource="crm/eventos"
            redirect={false}
            mutationOptions={{
              onSuccess: () => {
                notify("Evento creado", { type: "success" });
                setCrearDialogOpen(false);
                refresh();
                fetchItems();
              },
              onError: (error: any) => {
                notify(error?.message ?? "No se pudo crear el evento", { type: "error" });
              },
            }}
          >
            <SimpleForm
              className="w-full max-w-none"
              defaultValues={{
                fecha_evento: defaultFechaEvento,
                estado_evento: "1-pendiente",
                asignado_a_id: identity?.id ?? null,
              }}
              toolbar={
                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCrearDialogOpen(false)}
                    className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
                    type="button"
                  >
                    Cancelar
                  </Button>
                  <SaveButton
                    label="Crear"
                    className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
                  />
                </DialogFooter>
              }
            >
              <CrearEventoFormContent />
            </SimpleForm>
          </CreateBase>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMGestionPage;
