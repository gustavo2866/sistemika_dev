"use client";

import { Calendar, ChevronRight, UserRound, Edit3, Check, X, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CRMEvento } from "../crm-eventos/model";
import {
  KanbanCardWithCollapse,
  type KanbanCardAction,
  KanbanIconButton,
  KanbanAvatar,
  KanbanMeta,
  KanbanMetaRow,
} from "@/components/kanban/card";
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
} from "@/components/kanban/crm-evento-helpers";

export interface CRMEventoCardProps {
  evento: CRMEvento;
  bucketKey?: BucketKey;
  collapsed?: boolean;
  updating?: boolean;
  onToggleCollapse?: () => void;
  onConfirm?: (evento: CRMEvento) => void;
  onCancel?: (evento: CRMEvento) => void;
  onEdit?: (evento: CRMEvento) => void;
}

export const CRMEventoCard = ({
  evento,
  bucketKey: _bucketKey,
  collapsed = false,
  updating = false,
  onToggleCollapse,
  onConfirm,
  onCancel,
  onEdit,
}: CRMEventoCardProps) => {
  const estado = normalizeEstado(evento.estado_evento);
  const isRealizado = estado === "2-realizado";
  const isPendiente = estado === "1-pendiente";
  const isCancelado = estado === "3-cancelado";

  // Header left content
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

  // Header right content
  const { name: ownerName, avatarUrl, initials } = getOwnerAvatarInfo(evento);
  const dateInfo = (
    <div
      className={cn(
        "flex flex-col leading-tight gap-0.5",
        isRealizado || isCancelado ? "items-start text-left" : "items-end"
      )}
    >
      <p className="text-xs font-semibold tracking-tight text-foreground whitespace-nowrap">
        {formatHeaderTimestamp(evento.fecha_evento)}
      </p>
      {!isRealizado && !isPendiente && !isCancelado ? (
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
        isRealizado || isCancelado ? "justify-start" : "justify-end",
        isPendiente ? "text-left" : ""
      )}
    >
      {avatarNode}
      {dateInfo}
    </div>
  );
  const pendingIcon = onEdit ? (
    <KanbanIconButton
      icon={<Edit3 className="h-3.5 w-3.5" />}
      aria-label="Reagendar"
      className="border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(evento);
      }}
    />
  ) : null;

  // Determine header content based on state
  let headerLeft: React.ReactNode;
  let headerRight: React.ReactNode;

  if (isRealizado) {
    headerLeft = dateBlock;
    headerRight = checkIcon;
  } else if (isPendiente) {
    headerLeft = dateBlock;
    headerRight = pendingIcon;
  } else if (isCancelado) {
    headerLeft = dateBlock;
    headerRight = banIcon;
  } else {
    headerLeft = estadoBadge;
    headerRight = dateBlock;
  }

  // Body content (only shown when not collapsed)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getOportunidadName(evento)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<UserRound className="h-[10px] w-[10px] text-slate-500" />}>
        {getContactoName(evento)}
      </KanbanMetaRow>
    </KanbanMeta>
  );

  // Actions
  const actions: KanbanCardAction[] = [];
  if (!isRealizado && !isCancelado && onConfirm) {
    actions.push({
      label: "Confirmar",
      icon: <Check className="h-3 w-3 text-emerald-600" />,
      onClick: () => onConfirm(evento),
      disabled: updating,
      variant: "success",
    });
  }
  if (!isCancelado && !isRealizado && onCancel) {
    actions.push({
      label: "Cancelar",
      icon: <X className="h-3 w-3 text-rose-500" />,
      onClick: () => onCancel(evento),
      disabled: updating,
      variant: "danger",
    });
  }

  return (
    <KanbanCardWithCollapse
      id={evento.id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      header={{
        left: headerLeft,
        right: headerRight,
      }}
      title={formatEventoTitulo(evento)}
      body={body}
      actions={actions}
      className={getCardStyle(estado)}
    />
  );
};
