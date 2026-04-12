import {
  FilePlus2,
  ClipboardCheck,
  ClipboardList,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  PO_DASHBOARD_KPI_CARDS,
  type PoDashboardAlertItem,
  type PoDashboardAlertKey,
  type PoDashboardDetalleItem,
  type PoDashboardDetalleResponse,
  type PoDashboardKpiKey,
} from "../../model";

type PoDashboardKpiData = Record<PoDashboardKpiKey, { count: number; amount: number }>;

export type DashboardStatusCardItem = {
  key: PoDashboardKpiKey;
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
  item: PoDashboardDetalleItem;
  onClick: () => void;
};

export type DashboardAlertItemViewModel = PoDashboardAlertItem & {
  selected: boolean;
  onSelect: () => void;
};

export type DashboardQuickActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  createTo?: string;
  onNavigate?: (path: string) => void;
};

export type DashboardMainPanelViewModel = {
  statusCards: DashboardStatusCardItem[];
  detailItems: DashboardDetailItem[];
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alerts: DashboardAlertItemViewModel[];
  quickActions: DashboardQuickActionItem[];
};

const KPI_ACCENT_CLASSES: Record<PoDashboardKpiKey, string> = {
  pendientes: "bg-slate-500",
  solicitadas: "bg-amber-500",
  emitidas: "bg-sky-500",
  en_proceso: "bg-emerald-500",
  facturadas: "bg-violet-500",
};

const KPI_ICON_CLASSES: Record<PoDashboardKpiKey, string> = {
  pendientes: "text-slate-600",
  solicitadas: "text-amber-600",
  emitidas: "text-sky-600",
  en_proceso: "text-emerald-600",
  facturadas: "text-violet-600",
};

type UseDashboardMainPanelParams = {
  selectorData?: Partial<PoDashboardKpiData> | null;
  detailKpi: PoDashboardKpiKey;
  selectedAlertKey: PoDashboardAlertKey | null;
  detailData: PoDashboardDetalleResponse | null;
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alertItems: PoDashboardAlertItem[];
  onSelectAlert: (key: PoDashboardAlertKey) => void;
  onSelectStatusCard: (key: PoDashboardKpiKey) => void;
  onOpenOrder: (item: PoDashboardDetalleItem) => void;
  onNavigate: (path: string) => void;
  createOrderPath?: string;
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
  onOpenOrder,
  onNavigate,
  createOrderPath = "/po-orders/create",
}: UseDashboardMainPanelParams): DashboardMainPanelViewModel => ({
  statusCards: PO_DASHBOARD_KPI_CARDS.map((card) => {
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
    key: `${item.order?.id ?? "x"}-${item.fecha_creacion}`,
    item,
    onClick: () => onOpenOrder(item),
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
      key: "crear-orden",
      label: "Crear Orden",
      icon: FilePlus2,
      createTo: createOrderPath,
      onNavigate,
    },
    {
      key: "crear-factura",
      label: "Crear Factura",
      icon: FilePlus2,
      onClick: () => onNavigate("/po-invoices/create"),
    },
    {
      key: "aprobaciones",
      label: "Aprobaciones",
      icon: ClipboardCheck,
      onClick: () => onNavigate("/po-orders-approval"),
    },
    {
      key: "ordenes",
      label: "Ordenes",
      icon: ClipboardList,
      onClick: () => onNavigate("/po-orders"),
    },
    {
      key: "facturas",
      label: "Facturas",
      icon: Receipt,
      onClick: () => onNavigate("/po-invoices"),
    },
  ],
});
