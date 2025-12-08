"use client";

import { useCallback, useMemo, useRef } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";
import { useListContext, useGetIdentity } from "ra-core";
import type { CRMEvento } from "../crm-eventos/model";
import { CRMEventoTodoFormDialog, type CRMEventoTodoFormDialogHandle } from "./form";
import { CRMEventoConfirmFormDialog, type CRMEventoConfirmFormDialogHandle } from "./form_confirm";
import { EventoCustomFilters } from "./custom-filters";
import { CRMEventoCard } from "./crm-evento-card";
import { KanbanBoardView, type BucketKey } from "@/components/kanban";
import { calculateEventoBucketKey, prepareMoveEventoPayload, getBucketLabel } from "./model";
import { getNextWeekStart, formatDateRange } from "@/components/kanban/utils";
import { normalizeEstado, getOwnerName, getOportunidadName } from "@/components/kanban/crm-evento-helpers";


// Definición de buckets
const getBuckets = () => {
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
    { key: "overdue" as BucketKey, title: "Vencidos", helper: "Fecha anterior a hoy", accentClass: "from-rose-50 to-white", interactive: false },
    { key: "today" as BucketKey, title: "Hoy", helper: todayHelper, accentClass: "from-amber-50 to-white" },
    { key: "week" as BucketKey, title: "Semana", helper: formatDateRange(weekStart, weekEnd), accentClass: "from-blue-50 to-white" },
    { key: "next" as BucketKey, title: "Siguiente", helper: formatDateRange(nextWeekStart, nextWeekEnd), accentClass: "from-slate-50 to-white" },
  ];
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
  const { data: identity } = useGetIdentity();
  const { data: eventos = [], isLoading } = useListContext<CRMEvento>();

  // ref de acciones de los diálogos
  const editDialogRef = useRef<CRMEventoTodoFormDialogHandle>(null);
  const confirmDialogRef = useRef<CRMEventoConfirmFormDialogHandle>(null);

  // Renderizado de tarjeta
  const renderCard = useCallback(
    (evento: CRMEvento, bucketKey?: BucketKey, collapsed?: boolean, onToggleCollapse?: () => void) => (
      <CRMEventoCard
        key={evento.id}
        evento={evento}
        bucketKey={bucketKey}
        collapsed={collapsed}
        updating={false}
        onToggleCollapse={onToggleCollapse}
        onConfirm={(evt) => confirmDialogRef.current?.open(evt)}
        onCancel={(_target) => {
          // Cancel will be handled via form
        }}
        onEdit={(evt) => editDialogRef.current?.open(evt)}
      />
    ),
    []
  );

  // Definición de buckets
  const buckets = useMemo(() => getBuckets(), []);

  // Filtro custom para estado activo/todos
  const activosFilter = useCallback((evento: CRMEvento, customFilters: Record<string, any>) => {
    const focusFilter = customFilters.focusFilter as "activos" | "todos";
    const estado = normalizeEstado(evento.estado_evento);
    
    if (focusFilter === "activos" && (estado === "2-realizado" || estado === "3-cancelado")) {
      // Para eventos completados/cancelados en bucket overdue, mostrar solo los de hoy
      const bucketKey = calculateEventoBucketKey(evento);
      if (bucketKey === "overdue") {
        const now = new Date();
        const fechaEstado = evento.fecha_estado ? new Date(evento.fecha_estado) : null;
        const isSameDay = (dateA: Date, dateB: Date) =>
          dateA.getFullYear() === dateB.getFullYear() &&
          dateA.getMonth() === dateB.getMonth() &&
          dateA.getDate() === dateB.getDate();
        const fechaEstadoEsHoy = fechaEstado ? isSameDay(fechaEstado, now) : false;
        return fechaEstadoEsHoy;
      }
      return false;
    }
    
    return true;
  }, []);

  // Filtro de búsqueda
  const searchFilter = useCallback((evento: CRMEvento, searchTerm: string) => {
    return (
      (evento.titulo ?? "").toLowerCase().includes(searchTerm) ||
      (evento.descripcion ?? "").toLowerCase().includes(searchTerm) ||
      getOwnerName(evento).toLowerCase().includes(searchTerm) ||
      getOportunidadName(evento).toLowerCase().includes(searchTerm) ||
      (evento.tipo_evento ?? "").toLowerCase().includes(searchTerm)
    );
  }, []);

  // Filtro de usuario asignado
  const ownerFilterFn = useCallback((evento: CRMEvento, ownerId: string) => {
    const eventoOwnerId = evento.asignado_a?.id ?? evento.asignado_a_id;
    return String(eventoOwnerId ?? "") === ownerId;
  }, []);

  return (
    <>
      <KanbanBoardView<CRMEvento, BucketKey>
        items={eventos}
        buckets={buckets}
        getBucketKey={calculateEventoBucketKey} // Determina el bucket de un evento
        onItemMove={prepareMoveEventoPayload} // Maneja el movimiento de un evento entre buckets
        resource="crm/eventos" // Recurso RA
        getMoveSuccessMessage={(evento, bucket) => `Evento movido a ${getBucketLabel(bucket)}`}
        customFilter={activosFilter} // Filtro custom
        searchFilter={searchFilter} // Filtro de búsqueda
        ownerFilter={ownerFilterFn} // Filtro de usuario asignado
        autoSelectOwnerId={identity?.id ? String(identity.id) : undefined}
        identity={identity}
        initialCustomState={{ focusFilter: "activos" }}
        filterConfig={{
          enableSearch: true,
          searchPlaceholder: "Buscar eventos...",
          enableOwnerFilter: true,
          ownerFilterPlaceholder: "Asignado",
          enableCollapseToggle: true,
        }}
        customFilters={({ customState, setCustomState }) => (
          <EventoCustomFilters
            focusFilter={(customState.focusFilter as "activos" | "todos") ?? "activos"}
            onFocusFilterChange={(value) => setCustomState("focusFilter", value)}
          />
        )}
        renderCard={renderCard}
        isLoading={isLoading}
        loadingMessage="Cargando eventos..."
        emptyMessage="Sin eventos"
        noResultsMessage="No se encontraron eventos con los filtros aplicados"
      />

      <CRMEventoTodoFormDialog
        ref={editDialogRef}
        records={eventos}
        identity={identity}
      />
      <CRMEventoConfirmFormDialog ref={confirmDialogRef} />
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
      perPage={1000}
      pagination={false}
      sort={{ field: "fecha_evento", order: "ASC" }}
      className="space-y-5"
    >
      <EventoListContent />
    </List>
  );
};

export default CRMEventoListTodo;
