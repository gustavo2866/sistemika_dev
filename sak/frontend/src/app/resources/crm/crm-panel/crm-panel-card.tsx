"use client";

import {
  Calendar,
  Check,
  FileText,
  ChevronRight,
  Building2,
  Home,
  Pencil,
  MoreHorizontal,
  Trash2,
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
  type KanbanCardAction,
} from "@/components/forms/form_order";
import {
  canUseOportunidadActionForRecord,
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
  onReservar?: (oportunidad: CRMOportunidad) => void;
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
  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-[8px]">
    ✓
  </div>
);

const createLostIcon = () => (
  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-200 text-rose-700 text-[8px]">
    ✗
  </div>
);

const createEstadoBadge = (estado: CRMOportunidadEstado) => (
  <Badge variant="outline" className={cn("text-[6px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
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

const createResponsableBlock = (
  oportunidad: CRMOportunidad,
  estado: CRMOportunidadEstado,
  actionsMenu?: React.ReactNode,
) => {
  const contactoName = getContactoName(oportunidad);
  const truncatedContacto = contactoName;
  const oportunidadNumber = `#${String(oportunidad.id).padStart(6, "0")}`;
  const tipoOperacionLabel = getTipoOperacionName(oportunidad);
  const estadoBadge = createEstadoBadge(estado);
  
  return (
    <div className="flex w-full flex-col items-start gap-0.5">
      <div className="flex w-full items-start justify-between gap-1 flex-nowrap">
        {tipoOperacionLabel || estadoBadge ? (
          <div className="flex min-w-0 max-w-[110px] flex-wrap items-center gap-1">
            {tipoOperacionLabel ? (
              <span
                className={cn(
                  "inline-flex min-w-0 max-w-[90px] items-center truncate rounded-full px-1 py-0.5 text-[5px] font-semibold uppercase tracking-wide",
                  getTipoOperacionBadgeClasses(tipoOperacionLabel)
                )}
              >
                {tipoOperacionLabel}
              </span>
            ) : null}
            {estadoBadge}
          </div>
        ) : (
          <span className="text-[6px] text-slate-400">Sin tipo</span>
        )}
        {actionsMenu ? <div className="shrink-0">{actionsMenu}</div> : null}
      </div>
      <span className="w-full truncate text-[8px] text-slate-700 font-medium" title={contactoName}>
        {truncatedContacto}
      </span>
      <span className="text-[7px] text-slate-600">
        {formatCreatedDate(oportunidad.created_at)}
        <span className="ml-1 text-[6px] text-slate-500">({oportunidadNumber})</span>
      </span>
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
          className="flex h-4 w-4 items-center justify-center rounded-full border border-transparent text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Acciones"
          type="button"
        >
          <MoreHorizontal className="h-2.5 w-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-24 sm:w-32" forceMount>
        {onEdit && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Pencil className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 text-slate-500" />
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
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
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
  icon: <Calendar className="h-3 w-3 text-blue-600" />,
  onClick: () => onAgendar(oportunidad),
  disabled: updating,
});

const createConfirmarAction = (
  oportunidad: CRMOportunidad,
  onAceptar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Confirmar",
  icon: <Check className="h-3 w-3 text-emerald-600" />,
  onClick: () => onAceptar(oportunidad),
  disabled: updating,
});

const createCotizarAction = (
  oportunidad: CRMOportunidad,
  onCotizar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Cotizar",
  icon: <FileText className="h-3 w-3 text-amber-600" />,
  onClick: () => onCotizar(oportunidad),
  disabled: updating,
});

const createCerrarAction = (
  oportunidad: CRMOportunidad,
  onCerrar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Cerrar",
  icon: <Check className="h-3 w-3 text-emerald-600" />,
  onClick: () => onCerrar(oportunidad),
  disabled: updating,
});

const createReservarAction = (
  oportunidad: CRMOportunidad,
  onReservar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Reservar",
  icon: <FileText className="h-3 w-3 text-violet-600" />,
  onClick: () => onReservar(oportunidad),
  disabled: updating,
});

const createDescartarAction = (
  oportunidad: CRMOportunidad,
  onDescartar: (oportunidad: CRMOportunidad) => void,
  updating: boolean
): CardMenuAction => ({
  label: "Eliminar",
  icon: <Trash2 className="h-3 w-3 text-rose-500" />,
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
  const responsableBlock = createResponsableBlock(oportunidad, estado);
  const checkIcon = createCheckIcon();
  const lostIcon = createLostIcon();
  const estadoBadge = createEstadoBadge(estado);
  const onEdit = handlers.onEdit ? () => handlers.onEdit!(oportunidad) : undefined;
  const menuActions = [
    canUseOportunidadActionForRecord(oportunidad, "descartar") && handlers.onDescartar
      ? createDescartarAction(oportunidad, handlers.onDescartar, updating)
      : null,
    canUseOportunidadActionForRecord(oportunidad, "aceptar") && handlers.onAceptar
      ? createConfirmarAction(oportunidad, handlers.onAceptar, updating)
      : null,
    canUseOportunidadActionForRecord(oportunidad, "agendar") && handlers.onAgendar
      ? createAgendarAction(oportunidad, handlers.onAgendar, updating)
      : null,
    canUseOportunidadActionForRecord(oportunidad, "cotizar") && handlers.onCotizar
      ? createCotizarAction(oportunidad, handlers.onCotizar, updating)
      : null,
    canUseOportunidadActionForRecord(oportunidad, "reservar") && handlers.onReservar
      ? createReservarAction(oportunidad, handlers.onReservar, updating)
      : null,
    canUseOportunidadActionForRecord(oportunidad, "cerrar") && handlers.onCerrar
      ? createCerrarAction(oportunidad, handlers.onCerrar, updating)
      : null,
  ].filter(Boolean) as CardMenuAction[];
  const actionsMenu = createActionsMenu(onEdit, menuActions);

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
      headerLeft: createResponsableBlock(
        oportunidad,
        estado,
        actionsMenu
      ),
      headerRight: null,
      actions: [],
    },
    "1-abierta": {
      headerLeft: createResponsableBlock(
        oportunidad,
        estado,
        actionsMenu
      ),
      headerRight: null,
      actions: [],
    },
    "2-visita": {
      headerLeft: createResponsableBlock(
        oportunidad,
        estado,
        actionsMenu
      ),
      headerRight: null,
      actions: [],
    },
    "3-cotiza": {
      headerLeft: createResponsableBlock(
        oportunidad,
        estado,
        actionsMenu
      ),
      headerRight: null,
      actions: [],
    },
    "4-reserva": {
      headerLeft: createResponsableBlock(
        oportunidad,
        estado,
        actionsMenu
      ),
      headerRight: null,
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
  onReservar?: (oportunidad: CRMOportunidad) => void;
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
  onReservar,
  onCerrar,
  onDescartar,
}: CRMOportunidadKanbanCardProps) => {
  const estado = normalizeEstado(oportunidad.estado);
  const descripcionTexto = oportunidad.descripcion_estado?.trim() ?? "";
  const descripcionPreview = descripcionTexto
    ? `${descripcionTexto.slice(0, 30)}${descripcionTexto.length > 30 ? "..." : ""}`
    : null;
  
  // Obtener configuración declarativa basada en el estado
  const config = getCardConfig(
    oportunidad,
    estado,
    { onEdit, onAceptar, onAgendar, onCotizar, onReservar, onCerrar, onDescartar },
    updating
  );

  // Body content (solo se muestra cuando no está colapsado)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      <KanbanMetaRow icon={<Building2 className="h-2.5 w-2.5 shrink-0 text-slate-400" />}>
        <span className="text-[7px]">{getEmprendimientoName(oportunidad)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<Home className="h-2.5 w-2.5 shrink-0 text-slate-400" />}>
        <span className="text-[7px]">{getPropiedadName(oportunidad)}</span>
      </KanbanMetaRow>
      {oportunidad.monto && (
        <KanbanMetaRow icon={<ChevronRight className="h-2.5 w-2.5 shrink-0 text-slate-400" />}>
          <span className="text-[7px] font-semibold text-slate-700">{formatMonto(oportunidad)}</span>
        </KanbanMetaRow>
      )}
      {descripcionPreview ? (
        <p className="px-0.5 text-[7px] leading-tight text-slate-500">
          {descripcionPreview}
        </p>
      ) : null}
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
      onClick={onEdit ? () => onEdit(oportunidad) : undefined}
      header={{
        left: config.headerLeft,
        right: config.headerRight,
      }}
      title={
        <span className="inline-flex flex-wrap items-center gap-1 text-[8px]">
          <span title={fullTitle}>{truncatedTitle}</span>
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




