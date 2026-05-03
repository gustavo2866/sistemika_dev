import { Kanban, Plus, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  AlertKey,
  ProyDashboardAlertItem,
  ProyDashboardDetalleItem,
  ProyDashboardDetalleResponse,
  ProyDashboardSelectorsResponse,
} from "../../model";
import { getProyDashboardEstadoVisuals } from "../../model";
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
  detailTitle: string;
  detailEmptyMessage: string;
};

type UseDashboardMainPanelParams = {
  selectorData: ProyDashboardSelectorsResponse | null;
  activeSelectorKey: string | null;
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
  createProjectPath?: string;
  projectListPath?: string;
};

const ALERT_LIST_TITLES: Record<AlertKey, string> = {
  ordenes_rechazadas: "Proyectos con ordenes rechazadas",
  mensajes: "Proyectos con mensajes nuevos",
  eventos: "Proyectos con tareas vencidas",
};

const getDetailTitle = (
  activeSelectorKey: string | null,
  selectedAlertKey: AlertKey | null,
) => {
  if (selectedAlertKey) return ALERT_LIST_TITLES[selectedAlertKey];
  if (activeSelectorKey) return getProyectoEstadoLabel(activeSelectorKey);
  return "Proyectos";
};

const getDetailEmptyMessage = (
  activeSelectorKey: string | null,
  selectedAlertKey: AlertKey | null,
) => {
  if (!activeSelectorKey && !selectedAlertKey) {
    return "Selecciona un estado o una alarma para ver proyectos.";
  }
  return "No hay proyectos para mostrar en este corte.";
};

export const useDashboardMainPanel = ({
  selectorData,
  activeSelectorKey,
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
  createProjectPath = "/proyectos/create",
  projectListPath = "/proyectos",
}: UseDashboardMainPanelParams): DashboardMainPanelViewModel => ({
  statusCards: Object.entries(selectorData?.por_estado ?? {})
    .sort((left, right) => left[0].localeCompare(right[0], "es"))
    .map(([estado, count]) => {
      const visuals = getProyDashboardEstadoVisuals(estado);
      return {
        key: estado,
        title: getProyectoEstadoLabel(estado),
        count,
        ...visuals,
        selected: !selectedAlertKey && activeSelectorKey === estado,
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
      onClick: () => onNavigate(createProjectPath),
    },
    {
      key: "proyectos",
      label: "Proyectos",
      icon: Kanban,
      onClick: () => onNavigate(projectListPath),
    },
    {
      key: "compras",
      label: "Compras",
      icon: ShoppingCart,
      onClick: () => onNavigate("/po-dashboard"),
    },
  ],
  totalProjects: selectedAlertKey || activeSelectorKey
    ? detailData?.total ?? 0
    : selectorData?.total ?? detailData?.total ?? 0,
  detailTitle: getDetailTitle(activeSelectorKey, selectedAlertKey),
  detailEmptyMessage: getDetailEmptyMessage(activeSelectorKey, selectedAlertKey),
});
