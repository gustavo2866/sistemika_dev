"use client";

import { useCallback, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, DragEvent as ReactDragEvent } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  CalendarCheck, 
  UserRound,
  ChevronRight,
  Calendar,
  Edit3,
  Check,
  X
} from "lucide-react";
import { 
  useDataProvider, 
  useListContext, 
  useNotify,
  useRefresh
} from "ra-core";
import type { CRMEvento } from "../crm-eventos/model";
import {
  CRMEventoTodoFormDialog,
  type CRMEventoTodoFormValues,
  type OwnerOption,
  ensureOwnerOption,
  mapFormValuesToPayload,
  normalizeFormOwnerOptions,
} from "./form";
import {
  CRMEventoConfirmFormDialog,
  type CRMEventoConfirmFormValues,
} from "./form_confirm";
import {
  KanbanActionButton,
  KanbanBucket,
  KanbanBucketBody,
  KanbanBucketEmpty,
  KanbanBucketHeader,
  KanbanCard,
  KanbanCardBody,
  KanbanCardFooter,
  KanbanCardHeader,
  KanbanCardTitle,
  KanbanIconButton,
  KanbanAvatar,
  KanbanMeta,
  KanbanMetaRow,
  KanbanFilterBar,
} from "@/components/kanban";
import { getNextWeekStart, formatDateRange } from "@/components/kanban/utils";

type CanonicalEstado = "1-pendiente" | "2-realizado" | "3-cancelado" | "4-reagendar";
type BucketKey = "overdue" | "today" | "week" | "next";

const normalizeEstado = (raw?: string): CanonicalEstado => {
  if (!raw) return "1-pendiente";
  const lower = raw.toLowerCase();
  if (lower.includes("pendiente")) return "1-pendiente";
  if (lower.includes("realizado") || lower.includes("hecho")) return "2-realizado";
  if (lower.includes("cancelado")) return "3-cancelado";
  if (lower.includes("reagendar")) return "4-reagendar";
  return "1-pendiente";
};

const formatEstadoLabel = (estado: CanonicalEstado): string => {
  switch (estado) {
    case "1-pendiente":
      return "Pendiente";
    case "2-realizado":
      return "Realizado";
    case "3-cancelado":
      return "Cancelado";
    case "4-reagendar":
      return "Reagendar";
    default:
      return "Pendiente";
  }
};

const formatEventoTitulo = (evento: CRMEvento): string => {
  const titulo = evento.titulo?.trim() ?? "";
  if (!titulo) return "Sin titulo";
  return titulo.replace(/^ATRASADO:\s*/i, "") || "Sin titulo";
};

const cardToneClasses: Record<CanonicalEstado, string> = {
  "1-pendiente": "border-sky-100 bg-white/95 shadow-[0_10px_25px_rgba(14,165,233,0.12)]",
  "2-realizado": "border-emerald-100 bg-emerald-50 shadow-[0_10px_25px_rgba(16,185,129,0.18)]",
  "3-cancelado": "border-rose-100 bg-white/95 shadow-[0_10px_25px_rgba(244,114,182,0.12)]",
  "4-reagendar": "border-indigo-100 bg-white/95 shadow-[0_10px_25px_rgba(99,102,241,0.12)]",
};

const getCardStyle = (estado: CanonicalEstado) =>
  cardToneClasses[estado] ?? "border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.08)]";

const formatHeaderTimestamp = (dateStr?: string): string => {
  if (!dateStr) return "Sin fecha";
  try {
    const dt = new Date(dateStr);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, "0");
    const minutes = String(dt.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "Fecha inválida";
  }
};

const getOportunidadName = (evento: CRMEvento) => {
  const titulo = evento.oportunidad?.titulo || "";
  if (evento.oportunidad_id) {
    return `#${evento.oportunidad_id}${titulo ? ` ${titulo}` : ""}`.trim();
  }
  return titulo || "Sin oportunidad";
};

const getContactoName = (evento: CRMEvento) => {
  const contacto = evento.oportunidad?.contacto;
  const contactoNombreManual = (evento.oportunidad as { contacto_nombre?: string } | undefined)?.contacto_nombre?.trim();
  const nombre =
    contacto?.nombre?.trim() ||
    contacto?.nombre_completo?.trim() ||
    contactoNombreManual;
  if (nombre) {
    return nombre;
  }
  const contactoId = evento.oportunidad?.contacto_id;
  return contactoId ? `Contacto #${contactoId}` : "Sin contacto";
};

const getEstadoBadgeClass = (estado: CanonicalEstado) => {
  switch (estado) {
    case "1-pendiente":
      return "bg-amber-100 text-amber-900 border-transparent";
    case "2-realizado":
      return "bg-emerald-100 text-emerald-900 border-transparent";
    case "3-cancelado":
      return "bg-rose-100 text-rose-900 border-transparent";
    case "4-reagendar":
      return "bg-blue-100 text-blue-900 border-transparent";
    default:
      return "bg-slate-100 text-slate-800 border-transparent";
  }
};

const getOwnerName = (evento: CRMEvento) => {
  return evento.asignado_a?.nombre || (evento.asignado_a_id ? `Usuario #${evento.asignado_a_id}` : "Sin asignar");
};

const getOwnerInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getOwnerAvatarInfo = (evento: CRMEvento) => {
  const name = getOwnerName(evento);
  const avatarUrl =
    (evento.asignado_a as { url_foto?: string; avatar?: string } | undefined)?.url_foto ||
    (evento.asignado_a as { avatar?: string } | undefined)?.avatar ||
    null;
  return { name, avatarUrl, initials: getOwnerInitials(name) };
};

const filters = [
  <ReferenceInput key="oportunidad_id" source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
    <SelectInput optionText="titulo" emptyText="Todas" />
  </ReferenceInput>,
  <ReferenceInput key="asignado_a_id" source="asignado_a_id" reference="users" label="Asignado">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const EventoListContent = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: eventos = [], isLoading } = useListContext<CRMEvento>();

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("todos");
  const [focusFilter, setFocusFilter] = useState<"activos" | "todos">("activos");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [draggedEvento, setDraggedEvento] = useState<CRMEvento | null>(null);
  const [dragOverBucket, setDragOverBucket] = useState<BucketKey | null>(null);
  const [editingEvento, setEditingEvento] = useState<CRMEvento | null>(null);
  const [confirmEvento, setConfirmEvento] = useState<CRMEvento | null>(null);

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const entries = new Map<string, string>();
    eventos.forEach((evento) => {
      const id = evento.asignado_a?.id ?? evento.asignado_a_id;
      if (!id) return;
      const key = String(id);
      if (entries.has(key)) return;
      const label = evento.asignado_a?.nombre || `Usuario #${id}`;
      entries.set(key, label);
    });
    return [{ value: "todos", label: "Todos" }, ...Array.from(entries, ([value, label]) => ({ value, label }))];
  }, [eventos]);
  const assignableOwnerOptions = useMemo(
    () => normalizeFormOwnerOptions(ownerOptions.filter((option) => option.value !== "todos")),
    [ownerOptions]
  );
  const dialogOwnerOptions = useMemo(
    () => ensureOwnerOption(assignableOwnerOptions, editingEvento),
    [assignableOwnerOptions, editingEvento]
  );

  const filteredEventos = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return eventos.filter((evento) => {
      const estado = normalizeEstado(evento.estado_evento);
      if (focusFilter === "activos" && (estado === "2-realizado" || estado === "3-cancelado")) {
        return false;
      }
      if (ownerFilter !== "todos") {
        const ownerId = evento.asignado_a?.id ?? evento.asignado_a_id;
        if (String(ownerId ?? "") !== ownerFilter) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const hayCoincidencia =
        (evento.titulo ?? "").toLowerCase().includes(searchTerm) ||
        (evento.descripcion ?? "").toLowerCase().includes(searchTerm) ||
        getOwnerName(evento).toLowerCase().includes(searchTerm) ||
        getOportunidadName(evento).toLowerCase().includes(searchTerm) ||
        (evento.tipo_evento ?? "").toLowerCase().includes(searchTerm);
      return hayCoincidencia;
    });
  }, [eventos, search, ownerFilter, focusFilter]);

  const bucketedEventos = useMemo(() => {
    const buckets: Record<BucketKey, CRMEvento[]> = {
      overdue: [],
      today: [],
      week: [],
      next: [],
    };

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const nextWeekStart = getNextWeekStart(startOfToday);
    const followingWeekStart = new Date(nextWeekStart);
    followingWeekStart.setDate(followingWeekStart.getDate() + 7);

    filteredEventos.forEach((evento) => {
      if (!evento.fecha_evento) {
        buckets.next.push(evento);
        return;
      }
      const fechaEvento = new Date(evento.fecha_evento);
      if (Number.isNaN(fechaEvento.getTime())) {
        buckets.next.push(evento);
        return;
      }
      if (fechaEvento < startOfToday) {
        buckets.overdue.push(evento);
      } else if (fechaEvento <= endOfToday) {
        buckets.today.push(evento);
      } else if (fechaEvento >= nextWeekStart && fechaEvento < followingWeekStart) {
        buckets.week.push(evento);
      } else if (fechaEvento >= followingWeekStart) {
        buckets.next.push(evento);
      } else {
        buckets.next.push(evento);
      }
    });

    const sortByDate = (a: CRMEvento, b: CRMEvento) => {
      const aTime = a.fecha_evento ? new Date(a.fecha_evento).getTime() : 0;
      const bTime = b.fecha_evento ? new Date(b.fecha_evento).getTime() : 0;
      return aTime - bTime;
    };

    (Object.keys(buckets) as BucketKey[]).forEach((key) => {
      buckets[key].sort(sortByDate);
    });

    return buckets;
  }, [filteredEventos]);

  const bucketDefinitions: { key: BucketKey; title: string; helper: string; accentClass: string }[] = useMemo(() => {
    const now = new Date();
    const todayHelper = now.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

    const weekStart = getNextWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    return [
      { key: "overdue", title: "Vencidos", helper: "Fecha anterior a hoy", accentClass: "from-rose-50 to-white" },
      { key: "today", title: "Hoy", helper: todayHelper, accentClass: "from-amber-50 to-white" },
      { key: "week", title: "Semana", helper: formatDateRange(weekStart, weekEnd), accentClass: "from-blue-50 to-white" },
      { key: "next", title: "Siguiente", helper: formatDateRange(nextWeekStart, nextWeekEnd), accentClass: "from-slate-50 to-white" },
    ];
  }, []);

  const updating = updatingId !== null;

  const openEditDialog = useCallback((evento: CRMEvento) => {
    setEditingEvento(evento);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingEvento(null);
  }, []);

  const openConfirmDialog = useCallback((evento: CRMEvento) => {
    setConfirmEvento(evento);
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmEvento(null);
  }, []);

  const handleUpdateEstado = useCallback(
    async (evento: CRMEvento, newEstado: string) => {
      if (!evento.id) return;
      setUpdatingId(evento.id);
      try {
        await dataProvider.update<CRMEvento>("crm/eventos", {
          id: evento.id,
          data: { estado_evento: newEstado },
          previousData: evento,
        });
        notify("Estado actualizado correctamente", { type: "success" });
        // React Admin actualizará automáticamente los datos
      } catch (err: any) {
        console.error("Error al actualizar estado:", err);
        notify(err?.message ?? "No se pudo actualizar el estado", { type: "error" });
      } finally {
        setUpdatingId(null);
      }
    },
    [dataProvider, notify]
  );

  const handleDialogSubmit = useCallback(
    async (values: CRMEventoTodoFormValues) => {
      if (!editingEvento?.id) return;
      const parsedDate = new Date(values.fecha_evento);
      if (Number.isNaN(parsedDate.getTime())) {
        notify("La fecha seleccionada no es válida", { type: "warning" });
        return;
      }
      setUpdatingId(editingEvento.id);
      try {
        const payload = mapFormValuesToPayload(values, editingEvento);
        await dataProvider.update<CRMEvento>("crm/eventos", {
          id: editingEvento.id,
          data: payload,
          previousData: editingEvento,
        });
        notify("Evento actualizado correctamente", { type: "success" });
        refresh();
        closeEditDialog();
      } catch (err: any) {
        console.error("Error al actualizar evento:", err);
        notify(err?.message ?? "No se pudo actualizar el evento", { type: "error" });
      } finally {
        setUpdatingId(null);
      }
    },
    [closeEditDialog, dataProvider, editingEvento, notify, refresh]
  );

  const handleConfirmSubmit = useCallback(
    async (values: CRMEventoConfirmFormValues) => {
      if (!confirmEvento?.id) return;
      const resultado = values.resultado.trim();
      if (!resultado) {
        notify("Ingresa el resultado del evento", { type: "warning" });
        return;
      }
      setUpdatingId(confirmEvento.id);
      try {
        await dataProvider.update<CRMEvento>("crm/eventos", {
          id: confirmEvento.id,
          data: {
            estado_evento: "2-realizado",
            resultado,
          },
          previousData: confirmEvento,
        });

        const nuevoEstado = values.oportunidad_estado;
        const estadoActual = confirmEvento.oportunidad?.estado;
        if (
          confirmEvento.oportunidad_id &&
          nuevoEstado &&
          nuevoEstado !== estadoActual
        ) {
          const fechaEstado =
            confirmEvento.fecha_evento ??
            new Date().toISOString();
          await dataProvider.update("crm/oportunidades", {
            id: confirmEvento.oportunidad_id,
            data: {
              estado: nuevoEstado,
              fecha_estado: fechaEstado,
            },
            previousData: confirmEvento.oportunidad ?? undefined,
          });
        }

        notify("Evento confirmado correctamente", { type: "success" });
        refresh();
        closeConfirmDialog();
      } catch (err: any) {
        console.error("Error al confirmar evento:", err);
        notify(err?.message ?? "No se pudo confirmar el evento", { type: "error" });
      } finally {
        setUpdatingId(null);
      }
    },
    [closeConfirmDialog, confirmEvento, dataProvider, notify, refresh]
  );


  const moveEventoToBucket = useCallback(
    async (evento: CRMEvento, bucket: BucketKey) => {
      if (!evento.id) return;
      setUpdatingId(evento.id);
      try {
        const now = new Date();
        const original = evento.fecha_evento ? new Date(evento.fecha_evento) : null;
        const copyTime = (target: Date) => {
          if (original && !Number.isNaN(original.getTime())) {
            target.setHours(
              original.getHours(),
              original.getMinutes(),
              original.getSeconds(),
              original.getMilliseconds()
            );
          } else {
            target.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          }
        };

        const weekStart = getNextWeekStart(now);

        let targetDate: Date | null = null;
        if (bucket === "today") {
          targetDate = new Date();
        } else if (bucket === "week") {
          targetDate = new Date(weekStart);
        } else if (bucket === "next") {
          targetDate = new Date(weekStart);
          targetDate.setDate(targetDate.getDate() + 7);
        }

        if (!targetDate) {
          setUpdatingId(null);
          return;
        }

        copyTime(targetDate);

        await dataProvider.update<CRMEvento>("crm/eventos", {
          id: evento.id,
          data: { fecha_evento: targetDate.toISOString(), estado_evento: "1-pendiente" },
          previousData: evento,
        });
        const bucketLabel =
          bucket === "today" ? "hoy" : bucket === "week" ? "esta semana" : "próxima semana";
        notify(`Evento movido a ${bucketLabel}`, { type: "info" });
        refresh();
      } catch (err: any) {
        console.error("Error al mover evento:", err);
        notify(err?.message ?? "No se pudo mover el evento", { type: "error" });
      } finally {
        setUpdatingId(null);
      }
    },
    [dataProvider, notify, refresh]
  );

  const handleDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>, evento: CRMEvento) => {
    if (!evento.id) return;
    setDraggedEvento(evento);
    event.dataTransfer.setData("text/plain", String(evento.id));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedEvento(null);
    setDragOverBucket(null);
  }, []);

  const handleBucketDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, bucket: BucketKey) => {
      if (!draggedEvento) return;
      if (bucket === "overdue") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverBucket(bucket);
    },
    [draggedEvento]
  );

  const handleBucketDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, bucket: BucketKey) => {
      event.preventDefault();
      if (!draggedEvento || bucket === "overdue") {
        setDragOverBucket(null);
        return;
      }
      moveEventoToBucket(draggedEvento, bucket);
      setDraggedEvento(null);
      setDragOverBucket(null);
    },
    [draggedEvento, moveEventoToBucket]
  );

  const handleBucketDragLeave = useCallback(() => {
    setDragOverBucket(null);
  }, []);

  const renderCard = (evento: CRMEvento, bucketKey?: BucketKey) => {
    const estado = normalizeEstado(evento.estado_evento);
    const isDraggable = bucketKey !== undefined;
    const isRealizado = estado === "2-realizado";
    const isPendiente = estado === "1-pendiente";
    const checkIcon = (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
        ✓
      </div>
    );
    const estadoBadge = (
      <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
        {formatEstadoLabel(estado)}
      </Badge>
    );
    const { name: ownerName, avatarUrl, initials } = getOwnerAvatarInfo(evento);
    const dateInfo = (
      <div className={cn("flex flex-col leading-tight gap-0.5", isRealizado ? "items-start text-left" : "items-end")}>
        <p className="text-xs font-semibold tracking-tight text-foreground whitespace-nowrap">
          {formatHeaderTimestamp(evento.fecha_evento)}
        </p>
        {!isRealizado && !isPendiente ? <Calendar className="h-3 w-3 text-slate-500 self-end" /> : null}
      </div>
    );
    const avatarNode = (
      <KanbanAvatar src={avatarUrl} alt={ownerName} fallback={initials} className="border-white/70 shadow-sm" />
    );
    const dateBlock = (
      <div
        className={cn(
          "flex items-center gap-2",
          isRealizado ? "justify-start" : "justify-end",
          isPendiente ? "text-left" : ""
        )}
      >
        {avatarNode}
        {dateInfo}
      </div>
    );
    const pendingIcon = (
      <KanbanIconButton
        icon={<Edit3 className="h-3.5 w-3.5" />}
        aria-label="Reagendar"
        className="border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
        onClick={(event: ReactMouseEvent) => {
          event.stopPropagation();
          openEditDialog(evento);
        }}
      />
    );

    return (
      <KanbanCard
        key={evento.id}
        className={cn(
          "cursor-pointer focus-within:ring-2 focus-within:ring-primary/40",
          getCardStyle(estado)
        )}
        draggable={isDraggable}
        onDragStart={isDraggable ? (event) => handleDragStart(event, evento) : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
      >
        <KanbanCardHeader>
          {isRealizado ? dateBlock : isPendiente ? dateBlock : estadoBadge}
          {isRealizado ? checkIcon : isPendiente ? pendingIcon : dateBlock}
        </KanbanCardHeader>
        <KanbanCardBody>
          <KanbanCardTitle className="line-clamp-2">{formatEventoTitulo(evento)}</KanbanCardTitle>
          <KanbanMeta className="bg-slate-50/80">
            <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
              <span className="text-[11px]">{getOportunidadName(evento)}</span>
            </KanbanMetaRow>
            <KanbanMetaRow icon={<UserRound className="h-[10px] w-[10px] text-slate-500" />}>
              {getContactoName(evento)}
            </KanbanMetaRow>
          </KanbanMeta>
        </KanbanCardBody>
        <KanbanCardFooter className="text-[8px] font-semibold text-slate-500">
          {estado !== "2-realizado" ? (
            <KanbanActionButton
              icon={<Check className="h-3 w-3 text-emerald-600" />}
              onClick={(event: ReactMouseEvent) => {
                event.stopPropagation();
                openConfirmDialog(evento);
              }}
              disabled={updating}
            >
              Confirmar
            </KanbanActionButton>
          ) : null}
          {estado !== "3-cancelado" && estado !== "2-realizado" ? (
            <KanbanActionButton
              icon={<X className="h-3 w-3 text-rose-500" />}
              onClick={(event: ReactMouseEvent) => {
                event.stopPropagation();
                handleUpdateEstado(evento, "3-cancelado");
              }}
              disabled={updating}
            >
              Cancelar
            </KanbanActionButton>
          ) : null}
        </KanbanCardFooter>
      </KanbanCard>
    );
  };

  return (
    <>
      <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
      <KanbanFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar eventos..."
        rightContent={
          <>
            <div className="flex gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 text-[11px] font-semibold uppercase">
              <Button
                type="button"
                variant={focusFilter === "activos" ? "default" : "ghost"}
                size="sm"
                className="rounded-full px-3"
                onClick={() => setFocusFilter("activos")}
              >
                Activos
              </Button>
              <Button
                type="button"
                variant={focusFilter === "todos" ? "default" : "ghost"}
                size="sm"
                className="rounded-full px-3"
                onClick={() => setFocusFilter("todos")}
              >
                Todos
              </Button>
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="min-w-[170px] h-8 rounded-2xl border-slate-200/80 bg-white/80 shadow-sm text-sm">
                <SelectValue placeholder="Asignado" />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Kanban por fechas */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando eventos...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bucketDefinitions.map(({ key, title, helper, accentClass }) => {
              const items = bucketedEventos[key];
              const isInteractive = key !== "overdue";
              const bodyClass = dragOverBucket === key ? "ring-1 ring-primary/40 bg-primary/5" : "";
              return (
                <KanbanBucket key={key} accentClass={accentClass}>
                  <KanbanBucketHeader title={title} helper={helper} count={items.length} />
                  <KanbanBucketBody
                    className={bodyClass}
                    onDragOver={isInteractive ? (event) => handleBucketDragOver(event, key) : undefined}
                    onDrop={isInteractive ? (event) => handleBucketDrop(event, key) : undefined}
                    onDragLeave={isInteractive ? handleBucketDragLeave : undefined}
                  >
                    {items.length === 0 ? (
                      <KanbanBucketEmpty message="Sin eventos" />
                    ) : (
                      items.map((evento) => renderCard(evento, key))
                    )}
                  </KanbanBucketBody>
                </KanbanBucket>
              );
            })}
          </div>
          {filteredEventos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron eventos con los filtros aplicados
            </div>
          )}
        </div>
      )}
    </div>

      <CRMEventoTodoFormDialog
        open={Boolean(editingEvento)}
        evento={editingEvento}
        ownerOptions={dialogOwnerOptions}
        onClose={closeEditDialog}
        onSubmit={handleDialogSubmit}
        saving={updating}
      />
      <CRMEventoConfirmFormDialog
        open={Boolean(confirmEvento)}
        evento={confirmEvento}
        onClose={closeConfirmDialog}
        onSubmit={handleConfirmSubmit}
        saving={updating}
      />
    </>
  );
};

export const CRMEventoListTodo = () => {
  return (
    <List
      resource="crm/eventos"
      title={<ResourceTitle icon={CalendarCheck} text="CRM - Eventos (Vista ToDo)" />}
      showBreadcrumb={false}
      filters={filters}
      actions={<ListActions />}
      perPage={100}
      sort={{ field: "fecha_evento", order: "ASC" }}
      className="space-y-5"
    >
      <EventoListContent />
    </List>
  );
};

export default CRMEventoListTodo;
