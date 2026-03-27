import {
  Ban,
  CheckCircle2,
  CircleDot,
  Clock3,
  Kanban,
  PauseCircle,
  PlayCircle,
  Plus,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  AlertKey,
  ProyDashboardAlertItem,
  ProyDashboardDetalleItem,
  ProyDashboardDetalleResponse,
  ProyDashboardSelectorsResponse,
} from "../../model";
import { getProyectoEstadoLabel } from "../../../proyectos/model";

export type DashboardDetailItem = {
  key: string;
  item: ProyDashboardDetalleItem;
  onClick: () => void;
};

export type DashboardAlertItemViewModel = ProyDashboardAlertItem & {
  selected: boolean;
  onSelect: () => void;
};

export type DashboardQuickActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

export type DashboardStatusCardItem = {
  key: string;
  title: string;
  count: number;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
  selected: boolean;
  onSelect: () => void;
};

export type DashboardMainPanelViewModel = {
  statusCards: DashboardStatusCardItem[];
  detailItems: DashboardDetailItem[];
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alerts: DashboardAlertItemViewModel[];
  quickActions: DashboardQuickActionItem[];
  totalProjects: number;
  listTitle: string;
};

type UseDashboardMainPanelParams = {
  selectorData: ProyDashboardSelectorsResponse | null;
  selectedEstado: string;
  selectedAlertKey: AlertKey | null;
  detailData: ProyDashboardDetalleResponse | null;
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alertItems: ProyDashboardAlertItem[];
  onSelectEstado: (estado: string) => void;
  onSelectAlert: (key: AlertKey) => void;
  onOpenProject: (item: ProyDashboardDetalleItem) => void;
  onNavigate: (path: string) => void;
};

const ALERT_LIST_TITLES: Record<AlertKey, string> = {
  ordenes_rechazadas: "Proyectos con ordenes rechazadas",
  mensajes: "Proyectos con mensajes nuevos",
  eventos: "Proyectos con tareas vencidas",
};

const normalizeEstadoKey = (value: string) => String(value ?? "").trim().toLowerCase();

const getEstadoVisuals = (estado: string): Pick<DashboardStatusCardItem, "icon" | "accentClassName" | "iconClassName"> => {
  const normalized = normalizeEstadoKey(estado);

  if (normalized.startsWith("01-plan")) {
    return {
      icon: Clock3,
      accentClassName: "bg-amber-500",
      iconClassName: "text-amber-600",
    };
  }

  if (normalized.startsWith("02-ejeucion") || normalized.startsWith("02-ejecucion")) {
    return {
      icon: PlayCircle,
      accentClassName: "bg-sky-500",
      iconClassName: "text-sky-600",
    };
  }

  if (normalized.startsWith("03-conclusion")) {
    return {
      icon: CircleDot,
      accentClassName: "bg-violet-500",
      iconClassName: "text-violet-600",
    };
  }

  if (normalized.startsWith("04-terminados")) {
    return {
      icon: CheckCircle2,
      accentClassName: "bg-emerald-500",
      iconClassName: "text-emerald-600",
    };
  }

  if (["finalizado", "finalizada", "cerrado", "cerrada", "completado", "completada"].includes(normalized)) {
    return {
      icon: CheckCircle2,
      accentClassName: "bg-emerald-500",
      iconClassName: "text-emerald-600",
    };
  }

  if (["en_proceso", "en proceso", "iniciado", "activa", "activo", "en_ejecucion", "ejecutando"].includes(normalized)) {
    return {
      icon: PlayCircle,
      accentClassName: "bg-sky-500",
      iconClassName: "text-sky-600",
    };
  }

  if (["pendiente", "planificado", "planificada", "borrador", "planificacion"].includes(normalized)) {
    return {
      icon: Clock3,
      accentClassName: "bg-amber-500",
      iconClassName: "text-amber-600",
    };
  }

  if (["cancelado", "cancelada", "pausado", "pausada"].includes(normalized)) {
    return {
      icon: Ban,
      accentClassName: "bg-rose-500",
      iconClassName: "text-rose-600",
    };
  }

  if (["sin_estado", "sin estado"].includes(normalized)) {
    return {
      icon: PauseCircle,
      accentClassName: "bg-slate-400",
      iconClassName: "text-slate-500",
    };
  }

  return {
    icon: CircleDot,
    accentClassName: "bg-slate-500",
    iconClassName: "text-slate-600",
  };
};

export const useDashboardMainPanel = ({
  selectorData,
  selectedEstado,
  selectedAlertKey,
  detailData,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  alertItems,
  onSelectEstado,
  onSelectAlert,
  onOpenProject,
  onNavigate,
}: UseDashboardMainPanelParams): DashboardMainPanelViewModel => ({
  statusCards: Object.entries(selectorData?.por_estado ?? {})
    .sort((left, right) => left[0].localeCompare(right[0], "es"))
    .map(([estado, count]) => {
      const visuals = getEstadoVisuals(estado);
      return {
        key: estado,
        title: getProyectoEstadoLabel(estado),
        count,
        ...visuals,
        selected: !selectedAlertKey && selectedEstado === estado,
        onSelect: () => onSelectEstado(estado),
      };
    }),
  detailItems: (detailData?.data ?? []).map((item) => ({
    key: `${item.proyecto?.id}-${item.fecha_creacion}`,
    item,
    onClick: () => onOpenProject(item),
  })),
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  alerts: alertItems.map((alert) => ({
    ...alert,
    selected: selectedAlertKey === alert.key,
    onSelect: () => onSelectAlert(alert.key),
  })),
  quickActions: [
    {
      key: "crear-proyecto",
      label: "Crear proyecto",
      icon: Plus,
      onClick: () => onNavigate("/proyectos/create"),
    },
    {
      key: "proyectos",
      label: "Proyectos",
      icon: Kanban,
      onClick: () => onNavigate("/proyectos"),
    },
    {
      key: "compras",
      label: "Compras",
      icon: ShoppingCart,
      onClick: () => onNavigate("/po-dashboard"),
    },
  ],
  totalProjects: selectedAlertKey || selectedEstado !== "todos"
    ? detailData?.total ?? 0
    : selectorData?.total ?? detailData?.total ?? 0,
  listTitle: selectedAlertKey ? ALERT_LIST_TITLES[selectedAlertKey] : "Proyectos",
});
