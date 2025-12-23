"use client";

import { CalendarPlus, CheckCircle2, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GestionItem,
  formatDateTime,
  getContactName,
  getDisplayTitle,
  getOpportunityIdLabel,
  getTipoLabel,
  getTypeBadge,
  getTypeIcon,
  truncateTitle,
} from "./model";

export const CardGestion = ({
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
    const summaryText = `${formatDateTime(item.fecha_evento)} ${truncateTitle(
      getDisplayTitle(item),
      25
    )} ${getContactName(item)}`.trim();
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
                    Maヵana
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
            getTypeBadge(item.tipo_evento)
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
