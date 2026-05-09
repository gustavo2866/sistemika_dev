import { CalendarDays, Plus, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  KPI_CARDS,
  type AlertKey,
  type CrmDashboardAlertItem,
  type CrmDashboardDetalleItem,
  type CrmDashboardDetalleResponse,
  type KpiKey,
} from "../../model";

type CrmDashboardKpiData = Record<KpiKey, { count: number; amount: number }>;

export type DashboardStatusCardItem = {
  key: KpiKey;
  title: string;
  count: number;
  amount: number;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
  selected: boolean;
  onSelect: () => void;
};

export type DashboardDetailItem = {
  key: string;
  item: CrmDashboardDetalleItem;
  onClick: () => void;
};

export type DashboardAlertItemViewModel = CrmDashboardAlertItem & {
  selected: boolean;
  onSelect: () => void;
};

export type DashboardQuickActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

export type DashboardMainPanelViewModel = {
  statusCards: DashboardStatusCardItem[];
  detailItems: DashboardDetailItem[];
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alerts: DashboardAlertItemViewModel[];
  quickActions: DashboardQuickActionItem[];
  detailTitle: string;
  detailEmptyMessage: string;
};

const KPI_ACCENT_CLASSES: Record<KpiKey, string> = {
  prospect: "bg-slate-500",
  proceso: "bg-amber-500",
  reserva: "bg-violet-500",
  cerrada: "bg-emerald-500",
};

const KPI_ICON_CLASSES: Record<KpiKey, string> = {
  prospect: "text-slate-600",
  proceso: "text-amber-600",
  reserva: "text-violet-600",
  cerrada: "text-emerald-600",
};

type UseDashboardMainPanelParams = {
  selectorData?: Partial<CrmDashboardKpiData> | null;
  detailKpi: KpiKey;
  selectedAlertKey: AlertKey | null;
  detailData: CrmDashboardDetalleResponse | null;
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alertItems: CrmDashboardAlertItem[];
  onSelectAlert: (key: AlertKey) => void;
  onSelectStatusCard: (key: KpiKey) => void;
  onOpenOpportunity: (item: CrmDashboardDetalleItem) => void;
  onNavigate: (path: string) => void;
  createOpportunityPath?: string;
};

const getKpiTitle = (key: KpiKey) =>
  KPI_CARDS.find((card) => card.key === key)?.title ?? "Oportunidades";

const getDetailTitle = (
  detailKpi: KpiKey,
  selectedAlertKey: AlertKey | null,
  alertItems: CrmDashboardAlertItem[],
) => {
  if (selectedAlertKey) {
    const alertLabel = alertItems.find((alert) => alert.key === selectedAlertKey)?.label;
    return alertLabel ? `Oportunidades / ${alertLabel}` : "Oportunidades";
  }
  return `Oportunidades / ${getKpiTitle(detailKpi)}`;
};

const getDetailEmptyMessage = (
  detailKpi: KpiKey,
  selectedAlertKey: AlertKey | null,
  alertItems: CrmDashboardAlertItem[],
) => {
  if (selectedAlertKey) {
    const alertLabel = alertItems.find((alert) => alert.key === selectedAlertKey)?.label;
    return alertLabel
      ? `No hay oportunidades para la alarma ${alertLabel}.`
      : "No hay oportunidades para esta alarma.";
  }
  return `No hay oportunidades en ${getKpiTitle(detailKpi)}.`;
};

export const useDashboardMainPanel = ({
  selectorData,
  detailKpi,
  selectedAlertKey,
  detailData,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  alertItems,
  onSelectAlert,
  onSelectStatusCard,
  onOpenOpportunity,
  onNavigate,
  createOpportunityPath = "/crm/oportunidades/create",
}: UseDashboardMainPanelParams): DashboardMainPanelViewModel => ({
  statusCards: KPI_CARDS.map((card) => {
    const kpi = selectorData?.[card.key] ?? { count: 0, amount: 0 };
    return {
      key: card.key,
      title: card.title,
      count: kpi.count,
      amount: kpi.amount,
      icon: card.icon,
      accentClassName: KPI_ACCENT_CLASSES[card.key],
      iconClassName: KPI_ICON_CLASSES[card.key],
      selected: !selectedAlertKey && detailKpi === card.key,
      onSelect: () => onSelectStatusCard(card.key),
    };
  }),
  detailItems: (detailData?.data ?? []).map((item) => ({
    key: `${item.oportunidad?.id}-${item.fecha_creacion}`,
    item,
    onClick: () => onOpenOpportunity(item),
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
      key: "nueva-oportunidad",
      label: "Nueva oportunidad",
      icon: Plus,
      onClick: () => onNavigate(createOpportunityPath),
    },
    {
      key: "oportunidades",
      label: "Oportunidades",
      icon: Target,
      onClick: () => onNavigate("/crm/oportunidades"),
    },
    {
      key: "eventos",
      label: "Eventos",
      icon: CalendarDays,
      onClick: () => onNavigate("/crm/crm-eventos"),
    },
    {
      key: "contactos",
      label: "Contactos",
      icon: Users,
      onClick: () => onNavigate("/crm/contactos"),
    },
  ],
  detailTitle: getDetailTitle(detailKpi, selectedAlertKey, alertItems),
  detailEmptyMessage: getDetailEmptyMessage(detailKpi, selectedAlertKey, alertItems),
});
