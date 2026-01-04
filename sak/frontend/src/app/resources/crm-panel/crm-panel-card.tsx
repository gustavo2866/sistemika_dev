"use client";

import {
  Calendar,
  Check,
  X,
  FileText,
  ChevronRight,
  Building2,
  Home,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  getEmprendimientoName,
  getPropiedadName,
  getTipoOperacionName,
  formatMonto,
  formatEstadoLabel,
  formatCreatedDate,
  getEstadoBadgeClass,
  getResponsableAvatarInfo,
  type BucketKey,
} from "../crm-oportunidades/model";

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
  onAceptar?: (oportunidad: CRMOportunidad) => void;
  onAgendar?: (oportunidad: CRMOportunidad) => void;
  onCotizar?: (oportunidad: CRMOportunidad) => void;
  onCerrar?: (oportunidad: CRMOportunidad) => void;
  onDescartar?: (oportunidad: CRMOportunidad) => void;
}

interface CardMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
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

const getTipoOperacionBadgeClasses = (value: string | null | undefined) => {
  if (!value) return "bg-slate-100 text-slate-600";
  const normalized = value.toLowerCase();
  if (normalized.includes("venta")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("alquiler")) return "bg-sky-100 text-sky-700";
  if (normalized.includes("mantenimiento")) return "bg-amber-100 text-amber-700";
  if (normalized.includes("emprendimiento")) return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-600";
};

const createResponsableBlock = (oportunidad: CRMOportunidad) => {
  const { name: responsableName, avatarUrl, initials } = getResponsableAvatarInfo(oportunidad);
  const contactoName = getContactoName(oportunidad);
  const truncatedContacto = contactoName.length > 20 ? contactoName.substring(0, 20) + '...' : contactoName;
  const oportunidadNumber = `#${String(oportunidad.id).padStart(6, "0")}`;
  
  return (
    <div className="flex items-start gap-2">
      <KanbanAvatar src={avatarUrl} alt={responsableName} fallback={initials} className="border-white/70 shadow-sm" />
      <div className="flex flex-col gap-0">
        <span className="text-xs text-slate-700 font-medium" title={contactoName}>
          {truncatedContacto}
        </span>
        <span className="text-[10px] text-slate-600">
          {formatCreatedDate(oportunidad.created_at)}
          <span className="ml-1 text-[9px] text-slate-500">({oportunidadNumber})</span>
        </span>
      </div>
    </div>
  );
};

const createActionsMenu = (onEdit: (() => void) | undefined, actions: CardMenuAction[]) => {
  const hasActions = actions.length > 0;
  if (!onEdit && !hasActions) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(event) => event.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-transparent text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Acciones"
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onEdit && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="gap-2"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
            Editar
          </DropdownMenuItem>
        )}
        {onEdit && hasActions ? <DropdownMenuSeparator /> : null}
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick();
            }}
            disabled={action.disabled}
            className="gap-2"
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const createAgendarAction = (
  oportunidad: CRMOportunidad,
  onAgendar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Agendar",
  icon: <Calendar className="h-3.5 w-3.5 text-blue-600" />,
  onClick: () => onAgendar(oportunidad),
  disabled: updating,
});

const createConfirmarAction = (
  oportunidad: CRMOportunidad,
  onAceptar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Confirmar",
  icon: <Check className="h-3.5 w-3.5 text-emerald-600" />,
  onClick: () => onAceptar(oportunidad),
  disabled: updating,
});

const createCotizarAction = (
  oportunidad: CRMOportunidad,
  onCotizar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Cotizar",
  icon: <FileText className="h-3.5 w-3.5 text-amber-600" />,
  onClick: () => onCotizar(oportunidad),
  disabled: updating,
});

const createCerrarAction = (
  oportunidad: CRMOportunidad,
  onCerrar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Cerrar",
  icon: <Check className="h-3.5 w-3.5 text-emerald-600" />,
  onClick: () => onCerrar(oportunidad),
  disabled: updating,
});

const createDescartarAction = (
  oportunidad: CRMOportunidad,
  onDescartar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Descartar",
  icon: <X className="h-3.5 w-3.5 text-rose-500" />,
  onClick: () => onDescartar(oportunidad),
  disabled: updating,
});

// Configuración declarativa por estado
const getCardConfig = (
  oportunidad: CRMOportunidad,
  estado: CRMOportunidadEstado,
  handlers: CardHandlers,
  updating: boolean
): CardConfig => {

  // Elementos base
  const responsableBlock = createResponsableBlock(oportunidad);
  const checkIcon = createCheckIcon();
  const lostIcon = createLostIcon();
  const estadoBadge = createEstadoBadge(estado);
  const onEdit = handlers.onEdit ? () => handlers.onEdit!(oportunidad) : undefined;

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
      headerRight: createActionsMenu(
        onEdit,
        [
          handlers.onAceptar && createConfirmarAction(oportunidad, handlers.onAceptar, updating),
          handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
        ].filter(Boolean) as CardMenuAction[]
      ),
      actions: [],
    },
    "1-abierta": {
      headerLeft: responsableBlock,
      headerRight: createActionsMenu(
        onEdit,
        [
          handlers.onAgendar && createAgendarAction(oportunidad, handlers.onAgendar, updating),
          handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
        ].filter(Boolean) as CardMenuAction[]
      ),
      actions: [],
    },
    "2-visita": {
      headerLeft: responsableBlock,
      headerRight: createActionsMenu(
        onEdit,
        [
          handlers.onCotizar && createCotizarAction(oportunidad, handlers.onCotizar, updating),
          handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
        ].filter(Boolean) as CardMenuAction[]
      ),
      actions: [],
    },
    "3-cotiza": {
      headerLeft: responsableBlock,
      headerRight: createActionsMenu(
        onEdit,
        [
          handlers.onCerrar && createCerrarAction(oportunidad, handlers.onCerrar, updating),
          handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
        ].filter(Boolean) as CardMenuAction[]
      ),
      actions: [],
    },
    "4-reserva": {
      headerLeft: responsableBlock,
      headerRight: createActionsMenu(
        onEdit,
        [handlers.onCerrar && createCerrarAction(oportunidad, handlers.onCerrar, updating)].filter(
          Boolean
        ) as CardMenuAction[]
      ),
      actions: [],
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
  onAceptar?: (oportunidad: CRMOportunidad) => void;
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
  onAceptar,
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
    { onEdit, onAceptar, onAgendar, onCotizar, onCerrar, onDescartar },
    updating
  );

  // Body content (solo se muestra cuando no está colapsado)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      <KanbanMetaRow icon={<Building2 className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getEmprendimientoName(oportunidad)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<Home className="h-3 w-3 shrink-0 text-slate-400" />}>
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
  const tipoOperacionLabel = getTipoOperacionName(oportunidad);

  return (
    <KanbanCardWithCollapse
      id={oportunidad.id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      header={{
        left: config.headerLeft,
        right: config.headerRight,
      }}
      title={
        <span className="inline-flex flex-wrap items-center gap-1">
          <span title={fullTitle}>{truncatedTitle}</span>
          {tipoOperacionLabel ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide",
                getTipoOperacionBadgeClasses(tipoOperacionLabel)
              )}
            >
              {tipoOperacionLabel}
            </span>
          ) : null}
        </span>
      }
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
