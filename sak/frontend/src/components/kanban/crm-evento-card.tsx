"use client";

import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { Calendar, ChevronRight, UserRound, Edit3, Check, X, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CRMEvento } from "@/app/resources/crm-eventos/model";
import {
  KanbanActionButton,
  KanbanCard,
  KanbanCardBody,
  KanbanCardFooter,
  KanbanCardHeader,
  KanbanCardTitle,
  KanbanIconButton,
  KanbanAvatar,
  KanbanMeta,
  KanbanMetaRow,
} from "./card";
import {
  formatEstadoLabel,
  formatEventoTitulo,
  formatHeaderTimestamp,
  getCardStyle,
  getContactoName,
  getEstadoBadgeClass,
  getOportunidadName,
  getOwnerAvatarInfo,
  normalizeEstado,
  type BucketKey,
} from "./crm-evento-helpers";

export interface CRMEventoCardProps {
  evento: CRMEvento;
  bucketKey?: BucketKey;
  collapsed: boolean;
  updating: boolean;
  onToggleCollapse: (evento: CRMEvento) => void;
  onConfirm: (evento: CRMEvento) => void;
  onCancel: (evento: CRMEvento) => void;
  onEdit: (evento: CRMEvento) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>, evento: CRMEvento) => void;
  onDragEnd?: () => void;
}

export const CRMEventoCard = ({
  evento,
  bucketKey,
  collapsed,
  updating,
  onToggleCollapse,
  onConfirm,
  onCancel,
  onEdit,
  onDragStart,
  onDragEnd,
}: CRMEventoCardProps) => {
  const estado = normalizeEstado(evento.estado_evento);
  const isDraggable = bucketKey !== undefined;
  const isRealizado = estado === "2-realizado";
  const isPendiente = estado === "1-pendiente";

  const handleEdit = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onEdit(evento);
  };
  const handleConfirm = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onConfirm(evento);
  };
  const handleCancel = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onCancel(evento);
  };
  const handleToggle = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onToggleCollapse(evento);
  };

  const checkIcon = (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
      ✓
    </div>
  );
  const banIcon = (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-rose-700 text-[10px]">
      <Ban className="h-3 w-3" />
    </div>
  );
  const estadoBadge = (
    <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
      {formatEstadoLabel(estado)}
    </Badge>
  );
  const { name: ownerName, avatarUrl, initials } = getOwnerAvatarInfo(evento);
  const dateInfo = (
    <div
      className={cn(
        "flex flex-col leading-tight gap-0.5",
        isRealizado || estado === "3-cancelado" ? "items-start text-left" : "items-end"
      )}
    >
      <p className="text-xs font-semibold tracking-tight text-foreground whitespace-nowrap">
        {formatHeaderTimestamp(evento.fecha_evento)}
      </p>
      {!isRealizado && !isPendiente && estado !== "3-cancelado" ? (
        <Calendar className="h-3 w-3 text-slate-500 self-end" />
      ) : null}
    </div>
  );
  const avatarNode = (
    <KanbanAvatar src={avatarUrl} alt={ownerName} fallback={initials} className="border-white/70 shadow-sm" />
  );
  const dateBlock = (
    <div
      className={cn(
        "flex items-center gap-2",
        isRealizado || estado === "3-cancelado" ? "justify-start" : "justify-end",
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
      onClick={handleEdit}
    />
  );

  return (
    <KanbanCard
      key={evento.id}
      className={cn(
        "cursor-pointer focus-within:ring-2 focus-within:ring-primary/40",
        getCardStyle(estado),
        collapsed ? "py-2" : ""
      )}
      draggable={isDraggable}
      onDragStart={isDraggable && onDragStart ? (event) => onDragStart(event, evento) : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      onDoubleClick={handleToggle}
    >
      <KanbanCardHeader>
        {isRealizado ? dateBlock : isPendiente || estado === "3-cancelado" ? dateBlock : estadoBadge}
        {isRealizado ? checkIcon : isPendiente ? pendingIcon : estado === "3-cancelado" ? banIcon : dateBlock}
      </KanbanCardHeader>
      <KanbanCardBody>
        <KanbanCardTitle className="line-clamp-2">{formatEventoTitulo(evento)}</KanbanCardTitle>
        {!collapsed ? (
          <KanbanMeta className="bg-slate-50/80">
            <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
              <span className="text-[11px]">{getOportunidadName(evento)}</span>
            </KanbanMetaRow>
            <KanbanMetaRow icon={<UserRound className="h-[10px] w-[10px] text-slate-500" />}>
              {getContactoName(evento)}
            </KanbanMetaRow>
          </KanbanMeta>
        ) : null}
      </KanbanCardBody>
      {!collapsed ? (
        <KanbanCardFooter className="text-[8px] font-semibold text-slate-500">
          {estado !== "2-realizado" && estado !== "3-cancelado" ? (
            <KanbanActionButton
              icon={<Check className="h-3 w-3 text-emerald-600" />}
              onClick={handleConfirm}
              disabled={updating}
            >
              Confirmar
            </KanbanActionButton>
          ) : null}
          {estado !== "3-cancelado" && estado !== "2-realizado" ? (
            <KanbanActionButton
              icon={<X className="h-3 w-3 text-rose-500" />}
              onClick={handleCancel}
              disabled={updating}
            >
              Cancelar
            </KanbanActionButton>
          ) : null}
        </KanbanCardFooter>
      ) : null}
    </KanbanCard>
  );
};
