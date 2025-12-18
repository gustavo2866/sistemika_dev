"use client";

import { Calendar, Check, X, FileText, ChevronRight, Building2, User, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CRMOportunidad, CRMOportunidadEstado } from "../crm-oportunidades/model";
import {
  KanbanCardWithCollapse,
  KanbanMeta,
  KanbanMetaRow,
  KanbanAvatar,
  type KanbanCardAction,
} from "@/components/kanban/card";
import {
  formatOportunidadTitulo,
  getCardStyle,
  getContactoName,
  getPropiedadName,
  formatMonto,
  formatEstadoLabel,
  formatCreatedDate,
  getEstadoBadgeClass,
  getResponsableAvatarInfo,
  type BucketKey,
} from "./crm-panel-helpers";

// ============================================================================
// Card Configuration (inline)
// ============================================================================

interface CardConfig {
  headerLeft: React.ReactNode;
  headerRight: React.ReactNode;
  actions: KanbanCardAction[];
}

interface CardHandlers {
  onEdit?: (oportunidad: CRMOportunidad) => void;
  onAgendar?: (oportunidad: CRMOportunidad) => void;
  onCotizar?: (oportunidad: CRMOportunidad) => void;
  onCerrar?: (oportunidad: CRMOportunidad) => void;
  onDescartar?: (oportunidad: CRMOportunidad) => void;
}

// Elementos reutilizables
const createCheckIcon = () => (
  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
    ✓
  </div>
);

const createLostIcon = () => (
  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-rose-700 text-[10px]">
    ✗
  </div>
);

const createEstadoBadge = (estado: CRMOportunidadEstado) => (
  <Badge variant="outline" className={cn("text-[9px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
    {formatEstadoLabel(estado)}
  </Badge>
);

const createResponsableBlock = (
  oportunidad: CRMOportunidad,
  isGanada: boolean,
  isPerdida: boolean
) => {
  const { name: responsableName, avatarUrl, initials } = getResponsableAvatarInfo(oportunidad);
  const contactoName = getContactoName(oportunidad);
  const truncatedContacto = contactoName.length > 20 ? contactoName.substring(0, 20) + '...' : contactoName;
  
  return (
    <div className="flex items-start gap-2">
      <KanbanAvatar src={avatarUrl} alt={responsableName} fallback={initials} className="border-white/70 shadow-sm" />
      <div className="flex flex-col gap-0">
        <span className="text-xs text-slate-700 font-medium" title={contactoName}>
          {truncatedContacto}
        </span>
        <span className="text-[10px] text-slate-600">
          {formatCreatedDate(oportunidad.created_at)}
        </span>
      </div>
    </div>
  );
};

const createAgendarAction = (
  oportunidad: CRMOportunidad,
  onAgendar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Agendar",
  icon: <Calendar className="h-3 w-3 text-blue-600" />,
  onClick: () => onAgendar(oportunidad),
  disabled: updating,
  variant: "default",
});

const createCotizarAction = (
  oportunidad: CRMOportunidad,
  onCotizar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Cotizar",
  icon: <FileText className="h-3 w-3 text-amber-600" />,
  onClick: () => onCotizar(oportunidad),
  disabled: updating,
  variant: "default",
});

const createCerrarAction = (
  oportunidad: CRMOportunidad,
  onCerrar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Cerrar",
  icon: <Check className="h-3 w-3 text-emerald-600" />,
  onClick: () => onCerrar(oportunidad),
  disabled: updating,
  variant: "success",
});

const createDescartarAction = (
  oportunidad: CRMOportunidad,
  onDescartar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): KanbanCardAction => ({
  label: "Descartar",
  icon: <X className="h-3 w-3 text-rose-500" />,
  onClick: () => onDescartar(oportunidad),
  disabled: updating,
  variant: "danger",
});

// Configuración declarativa por estado
const getCardConfig = (
  oportunidad: CRMOportunidad,
  estado: CRMOportunidadEstado,
  handlers: CardHandlers,
  updating: boolean
): CardConfig => {
  const isGanada = estado === "5-ganada";
  const isPerdida = estado === "6-perdida";

  // Elementos base
  const responsableBlock = createResponsableBlock(oportunidad, isGanada, isPerdida);
  const checkIcon = createCheckIcon();
  const lostIcon = createLostIcon();
  const estadoBadge = createEstadoBadge(estado);

  // Mapeo estado → configuración visual
  const stateConfigs: Record<string, CardConfig> = {
    "5-ganada": {
      headerLeft: responsableBlock,
      headerRight: checkIcon,
      actions: [],
    },
    "6-perdida": {
      headerLeft: responsableBlock,
      headerRight: lostIcon,
      actions: [],
    },
    "0-prospect": {
      headerLeft: responsableBlock,
      headerRight: (
        handlers.onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onEdit!(oportunidad); }}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
        )
      ),
      actions: [
        handlers.onAgendar && createAgendarAction(oportunidad, handlers.onAgendar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "1-abierta": {
      headerLeft: responsableBlock,
      headerRight: (
        handlers.onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onEdit!(oportunidad); }}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
        )
      ),
      actions: [
        handlers.onAgendar && createAgendarAction(oportunidad, handlers.onAgendar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "2-visita": {
      headerLeft: responsableBlock,
      headerRight: (
        handlers.onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onEdit!(oportunidad); }}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
        )
      ),
      actions: [
        handlers.onCotizar && createCotizarAction(oportunidad, handlers.onCotizar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "3-cotiza": {
      headerLeft: responsableBlock,
      headerRight: (
        handlers.onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onEdit!(oportunidad); }}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
        )
      ),
      actions: [
        handlers.onCerrar && createCerrarAction(oportunidad, handlers.onCerrar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "4-reserva": {
      headerLeft: responsableBlock,
      headerRight: (
        handlers.onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onEdit!(oportunidad); }}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
        )
      ),
      actions: [
        handlers.onCerrar && createCerrarAction(oportunidad, handlers.onCerrar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
  };

  // Default para otros estados
  const defaultConfig: CardConfig = {
    headerLeft: estadoBadge,
    headerRight: responsableBlock,
    actions: [],
  };

  return stateConfigs[estado] || defaultConfig;
};

// Normalizar estado (si viene con formato diferente)
const normalizeEstado = (estado?: string | null): BucketKey => {
  if (!estado) return "1-abierta";
  return estado as BucketKey;
};

// ============================================================================
// Component
// ============================================================================

export interface CRMOportunidadKanbanCardProps {
  oportunidad: CRMOportunidad;
  bucketKey?: BucketKey;
  collapsed?: boolean;
  updating?: boolean;
  onToggleCollapse?: () => void;
  onEdit?: (oportunidad: CRMOportunidad) => void;
  onAgendar?: (oportunidad: CRMOportunidad) => void;
  onCotizar?: (oportunidad: CRMOportunidad) => void;
  onCerrar?: (oportunidad: CRMOportunidad) => void;
  onDescartar?: (oportunidad: CRMOportunidad) => void;
}

export const CRMOportunidadKanbanCard = ({
  oportunidad,
  bucketKey: _bucketKey,
  collapsed = false,
  updating = false,
  onToggleCollapse,
  onEdit,
  onAgendar,
  onCotizar,
  onCerrar,
  onDescartar,
}: CRMOportunidadKanbanCardProps) => {
  const estado = normalizeEstado(oportunidad.estado);
  
  // Obtener configuración declarativa basada en el estado
  const config = getCardConfig(
    oportunidad,
    estado,
    { onEdit, onAgendar, onCotizar, onCerrar, onDescartar },
    updating
  );

  // Body content (solo se muestra cuando no está colapsado)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      <KanbanMetaRow icon={<User className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getContactoName(oportunidad)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<Building2 className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getPropiedadName(oportunidad)}</span>
      </KanbanMetaRow>
      {oportunidad.monto && (
        <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
          <span className="text-[11px] font-semibold text-slate-700">{formatMonto(oportunidad)}</span>
        </KanbanMetaRow>
      )}
    </KanbanMeta>
  );

  const isInactive = oportunidad.activo === false;
  const fullTitle = formatOportunidadTitulo(oportunidad);
  const truncatedTitle = fullTitle.length > 40 ? fullTitle.substring(0, 40) + '...' : fullTitle;

  return (
    <KanbanCardWithCollapse
      id={oportunidad.id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      header={{
        left: config.headerLeft,
        right: config.headerRight,
      }}
      title={<span title={fullTitle}>{truncatedTitle}</span>}
      body={body}
      actions={config.actions}
      className={cn(
        getCardStyle(estado),
        isInactive && "opacity-50 saturate-50"
      )}
      draggable={!isInactive}
    />
  );
};
