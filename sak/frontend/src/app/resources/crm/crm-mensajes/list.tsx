"use client";

import { useState } from "react";
import { useGetOne, useRecordContext, useRefresh } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarPlus,
  MessageCircle,
  Trash2,
} from "lucide-react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List } from "@/components/list";
import {
  FormOrderListRowActions,
  ListPaginator,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { CRMMensajeReplyDialog } from "./form_responder";
import {
  CRMMensajesListDashboard,
  FECHA_ESTADO_FILTER_KEY,
} from "./list_dashboard";
import type { CRMMensaje } from "./model";
import {
  CRM_MENSAJE_CANAL_CHOICES,
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajePrioridad,
  getMensajeEstadoBadgeClass,
  getMensajePrioridadBadgeClass,
  getMensajeTipoBadgeClass,
} from "./model";

//#region Base CRUD: configuracion del listado

const listFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar mensajes",
        alwaysOn: true,
        className: "w-[150px] sm:w-[200px]",
      },
    },
    {
      type: "select",
      props: {
        source: "canal",
        label: "Canal",
        choices: CRM_MENSAJE_CANAL_CHOICES,
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[120px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Contacto",
      },
      selectProps: {
        optionText: "nombre_completo",
        emptyText: "Todos",
        className: "w-[180px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "responsable_id",
        reference: "users",
        label: "Responsable",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-[150px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "oportunidad_id",
        reference: "crm/oportunidades",
        label: "Oportunidad",
      },
      selectProps: {
        optionText: (record?: any) =>
          record?.descripcion_estado
            ? `${record.id} - ${record.descripcion_estado}`
            : `Oportunidad #${record?.id}`,
        emptyText: "Todas",
        className: "w-[190px]",
      },
    },
  ],
  { keyPrefix: "crm-mensajes" },
);

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listContainerClassName = "max-w-[1120px] w-full mr-auto";
const listTableClassName = "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]";
const listDefaultFilters = {
  tipo: ["entrada"],
  estado: ["nuevo"],
  [FECHA_ESTADO_FILTER_KEY]: "hoy",
};

//#endregion Base CRUD: configuracion del listado

//#region Fuera del patron: helpers de presentacion enriquecida

// Genera la clase CSS para una fila segun las propiedades del mensaje.
const mensajeRowClass = (record: CRMMensaje) =>
  cn(
    record.tipo === "entrada" && "border-l-4 border-l-emerald-200/80",
    record.tipo === "salida" && "border-l-4 border-l-sky-200/80",
    record.estado === "nuevo" && "ring-1 ring-emerald-300/70 ring-offset-0",
  );

// Resuelve la oportunidad relacionada usando el dato directo o el expand del backend.
const getLinkedOpportunityId = (mensaje: CRMMensaje) =>
  mensaje.oportunidad_id ?? (mensaje.oportunidad as any)?.id ?? null;

//#endregion Fuera del patron: helpers de presentacion enriquecida

//#region Fuera del patron: celdas enriquecidas del listado

// Muestra la fecha principal del mensaje junto con su tipo y tiempo relativo.
const FechaCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  const hasFecha = Boolean(record.fecha_mensaje);
  const date = hasFecha ? new Date(record.fecha_mensaje as string) : null;

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold leading-none text-slate-900">
          {hasFecha && date ? date.toLocaleDateString("es-AR") : "Sin fecha"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-0.5 text-[9px] leading-none text-slate-500">
        {hasFecha && date ? (
          <span>{date.toLocaleTimeString("es-AR")}</span>
        ) : (
          <span>Sin horario</span>
        )}
      </div>
      <p className="text-[8px] font-semibold leading-none tracking-wide text-slate-500">
        #{String(record.id ?? "").padStart(6, "0")}
      </p>
    </div>
  );
};

// Muestra el tipo de mensaje junto con el canal principal.
const TipoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  const tipoInfo =
    record.tipo === "salida"
      ? { label: "Salida", icon: ArrowUpRight }
      : record.tipo === "entrada"
        ? { label: "Entrada", icon: ArrowDownLeft }
        : null;

  return (
    <div className="space-y-1">
      {tipoInfo ? (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-transparent px-1.5 py-0 text-[9px] font-semibold",
            getMensajeTipoBadgeClass(record.tipo),
          )}
        >
          <tipoInfo.icon className="h-3 w-3" />
          {tipoInfo.label}
        </Badge>
      ) : null}
      <div>
        <Badge
          variant="outline"
          className="border-slate-200 px-1.5 py-0 text-[8px] text-slate-600"
        >
          {formatMensajeCanal(record.canal)}
        </Badge>
      </div>
    </div>
  );
};

// Muestra el contacto, referencia y oportunidad asociada.
const ContactoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  const contactoNombre =
    record.contacto?.nombre_completo ?? record.contacto?.nombre ?? null;
  const linkedOpportunityId = getLinkedOpportunityId(record);

  return (
    <div className="max-w-[240px] space-y-1">
      <p className="line-clamp-2 break-words text-[10px] font-medium leading-tight text-foreground">
        {contactoNombre ||
          (record.contacto_id ? `Contacto #${record.contacto_id}` : "No agendado")}
      </p>
      {record.contacto_referencia ? (
        <p className="line-clamp-2 break-words text-[9px] leading-tight text-muted-foreground">
          {record.contacto_referencia}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {record.contacto_alias ? (
          <Badge variant="outline" className="border-slate-200 px-1.5 py-0 text-[8px]">
            {record.contacto_alias}
          </Badge>
        ) : null}
        {linkedOpportunityId ? (
          <Badge
            variant="outline"
            className="border-sky-200 bg-sky-50 px-1.5 py-0 text-[8px] text-sky-700"
          >
            Op. #{linkedOpportunityId}
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

// Muestra el asunto y una vista previa del contenido.
const AsuntoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  const responsableNombre =
    record.responsable?.nombre_completo ?? record.responsable?.nombre ?? null;
  const asuntoNormalizado = record.asunto?.trim() ?? "";
  const contenidoNormalizado = record.contenido?.trim() ?? "";
  const hasAsunto = asuntoNormalizado.length > 0;

  return (
    <div className="max-w-[360px] space-y-1.5">
      {hasAsunto ? (
        <p className="line-clamp-1 text-[11px] font-medium text-slate-900">
          {asuntoNormalizado}
        </p>
      ) : null}
      {contenidoNormalizado ? (
        <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
          {contenidoNormalizado}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {responsableNombre ? (
          <span className="text-[9px] text-slate-500">Resp. {responsableNombre}</span>
        ) : null}
      </div>
    </div>
  );
};

// Muestra el estado del mensaje con badge y tiempo relativo.
const EstadoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant="outline"
        className={cn(
          "w-fit border-transparent px-1 py-0 text-[8px] leading-none",
          getMensajeEstadoBadgeClass(record.estado),
        )}
      >
        {formatMensajeEstado(record.estado)}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "w-fit border-transparent px-1 py-0 text-[8px] leading-none",
          getMensajePrioridadBadgeClass(record.prioridad),
        )}
      >
        {formatMensajePrioridad(record.prioridad)}
      </Badge>
    </div>
  );
};

type MenuActionProps = {
  onReplyClick: (mensaje: CRMMensaje) => void;
  onDiscardClick: (mensaje: CRMMensaje) => void;
  onScheduleClick: (mensaje: CRMMensaje) => void;
};

// Agrega la opcion para responder el mensaje desde el menu contextual.
const MensajeResponderMenuItem = ({
  onReplyClick,
}: Pick<MenuActionProps, "onReplyClick">) => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        onReplyClick(record);
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <MessageCircle className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Responder
    </DropdownMenuItem>
  );
};

// Agrega la opcion para crear una agenda asociada a la oportunidad del mensaje.
const MensajeAgendarMenuItem = ({
  onScheduleClick,
}: Pick<MenuActionProps, "onScheduleClick">) => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  if (!getLinkedOpportunityId(record)) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        onScheduleClick(record);
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <CalendarPlus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Agendar
    </DropdownMenuItem>
  );
};

// Agrega la opcion para descartar la oportunidad vinculada al mensaje.
const MensajeDescartarMenuItem = ({
  onDiscardClick,
}: Pick<MenuActionProps, "onDiscardClick">) => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  if (!getLinkedOpportunityId(record)) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        onDiscardClick(record);
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      variant="destructive"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Descartar
    </DropdownMenuItem>
  );
};

//#endregion Fuera del patron: celdas enriquecidas del listado

//#region Fuera del patron: acciones operativas y contexto

// Renderiza el contexto de oportunidad cuando el listado se abre desde otro flujo.
const MensajeContextBanner = ({
  contactoNombre,
  oportunidadTitulo,
  returnTo,
  onBack,
}: {
  contactoNombre: string | null;
  oportunidadTitulo: string;
  returnTo?: string;
  onBack: (returnPath?: string) => void;
}) => (
  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm">
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => onBack(returnTo)}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <Avatar className="size-9 border border-slate-200">
      <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
        {(contactoNombre ?? "Contacto")
          .split(/\s+/)
          .filter(Boolean)
          .map((part: string) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900">
        {contactoNombre ?? "Contacto"}
      </p>
      <p className="truncate text-[10px] text-slate-500">{oportunidadTitulo}</p>
    </div>
  </div>
);

//#endregion Fuera del patron: acciones operativas y contexto

//#region Base CRUD: componentes principales

// Renderiza las acciones principales del encabezado del listado.
const CRMMensajeListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={listFilters} size="sm" buttonClassName={listActionButtonClass} />
    <CreateButton className={listActionButtonClass} label="Crear" />
    <ExportButton className={listActionButtonClass} label="Exportar" />
  </div>
);

// Renderiza el listado principal del recurso de mensajes CRM.
export const CRMMensajeList = () => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedMensaje, setSelectedMensaje] = useState<CRMMensaje | null>(null);
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const contextState = location.state as { oportunidad_id?: number; returnTo?: string } | null;
  const oportunidadId = contextState?.oportunidad_id;
  const returnTo = contextState?.returnTo;
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId ?? 0 },
    { enabled: Boolean(oportunidadId) },
  );

  const contactoNombre =
    (oportunidad as any)?.contacto?.nombre_completo ??
    (oportunidad as any)?.contacto?.nombre ??
    (oportunidad as any)?.contacto_nombre ??
    null;
  const oportunidadTitulo =
    (oportunidad as any)?.titulo ??
    (oportunidad as any)?.descripcion_estado ??
    (oportunidadId ? `Oportunidad #${oportunidadId}` : "");

  const handleBackToContext = (returnPath?: string) => {
    if (returnPath) {
      navigate(returnPath, { replace: true });
      return;
    }

    navigate("/crm/mensajes", { replace: true });
  };

  const handleReplyClick = (mensaje: CRMMensaje) => {
    setSelectedMensaje(mensaje);
    setReplyOpen(true);
  };

  const handleDiscardClick = (mensaje: CRMMensaje) => {
    const linkedOpportunityId = getLinkedOpportunityId(mensaje);
    if (!linkedOpportunityId) return;
    navigate(`/crm/oportunidades/${linkedOpportunityId}/accion_descartar`, {
      state: { returnTo: returnTo ?? "/crm/mensajes" },
    });
  };

  const handleScheduleClick = (mensaje: CRMMensaje) => {
    const linkedOpportunityId = getLinkedOpportunityId(mensaje);
    if (!linkedOpportunityId) return;
    navigate(`/crm/oportunidades/${linkedOpportunityId}/accion_agendar`, {
      state: { returnTo: returnTo ?? "/crm/mensajes" },
    });
  };

  const handleReplySuccess = () => {
    refresh();
    setReplyOpen(false);
    setSelectedMensaje(null);
  };

  return (
    <>
      {oportunidadId ? (
        <MensajeContextBanner
          contactoNombre={contactoNombre}
          oportunidadTitulo={oportunidadTitulo}
          returnTo={returnTo}
          onBack={handleBackToContext}
        />
      ) : null}

      {/* Base del patron CRUD: List + actions + paginator + table. */}
      <List
        title="CRM - Mensajes"
        filters={listFilters}
        actions={<CRMMensajeListActions />}
        filterDefaultValues={listDefaultFilters}
        perPage={10}
        sort={{ field: "fecha_mensaje", order: "DESC" }}
        showBreadcrumb={false}
        containerClassName={listContainerClassName}
        pagination={<ListPaginator />}
        topContent={<CRMMensajesListDashboard />}
      >
        <ResponsiveDataTable
          rowClick="show"
          rowClassName={mensajeRowClass}
          className={listTableClassName}
        >
          <TextListColumn source="fecha_mensaje" label="Fecha / Hora" className="w-[120px]">
            <FechaCell />
          </TextListColumn>
          <TextListColumn source="tipo" label="Tipo" className="w-[92px]">
            <TipoCell />
          </TextListColumn>
          <TextListColumn source="contacto_id" label="Contacto" className="w-[132px]">
            <ContactoCell />
          </TextListColumn>
          <TextListColumn source="asunto" label="Mensaje" className="w-[220px]">
            <AsuntoCell />
          </TextListColumn>
          <TextListColumn source="estado" label="Estado" className="w-[72px]">
            <EstadoCell />
          </TextListColumn>
          <TextListColumn label="Acciones" className="w-[56px]">
            <FormOrderListRowActions
              showDelete={false}
              extraMenuItems={
                <>
                  <MensajeResponderMenuItem onReplyClick={handleReplyClick} />
                  <MensajeAgendarMenuItem onScheduleClick={handleScheduleClick} />
                  <MensajeDescartarMenuItem onDiscardClick={handleDiscardClick} />
                </>
              }
            />
          </TextListColumn>
        </ResponsiveDataTable>
      </List>

      <CRMMensajeReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        mensaje={selectedMensaje}
        onSuccess={handleReplySuccess}
      />
    </>
  );
};

//#endregion Base CRUD: componentes principales

