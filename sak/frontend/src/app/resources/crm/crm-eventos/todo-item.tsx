"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  Flag,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { CRMEvento, SeguimientoOptionId } from "./model";
import {
  computeSeguimientoDate,
  formatDateTimeShort,
  getContactoDisplayName,
  getInitials,
  getResponsableAvatarUrl,
  getResponsableDisplayName,
  getTipoEventoValue,
  isEventoCompleted,
  seguimientoOptions,
} from "./model";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TodoRowActions } from "@/components/todo/todo-row-actions";

type CRMEventoTodoItemProps = {
  record: CRMEvento;
  onCompletar: (evento: CRMEvento) => void;
  compact?: boolean;
};

// Item row for CRM eventos with actions and basic metadata.
export const CRMEventoTodoItem = ({ record, onCompletar, compact = false }: CRMEventoTodoItemProps) => {
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);
  const isCompleted = isEventoCompleted(record);

  const contactoName = getContactoDisplayName(record);
  const tipoEvento = getTipoEventoValue(record);
  const responsable = getResponsableDisplayName(record);
  const responsableAvatar = getResponsableAvatarUrl(record);
  const responsableInitials = getInitials(responsable);

  const handleOpen = () => {
    if (!record.id) return;
    navigate(`/crm/crm-eventos/${record.id}`);
  };

  const handleSelection = async (optionId: SeguimientoOptionId) => {
    if (!record?.id) {
      return;
    }
    const targetDate = computeSeguimientoDate(optionId, record);
    if (!targetDate) {
      notify("No se pudo calcular la nueva fecha.", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await dataProvider.update<CRMEvento>("crm/crm-eventos", {
        id: record.id,
        data: { fecha_evento: targetDate.toISOString() },
        previousData: record,
      });
      notify(`Evento reprogramado para ${targetDate.toLocaleString("es-AR")}.`, { type: "info" });
      refresh();
    } catch (error: any) {
      console.error("Error al actualizar fecha_evento", error);
      const message = error?.message ?? "No se pudo actualizar la fecha del evento.";
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!record?.id) return;
    navigate(`/crm/crm-eventos/${record.id}`);
  };

  const handleComplete = async () => {
    if (!record?.id) return;
    onCompletar(record);
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      await dataProvider.delete("crm/crm-eventos", { id: record.id, previousData: record });
      notify("Evento eliminado.", { type: "info" });
      refresh();
    } catch (error: any) {
      console.error("Error al eliminar evento", error);
      const message = error?.message ?? "No se pudo eliminar el evento.";
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const tipoIcon = (() => {
    const value = tipoEvento.toLowerCase();
    if (value.includes("llam")) return Phone;
    if (value.includes("visita") || value.includes("reun")) return Calendar;
    if (value.includes("tarea")) return CalendarCheck;
    if (value.includes("email")) return Mail;
    if (value.includes("whatsapp")) return MessageCircle;
    if (value.includes("nota")) return StickyNote;
    return Calendar;
  })();

  return (
    <div
      className="flex items-center gap-1 border-b border-slate-100 px-2.5 py-1 last:border-b-0 hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 sm:gap-1.5 sm:px-4 sm:py-2"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <span
        className="w-[60px] shrink-0 text-[8px] font-semibold text-slate-500 sm:w-[80px] sm:text-[10px]"
      >
        {formatDateTimeShort(record.fecha_evento)}
      </span>
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 text-slate-600 sm:h-5 sm:w-5"
      >
        {(() => {
          const Icon = tipoIcon;
          return (
            <Icon className={compact ? "h-3 w-3" : "h-2.5 w-2.5 sm:h-3.5 sm:w-3.5"} />
          );
        })()}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[9px] sm:text-[11px] text-slate-700 ${
            isCompleted ? "line-through text-slate-400" : ""
          }`}
        >
          <span className={`font-semibold ${isCompleted ? "text-slate-400" : "text-slate-900"}`}>
            {contactoName.slice(0, 12)}
          </span>
          <span className="mx-1.5 text-slate-300">-</span>
          <span className="text-slate-700">{record.titulo || "Sin titulo"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Avatar
          className={
            compact
              ? "size-5 border border-slate-200"
              : "size-4.5 border border-slate-200 sm:size-6"
          }
        >
          {responsableAvatar ? (
            <AvatarImage src={responsableAvatar} alt={responsable} />
          ) : null}
          <AvatarFallback
            className={
              compact
                ? "bg-slate-100 text-[8px] font-semibold uppercase text-slate-600"
                : "bg-slate-100 text-[7px] font-semibold uppercase text-slate-600 sm:text-[9px]"
            }
          >
            {responsableInitials || "??"}
          </AvatarFallback>
        </Avatar>
        {isCompleted ? null : (
          <TodoRowActions
            loading={loading}
            triggerIcon={Flag}
            triggerLabel="Opciones de seguimiento"
            compact={compact}
            triggerClassName={compact ? "!h-[18px] !w-[18px] !min-h-[18px] !min-w-[18px] !p-0 !m-0" : undefined}
            triggerIconClassName={compact ? "!h-[12px] !w-[12px]" : undefined}
            actions={[
              ...seguimientoOptions.map((option) => ({
                id: option.id,
                label: option.label,
                icon:
                  option.id === "hoy"
                    ? CalendarDays
                    : option.id === "manana"
                      ? Calendar
                      : option.id === "semana"
                        ? CalendarRange
                        : CalendarClock,
                onSelect: () => handleSelection(option.id),
              })),
              {
                id: "editar",
                label: "Editar",
                icon: Pencil,
                onSelect: handleEdit,
                separatorBefore: true,
              },
              {
                id: "completar",
                label: "Completar",
                icon: Check,
                onSelect: handleComplete,
              },
              {
                id: "eliminar",
                label: "Eliminar",
                icon: Trash2,
                onSelect: handleDelete,
                confirm: {
                  title: "Eliminar evento",
                  content: "¿Seguro que deseas eliminar este evento?",
                  confirmLabel: "Eliminar",
                  confirmColor: "warning",
                },
              },
            ]}
          />
        )}
      </div>
    </div>
  );
};
