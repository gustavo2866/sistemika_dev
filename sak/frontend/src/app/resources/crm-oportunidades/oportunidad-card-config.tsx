import { Calendar, Check, X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CRMOportunidad, CRMOportunidadEstado } from "./model";
import {
  type KanbanCardAction,
  KanbanAvatar,
} from "@/components/kanban/card";
import {
  formatEstadoLabel,
  formatFechaCierre,
  getEstadoBadgeClass,
  getResponsableAvatarInfo,
} from "./oportunidad-helpers";

// Configuración declarativa para tarjetas de oportunidad

export interface CardConfig {
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
  <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
    {formatEstadoLabel(estado)}
  </Badge>
);

const createResponsableBlock = (
  oportunidad: CRMOportunidad,
  isGanada: boolean,
  isPerdida: boolean
) => {
  const { name: responsableName, avatarUrl, initials } = getResponsableAvatarInfo(oportunidad);
  
  const dateInfo = oportunidad.fecha_cierre_estimada ? (
    <div
      className={cn(
        "flex flex-col leading-tight gap-0.5",
        isGanada || isPerdida ? "items-start text-left" : "items-end"
      )}
    >
      <p className="text-xs font-semibold tracking-tight text-foreground whitespace-nowrap">
        {formatFechaCierre(oportunidad.fecha_cierre_estimada)}
      </p>
      {!isGanada && !isPerdida && (
        <Calendar className="h-3 w-3 text-slate-500 self-end" />
      )}
    </div>
  ) : (
    <div className="text-xs text-slate-500">Sin fecha</div>
  );

  const avatarNode = (
    <KanbanAvatar src={avatarUrl} alt={responsableName} fallback={initials} className="border-white/70 shadow-sm" />
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isGanada || isPerdida ? "justify-start" : "justify-end"
      )}
    >
      {avatarNode}
      {dateInfo}
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
export const getCardConfig = (
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
      headerLeft: estadoBadge,
      headerRight: responsableBlock,
      actions: [
        handlers.onAgendar && createAgendarAction(oportunidad, handlers.onAgendar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "1-abierta": {
      headerLeft: estadoBadge,
      headerRight: responsableBlock,
      actions: [
        handlers.onAgendar && createAgendarAction(oportunidad, handlers.onAgendar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "2-visita": {
      headerLeft: estadoBadge,
      headerRight: responsableBlock,
      actions: [
        handlers.onCotizar && createCotizarAction(oportunidad, handlers.onCotizar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "3-cotiza": {
      headerLeft: estadoBadge,
      headerRight: responsableBlock,
      actions: [
        handlers.onCerrar && createCerrarAction(oportunidad, handlers.onCerrar, updating),
        handlers.onDescartar && createDescartarAction(oportunidad, handlers.onDescartar, updating),
      ].filter(Boolean) as KanbanCardAction[],
    },
    "4-reserva": {
      headerLeft: estadoBadge,
      headerRight: responsableBlock,
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
