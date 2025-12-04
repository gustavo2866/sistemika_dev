"use client";

import { useEffect, useState, useCallback, type MouseEvent } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useListContext, useRecordContext, useRefresh, useNotify, useDataProvider } from "ra-core";
import { SummaryChips, type SummaryChipItem } from "@/components/lists/SummaryChips";
import { ResourceTitle } from "@/components/resource-title";
import { Mail, MessageCircle, Trash2, ArrowDownLeft, ArrowUpRight, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CRMMensaje, CRMMensajeEstado } from "./model";
import { CRMMensajeReplyDialog } from "./reply";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CRM_MENSAJE_TIPO_CHOICES,
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_ESTADO_BADGES,
  formatMensajeEstado,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const EVENT_TYPE_CHOICES = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunión" },
  { value: "visita", label: "Visita" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "nota", label: "Nota" },
];
const DEFAULT_EVENT_STATE = "1-pendiente";

const getDefaultDateTime = () => {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offsetMinutes * 60000);
  return local.toISOString().slice(0, 16);
};

const normalizeTipoFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
};

const setTipoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.tipo = values;
  } else {
    delete filters.tipo;
  }
};

const normalizeEstadoFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
};

const setEstadoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.estado = values;
  } else {
    delete filters.estado;
  }
};

const estadoChipClass = (estado: string, selected = false) => {
  const base =
    CRM_MENSAJE_ESTADO_BADGES[estado as keyof typeof CRM_MENSAJE_ESTADO_BADGES] ??
    "bg-slate-100 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar mensajes" className="w-full" alwaysOn />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={CRM_MENSAJE_TIPO_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="canal"
    source="canal"
    label="Canal"
    choices={CRM_MENSAJE_CANAL_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={CRM_MENSAJE_ESTADO_CHOICES}
    emptyText="Todos"
  />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="oportunidad_id" source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
    <SelectInput
      optionText={(record) =>
        record?.descripcion_estado ? `${record.id} - ${record.descripcion_estado}` : `#${record?.id}`
      }
      emptyText="Todas"
    />
  </ReferenceInput>,
];

const mensajeRowClass = (record: CRMMensaje) =>
  cn(
    "border-b border-slate-200/60 transition-colors hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 odd:bg-white even:bg-slate-50/70 last:border-b-0",
    record.tipo === "entrada" && "border-l-4 border-l-emerald-200/80",
    record.tipo === "salida" && "border-l-4 border-l-sky-200/80",
    record.estado === "nuevo" && "ring-1 ring-emerald-300/70 ring-offset-0"
  );

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const TipoDualToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const currentEstados = normalizeEstadoFilter(filterValues.estado);
  const current = currentTipos[0];

  const handleToggle = (next?: string) => {
    const newFilters = { ...filterValues };
    
    if (!next) {
      // NUEVOS: filter for entrada + nuevo
      setTipoFilterValue(newFilters, ["entrada"]);
      setEstadoFilterValue(newFilters, ["nuevo"]);
    } else if (next === "entrada") {
      // ENTRADA: filter for entrada + recibido
      setTipoFilterValue(newFilters, ["entrada"]);
      setEstadoFilterValue(newFilters, ["recibido"]);
    } else if (next === "salida") {
      // SALIDA: filter for salida only (all estados)
      setTipoFilterValue(newFilters, ["salida"]);
      delete newFilters.estado;
    }
    
    setFilters(newFilters, {});
  };

  const options: Array<{ id?: CRMMensaje["tipo"]; label: string; estado: CRMMensajeEstado }> = [
    { id: undefined, label: "Nuevos", estado: "nuevo" },
    { id: "entrada", label: "Entrada", estado: "recibido" },
    { id: "salida", label: "Salida", estado: "enviado" },
  ];

  return (
    <div className="flex items-center justify-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-1 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      {options.map(({ id, label, estado }, index) => {
        // Check active state based on tipo + estado combination
        let isActive = false;
        if (!id) {
          // NUEVOS: entrada + nuevo
          isActive = current === "entrada" && currentEstados[0] === "nuevo";
        } else if (id === "entrada") {
          // ENTRADA: entrada + recibido
          isActive = current === "entrada" && currentEstados[0] === "recibido";
        } else if (id === "salida") {
          // SALIDA: salida
          isActive = current === "salida";
        }
        
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const badgeColors =
          CRM_MENSAJE_ESTADO_BADGES[estado] ?? "bg-slate-100 text-slate-800";
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isActive}
            data-active={isActive}
            onClick={() => handleToggle(id)}
            className={cn(
              "min-w-[92px] rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-all duration-200",
              isFirst ? "rounded-l-full" : "",
              isLast ? "rounded-r-full" : "",
              isActive
                ? cn(
                    badgeColors,
                    "shadow-[0_4px_16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200"
                  )
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

const EstadoSummaryChips = () => {
  const { filterValues, setFilters } = useListContext();
  const [items, setItems] = useState<SummaryChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(filterValues);

  useEffect(() => {
    let cancel = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        Object.entries(filterValues).forEach(([key, value]) => {
          if (value == null) return;
          if (Array.isArray(value)) {
            if (!value.length) return;
            value.forEach((item) => {
              if (item != null && item !== "") {
                query.append(key, String(item));
              }
            });
            return;
          }
          if (value !== "") {
            query.append(key, String(value));
          }
        });
        const response = await fetch(
          `${API_URL}/crm/mensajes/aggregates/estado?${query.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const raw: Array<{ estado: string; total?: number }> =
          json?.data ?? json ?? [];
        const totals = new Map<string, number>();
        raw.forEach(({ estado, total }) => {
          totals.set(estado, total ?? 0);
        });
        // Filter estados based on tipo
        const currentTipos = normalizeTipoFilter(filterValues.tipo);
        const currentTipo = currentTipos[0];
        
        // Define estados for entrada and salida
        const estadosEntrada = ["nuevo", "recibido", "descartado"];
        const estadosSalida = ["pendiente_envio", "enviado", "error_envio"];
        
        // Filter choices based on tipo
        let filteredChoices = CRM_MENSAJE_ESTADO_CHOICES;
        if (currentTipo === "entrada") {
          filteredChoices = CRM_MENSAJE_ESTADO_CHOICES.filter(choice => 
            estadosEntrada.includes(choice.id)
          );
        } else if (currentTipo === "salida") {
          filteredChoices = CRM_MENSAJE_ESTADO_CHOICES.filter(choice => 
            estadosSalida.includes(choice.id)
          );
        }
        
        const mapped: SummaryChipItem[] = filteredChoices.map(
          (choice) => ({
            label: choice.name,
            value: choice.id,
            count: totals.get(choice.id as string) ?? 0,
            chipClassName: estadoChipClass(choice.id),
            selectedChipClassName: estadoChipClass(choice.id, true),
            countClassName: "text-xs font-semibold bg-slate-100 text-slate-600",
            selectedCountClassName:
              "text-xs font-semibold bg-white/70 text-slate-900",
          })
        );
        if (!cancel) {
          setItems(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (!cancel) {
          setError(err?.message ?? "No se pudieron cargar los estados");
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      cancel = true;
    };
  }, [signature]);

  const currentEstados = normalizeEstadoFilter(filterValues.estado);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    setEstadoFilterValue(nextFilters, value ? [value] : []);
    setFilters(nextFilters, {});
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex justify-center lg:justify-start lg:flex-shrink-0">
            <TipoDualToggle />
          </div>
          <div className="flex w-full justify-center lg:flex-1 lg:justify-end">
            <SummaryChips
              className="mb-0 border-none bg-transparent p-0 shadow-none"
              title={null}
              items={items}
              loading={loading}
              error={error}
              selectedValue={currentEstados[0]}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CRMMensajeList = () => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedMensaje, setSelectedMensaje] = useState<CRMMensaje | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [mensajeDescartar, setMensajeDescartar] = useState<CRMMensaje | null>(null);
  const [discardLoading, setDiscardLoading] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMensaje, setScheduleMensaje] = useState<CRMMensaje | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
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
  const refresh = useRefresh();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const scheduleContactoLabel = scheduleMensaje
    ? scheduleMensaje.contacto?.nombre_completo ??
      scheduleMensaje.contacto?.nombre ??
      (scheduleMensaje.contacto_id ? `Contacto #${scheduleMensaje.contacto_id}` : "No agendado")
    : "No agendado";
  const scheduleContactoReferencia =
    scheduleMensaje?.contacto_referencia ??
    scheduleMensaje?.origen_externo_id ??
    scheduleMensaje?.contacto_alias ??
    "Sin referencia";
  const scheduleOportunidadBadge = scheduleMensaje?.oportunidad_id
    ? `#${scheduleMensaje.oportunidad_id}`
    : "Se creará al agendar";
  const scheduleOportunidadLabel =
    scheduleMensaje?.oportunidad?.descripcion_estado ??
    (scheduleMensaje?.oportunidad_id ? "Oportunidad vinculada" : "Sin oportunidad asociada");

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
    if (scheduleOpen && !responsables.length && !responsablesLoading) {
      loadResponsables();
    }
  }, [scheduleOpen, responsables.length, responsablesLoading, loadResponsables]);

  useEffect(() => {
    if (!scheduleOpen || !scheduleMensaje || scheduleMensaje.oportunidad_id) return;
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
        console.error("No se pudieron cargar los tipos de operación", error);
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
  }, [scheduleOpen, scheduleMensaje?.id, scheduleMensaje?.oportunidad_id, dataProvider]);

  const handleReplyClick = (mensaje: CRMMensaje) => {
    setSelectedMensaje(mensaje);
    setReplyOpen(true);
  };

  const handleDiscardClick = (mensaje: CRMMensaje) => {
    setMensajeDescartar(mensaje);
    setDiscardOpen(true);
  };

  const handleDiscardDialogChange = (open: boolean) => {
    if (discardLoading) return;
    setDiscardOpen(open);
    if (!open) {
      setMensajeDescartar(null);
    }
  };

  const handleDiscardConfirm = async () => {
    if (!mensajeDescartar) return;
    setDiscardLoading(true);
    try {
      await dataProvider.update("crm/mensajes", {
        id: mensajeDescartar.id,
        data: { ...mensajeDescartar, estado: "descartado" },
        previousData: mensajeDescartar,
      });
      notify("Mensaje descartado", { type: "success" });
      setDiscardOpen(false);
      setMensajeDescartar(null);
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo descartar el mensaje", { type: "warning" });
    } finally {
      setDiscardLoading(false);
    }
  };

  const handleReplySuccess = () => {
    refresh();
  };

  const handleScheduleDialogChange = (open: boolean) => {
    if (scheduleSubmitting) return;
    setScheduleOpen(open);
    if (!open) {
      setScheduleMensaje(null);
    }
  };

  const handleScheduleClick = (mensaje: CRMMensaje) => {
    setScheduleMensaje(mensaje);
    setScheduleForm({
      titulo: mensaje.asunto || `Seguimiento mensaje #${mensaje.id}`,
      descripcion: mensaje.contenido ? mensaje.contenido.slice(0, 400) : "",
      tipoEvento: EVENT_TYPE_CHOICES[0].value,
      datetime: getDefaultDateTime(),
      asignadoId: mensaje.responsable_id ? String(mensaje.responsable_id) : "",
      contactoNombre: mensaje.contacto?.nombre_completo ?? mensaje.contacto?.nombre ?? "",
      tipoOperacionId: "",
    });
    setScheduleOpen(true);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleMensaje) return;
    if (!scheduleForm.titulo.trim()) {
      notify("Ingresa un título para la actividad.", { type: "warning" });
      return;
    }
    if (!scheduleForm.datetime) {
      notify("Selecciona fecha y hora.", { type: "warning" });
      return;
    }
    if (!scheduleForm.asignadoId) {
      notify("Selecciona la persona asignada.", { type: "warning" });
      return;
    }
    if (!scheduleMensaje.contacto_id && !scheduleForm.contactoNombre.trim()) {
      notify("Ingresa el nombre del contacto.", { type: "warning" });
      return;
    }
    if (!scheduleMensaje.oportunidad_id && !scheduleForm.tipoOperacionId) {
      notify("Selecciona el tipo de operación.", { type: "warning" });
      return;
    }
    const fechaIso = new Date(scheduleForm.datetime).toISOString();
    const asignadoIdNumber = Number(scheduleForm.asignadoId);
    const payload: Record<string, unknown> = {
      fecha_evento: fechaIso,
      titulo: scheduleForm.titulo.trim(),
      tipo_evento: scheduleForm.tipoEvento,
      estado_evento: DEFAULT_EVENT_STATE,
      asignado_a_id: asignadoIdNumber,
      responsable_id: scheduleMensaje.responsable_id ?? asignadoIdNumber,
    };
    const descripcion = scheduleForm.descripcion.trim();
    if (descripcion) {
      payload.descripcion = descripcion;
    }
    if (!scheduleMensaje.contacto_id) {
      payload.contacto_nombre = scheduleForm.contactoNombre.trim();
    }
    if (!scheduleMensaje.oportunidad_id && scheduleForm.tipoOperacionId) {
      payload.tipo_operacion_id = Number(scheduleForm.tipoOperacionId);
    }
    setScheduleSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/crm/mensajes/${scheduleMensaje.id}/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        notify("Contacto creado automáticamente", { type: "info" });
      }
      if (result?.oportunidad_creada) {
        notify("Oportunidad creada automáticamente", { type: "info" });
      }
      setScheduleOpen(false);
      setScheduleMensaje(null);
      setScheduleForm({
        titulo: "",
        descripcion: "",
        tipoEvento: EVENT_TYPE_CHOICES[0].value,
        datetime: getDefaultDateTime(),
        asignadoId: "",
        contactoNombre: "",
        tipoOperacionId: "",
      });
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo agendar el evento", { type: "warning" });
    } finally {
      setScheduleSubmitting(false);
    }
  };

  return (
    <>
      <List
        title={<ResourceTitle icon={Mail} text="CRM - Mensajes" />}
        filters={filters}
        actions={<ListActions />}
        perPage={10}
        sort={{ field: "fecha_mensaje", order: "DESC" }}
        className="space-y-5"
      >
    <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/80 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.15)]">
      <EstadoSummaryChips />
      <div className="rounded-[30px] border border-slate-200/70 bg-white/95 p-0 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition">
        <DataTable
          rowClick="show"
          className="w-full overflow-hidden rounded-[30px] border-0 shadow-none"
          rowClassName={mensajeRowClass}
        >
          <DataTable.Col
            source="fecha_mensaje"
            label="Fecha / Hora"
            className="w-[160px] min-w-[150px]"
            cellClassName="!whitespace-normal align-top"
          >
            <FechaCell />
          </DataTable.Col>
          <DataTable.Col
            source="contacto_id"
            label="Contacto"
            className="w-[160px] min-w-[140px] max-w-[180px]"
          >
            <ContactoCell />
          </DataTable.Col>
          <DataTable.Col
            source="asunto"
            label="Asunto"
            className="w-[320px] min-w-[280px]"
            cellClassName="!whitespace-normal"
          >
            <AsuntoCell />
          </DataTable.Col>
          <DataTable.Col source="estado" label="Estado" className="w-[100px] min-w-[90px]">
            <EstadoCell />
          </DataTable.Col>
          <DataTable.Col label="Acciones" className="w-[150px] min-w-[140px] justify-center">
            <AccionesCell
              onReplyClick={handleReplyClick}
              onDiscardClick={handleDiscardClick}
              onScheduleClick={handleScheduleClick}
            />
          </DataTable.Col>
        </DataTable>
      </div>
    </div>
      </List>
      <CRMMensajeReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        mensaje={selectedMensaje}
        onSuccess={handleReplySuccess}
      />
      <Dialog open={scheduleOpen} onOpenChange={handleScheduleDialogChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agendar actividad</DialogTitle>
            <DialogDescription>
              Crea un evento asociado al contexto del mensaje seleccionado.
            </DialogDescription>
          </DialogHeader>
          {scheduleMensaje ? (
            <div className="space-y-5 py-4">
              <section className="space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Contexto
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Contacto
                    </p>
                    <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 text-sm shadow-sm">
                      <p className="font-semibold text-foreground">{scheduleContactoLabel}</p>
                      <p className="text-xs text-muted-foreground">{scheduleContactoReferencia}</p>
                    </div>
                    {!scheduleMensaje.contacto_id ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Nombre del contacto *
                        </p>
                        <Input
                          value={scheduleForm.contactoNombre}
                          onChange={(event) =>
                            setScheduleForm((state) => ({ ...state, contactoNombre: event.target.value }))
                          }
                          placeholder="Nombre completo del contacto"
                          className="h-10"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Oportunidad
                    </p>
                    <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {scheduleOportunidadBadge}
                      </p>
                      <p className="text-sm text-foreground">{scheduleOportunidadLabel}</p>
                    </div>
                    {!scheduleMensaje.oportunidad_id ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Tipo de operación *
                        </p>
                        <select
                          value={scheduleForm.tipoOperacionId}
                          onChange={(event) =>
                            setScheduleForm((state) => ({ ...state, tipoOperacionId: event.target.value }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                    ) : null}
                  </div>
                </div>
              </section>
              <section className="space-y-4 rounded-2xl border border-border/50 bg-background p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tipo de evento *
                    </p>
                    <select
                      value={scheduleForm.tipoEvento}
                      onChange={(event) =>
                        setScheduleForm((state) => ({ ...state, tipoEvento: event.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {EVENT_TYPE_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Fecha y hora *
                    </p>
                    <Input
                      type="datetime-local"
                      value={scheduleForm.datetime}
                      onChange={(event) =>
                        setScheduleForm((state) => ({ ...state, datetime: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Asignado a *
                    </p>
                    {responsables.length ? (
                      <select
                        value={scheduleForm.asignadoId}
                        onChange={(event) =>
                          setScheduleForm((state) => ({ ...state, asignadoId: event.target.value }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                        value={scheduleForm.asignadoId}
                        onChange={(event) =>
                          setScheduleForm((state) => ({ ...state, asignadoId: event.target.value }))
                        }
                      />
                    )}
                    {responsablesLoading ? (
                      <p className="text-xs text-muted-foreground">Cargando responsables...</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Título *
                    </p>
                    <Input
                      value={scheduleForm.titulo}
                      onChange={(event) =>
                        setScheduleForm((state) => ({ ...state, titulo: event.target.value }))
                      }
                      placeholder="Ej: Coordinar visita"
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-inner">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </p>
                  <Textarea
                    rows={4}
                    value={scheduleForm.descripcion}
                    onChange={(event) =>
                      setScheduleForm((state) => ({ ...state, descripcion: event.target.value }))
                    }
                    placeholder="Notas adicionales o contexto de la actividad."
                    className="min-h-[120px] resize-none border border-primary/40 bg-white/95 focus-visible:ring-primary/40"
                  />
                </div>
              </section>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleScheduleDialogChange(false)}
              disabled={scheduleSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleScheduleSubmit} disabled={scheduleSubmitting}>
              {scheduleSubmitting ? "Guardando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={handleDiscardDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar mensaje</DialogTitle>
            <DialogDescription>
              Esta acción marcará el mensaje seleccionado como descartado. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground">
            {mensajeDescartar ? (
              <>
                <p className="font-semibold text-foreground">
                  #{mensajeDescartar.id} · {mensajeDescartar.asunto || "Sin asunto"}
                </p>
                <p>{mensajeDescartar.contacto?.nombre_completo || mensajeDescartar.contacto_referencia || "Sin referencia"}</p>
              </>
            ) : (
              <p>Selecciona un mensaje para descartar.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleDiscardDialogChange(false)} disabled={discardLoading}>
              Cancelar
            </Button>
            <Button onClick={handleDiscardConfirm} disabled={discardLoading || !mensajeDescartar}>
              {discardLoading ? "Descartando..." : "Descartar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const FechaCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const hasFecha = Boolean(record.fecha_mensaje);
  const date = hasFecha ? new Date(record.fecha_mensaje as string) : null;
  const tipoInfo =
    record.tipo === "salida"
      ? {
          label: "Salida",
          icon: ArrowUpRight,
          chipClass: "bg-sky-50 text-sky-700 border border-sky-100",
        }
      : record.tipo === "entrada"
        ? {
            label: "Entrada",
            icon: ArrowDownLeft,
            chipClass: "bg-emerald-50 text-emerald-700 border border-emerald-100",
          }
        : null;

  const formattedId = record.id != null ? `#${String(record.id).padStart(6, "0")}` : "";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-[12px] text-foreground shadow-sm">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
        <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-700">
          <span className="inline-flex items-center leading-none">
            <span>{formattedId}</span>
            {tipoInfo ? (
              <>
                <span aria-hidden="true">&nbsp;</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-[2px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
                    tipoInfo.chipClass
                  )}
                >
                  <tipoInfo.icon className="h-3 w-3" />
                  {record.canal ? <span className="capitalize">{record.canal}</span> : null}
                </span>
              </>
            ) : record.canal ? (
              <>
                <span aria-hidden="true">&nbsp;</span>
                <span className="inline-flex items-center text-[10px] uppercase leading-none text-slate-600">
                  {record.canal}
                </span>
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-1 text-sm font-semibold leading-tight text-slate-900">
        {hasFecha && date ? (
          <>
            <span className="text-base">{date.toLocaleDateString("es-AR")}</span>
            <span className="text-xs font-medium text-slate-500">·</span>
            <span className="text-sm font-medium text-slate-600">{date.toLocaleTimeString("es-AR")}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-slate-500">Sin fecha</span>
        )}
      </div>
    </div>
  );
};

const ContactoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const contactoNombre =
    record.contacto?.nombre_completo ??
    record.contacto?.nombre ??
    null;

  return (
    <div className="flex flex-col text-sm max-w-[220px]">
      <span className="font-medium leading-tight text-foreground line-clamp-2 break-words">
        {contactoNombre ||
          (record.contacto_id ? `Contacto #${record.contacto_id}` : "No agendado")}
      </span>
      {record.contacto_referencia ? (
        <span className="text-xs text-muted-foreground leading-tight line-clamp-2 break-words">
          {record.contacto_referencia}
        </span>
      ) : null}
      {record.oportunidad_id ? (
        <span className="text-[10px] font-medium text-slate-400 leading-tight">
          Oportunidad #{record.oportunidad_id}
        </span>
      ) : null}
    </div>
  );
};

const AsuntoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium line-clamp-1">{record.asunto || "Sin asunto"}</p>
      {record.contenido ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{record.contenido}</p>
      ) : null}
    </div>
  );
};

const EstadoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const estadoClass = record.estado
    ? CRM_MENSAJE_ESTADO_BADGES[record.estado]
    : "bg-slate-200 text-slate-800";
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Badge variant="outline" className={`${estadoClass} border-transparent`}>
        {formatMensajeEstado(record.estado)}
      </Badge>
    </div>
  );
};

interface AccionesCellProps {
  onReplyClick: (mensaje: CRMMensaje) => void;
  onDiscardClick: (mensaje: CRMMensaje) => void;
  onScheduleClick: (mensaje: CRMMensaje) => void;
}

const AccionesCell = ({ onReplyClick, onDiscardClick, onScheduleClick }: AccionesCellProps) => {
  const record = useRecordContext<CRMMensaje>();

  if (!record) return null;

  const handleReplyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onReplyClick(record);
  };

  const handleDiscardClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDiscardClick(record);
  };

  const handleScheduleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onScheduleClick(record);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={handleReplyClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <MessageCircle className="size-4" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Responder</span>
      </button>
      <button
        type="button"
        onClick={handleScheduleClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <CalendarPlus className="size-4 text-primary" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Agendar</span>
      </button>
      <button
        type="button"
        onClick={handleDiscardClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <Trash2 className="size-4 text-destructive" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Descartar</span>
      </button>
    </div>
  );
};
