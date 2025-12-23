"use client";

import { AlarmClock, Calendar, Edit3, Check, X, Ban, ChevronRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CRMEvento } from "../crm-eventos/model";
import {
  KanbanCardWithCollapse,
  KanbanMeta,
  KanbanMetaRow,
  KanbanIconButton,
  KanbanAvatar,
  type KanbanCardAction,
} from "@/components/kanban/card";
import {
  formatEventoTitulo,
  getCardStyle,
  getContactoName,
  getOportunidadName,
  normalizeEstado,
  formatEstadoLabel,
  formatHeaderTimestamp,
  getEstadoBadgeClass,
  getOwnerAvatarInfo,
  type BucketKey,
  type CanonicalEstado,
} from "./crm-todo-helpers";

// ============================================================================
// Card Configuration (inline)
// ============================================================================

interface CardConfig {
  headerLeft: React.ReactNode;
  headerRight: React.ReactNode;
  actions: KanbanCardAction[];
}

interface CardHandlers {
  onEdit?: (evento: CRMEvento) => void;
  onConfirm?: (evento: CRMEvento) => void;
  onCancel?: (evento: CRMEvento) => void;
}

// Elementos reutilizables
const createCheckIcon = () => (
  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
    ✓
  </div>
);

const createBanIcon = () => (
  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-rose-700 text-[10px]">
    <Ban className="h-3 w-3" />
  </div>
);

const createEstadoBadge = (estado: CanonicalEstado) => (
  <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
    {formatEstadoLabel(estado)}
  </Badge>
);

const createPendingIcon = (evento: CRMEvento, onEdit: (evento: CRMEvento) => void) => (
  <KanbanIconButton
    icon={<Edit3 className="h-3.5 w-3.5" />}
    aria-label="Reagendar"
    className="border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
    onClick={(e) => {
      e.stopPropagation();
      onEdit(evento);
    }}
  />
);

const createDateBlock = (
  evento: CRMEvento,
  isRealizado: boolean,
  isCancelado: boolean,
  isPendiente: boolean
) => {
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

  return (
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
};

const createConfirmAction = (
  evento: CRMEvento,
  onConfirm: (evento: CRMEvento) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Confirmar",
  icon: <Check className="h-3 w-3 text-emerald-600" />,
  onClick: () => onConfirm(evento),
  disabled: updating,
  variant: "success",
});

const createCancelAction = (
  evento: CRMEvento,
  onCancel: (evento: CRMEvento) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Cancelar",
  icon: <X className="h-3 w-3 text-rose-500" />,
  onClick: () => onCancel(evento),
  disabled: updating,
  variant: "danger",
});

// Configuración declarativa por estado
const getCardConfig = (
  evento: CRMEvento,
  estado: CanonicalEstado,
  handlers: CardHandlers,
  updating: boolean
): CardConfig => {
  const isRealizado = estado === "2-realizado";
  const isPendiente = estado === "1-pendiente";
  const isCancelado = estado === "3-cancelado";

  // Elementos base
  const dateBlock = createDateBlock(evento, isRealizado, isCancelado, isPendiente);
  const checkIcon = createCheckIcon();
  const banIcon = createBanIcon();
  const estadoBadge = createEstadoBadge(estado);
  const pendingIcon = handlers.onEdit ? createPendingIcon(evento, handlers.onEdit) : null;

  // Mapeo estado → configuración visual
  const stateConfigs: Record<string, CardConfig> = {
    "2-realizado": {
      headerLeft: dateBlock,
      headerRight: checkIcon,
      actions: [],
    },
    "1-pendiente": {
      headerLeft: dateBlock,
      headerRight: pendingIcon,
      actions: [
        handlers.onConfirm && createConfirmAction(evento, handlers.onConfirm, updating),
        handlers.onCancel && createCancelAction(evento, handlers.onCancel, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "3-cancelado": {
      headerLeft: dateBlock,
      headerRight: banIcon,
      actions: [],
    },
  };

  // Default para otros estados
  const defaultConfig: CardConfig = {
    headerLeft: estadoBadge,
    headerRight: dateBlock,
    actions: [
      handlers.onConfirm && createConfirmAction(evento, handlers.onConfirm, updating),
      handlers.onCancel && createCancelAction(evento, handlers.onCancel, updating),
    ].filter(Boolean) as KanbanCardAction[],
  };

  return stateConfigs[estado] || defaultConfig;
};

// ============================================================================
// Component
// ============================================================================

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
  bucketKey,
  collapsed = false,
  updating = false,
  onToggleCollapse,
  onConfirm,
  onCancel,
  onEdit,
}: CRMEventoCardProps) => {
  const estado = normalizeEstado(evento.estado_evento);
  const isOverdue = bucketKey === "overdue";
  
  // Obtener configuración declarativa basada en el estado
  const config = getCardConfig(
    evento,
    estado,
    { onEdit, onConfirm, onCancel },
    updating
  );

  // Body content (solo se muestra cuando no está colapsado)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      {isOverdue ? (
        <KanbanMetaRow icon={<AlarmClock className="h-3 w-3 shrink-0 text-rose-500" />}>
          <span className="text-[11px] font-semibold text-rose-600">Tarea vencida</span>
        </KanbanMetaRow>
      ) : null}
      <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getOportunidadName(evento)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<UserRound className="h-[10px] w-[10px] text-slate-500" />}>
        {getContactoName(evento)}
      </KanbanMetaRow>
    </KanbanMeta>
  );

  return (
    <KanbanCardWithCollapse
      id={evento.id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      header={{
        left: config.headerLeft,
        right: config.headerRight,
      }}
      title={formatEventoTitulo(evento)}
      body={body}
      actions={config.actions}
      className={getCardStyle(estado)}
    />
  );
};
