import { Home, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  SELECTOR_CARDS,
  getSelectorCardMeta,
  type PropDashboardAlertItem,
  type PropDashboardAlertKey,
  type PropDashboardDetalleItem,
  type PropDashboardDetalleResponse,
  type PropDashboardSelectorKey,
  type PropDashboardSelectorResponse,
} from "../../model";

export type DashboardStatusBucketItem = {
  key: string;
  label: string;
  count: number;
  tone: "danger" | "warning" | "muted";
  selected: boolean;
  onSelect: () => void;
};

export type DashboardStatusCardItem = {
  key: PropDashboardSelectorKey;
  title: string;
  count: number;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
  selected: boolean;
  onSelect: () => void;
  buckets: DashboardStatusBucketItem[];
};

export type DashboardDetailItem = {
  key: string;
  item: PropDashboardDetalleItem;
  onClick: () => void;
};

export type DashboardAlertItemViewModel = PropDashboardAlertItem & {
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
  showContratoColumn: boolean;
  valueColumnLabel: string;
};

type UseDashboardMainPanelParams = {
  selectorData?: PropDashboardSelectorResponse | null;
  activeSelectorKey: PropDashboardSelectorKey | null;
  activeSubBucket: string | null;
  selectedAlertKey: PropDashboardAlertKey | null;
  detailData: PropDashboardDetalleResponse | null;
  detailLoading: boolean;
  hasMoreDetail: boolean;
  onLoadMore: () => void;
  alertItems: PropDashboardAlertItem[];
  onSelectAlert: (key: PropDashboardAlertKey) => void;
  onSelectStatusCard: (key: PropDashboardSelectorKey, subBucket?: string | null) => void;
  onOpenProperty: (item: PropDashboardDetalleItem) => void;
  onNavigate: (path: string) => void;
  createPropertyPath?: string;
  propertyListPath?: string;
  selectedTipoOperacionLabel?: string | null;
};

const getBucketTone = (value: "danger" | "warning" | "muted") => value;

const getDetailTitle = (
  activeSelectorKey: PropDashboardSelectorKey | null,
  activeSubBucket: string | null,
  selectedAlertKey: PropDashboardAlertKey | null,
  selectedTipoOperacionLabel?: string | null,
  vacanciaDays?: number,
) => {
  if (selectedAlertKey === "vencimiento_lt_60") return "Vencimientos proximos";
  if (selectedAlertKey === "renovacion_lt_60") return "Renovaciones proximas";
  if (selectedAlertKey === "vacancia_gt_90") return `Vacancia > ${vacanciaDays ?? 90} dias`;
  if (!activeSelectorKey) return "Detalle";
  const selector = getSelectorCardMeta(activeSelectorKey);
  if (!selector) return "Detalle";
  const selectorTitle = resolveSelectorCardTitle(
    selector.key,
    selector.title,
    selectedTipoOperacionLabel,
  );
  if (!activeSubBucket) return selectorTitle;
  const bucket = selector.buckets?.find((item) => item.key === activeSubBucket);
  return bucket ? `${selectorTitle} / ${bucket.label}` : selectorTitle;
};

const getDetailEmptyMessage = (
  activeSelectorKey: PropDashboardSelectorKey | null,
  selectedAlertKey: PropDashboardAlertKey | null,
) => {
  if (!activeSelectorKey && !selectedAlertKey) {
    return "Selecciona un estado o una alarma para ver propiedades.";
  }
  return "No hay propiedades para mostrar en este corte.";
};

const isVentaTipoOperacion = (label?: string | null) =>
  label?.trim().toLowerCase().includes("venta") ?? false;

const isAlquilerTipoOperacion = (label?: string | null) =>
  label?.trim().toLowerCase().includes("alquiler") ?? false;

const shouldShowContratoColumn = ({
  activeSelectorKey,
  selectedAlertKey,
  alquilerSelected,
}: {
  activeSelectorKey: PropDashboardSelectorKey | null;
  selectedAlertKey: PropDashboardAlertKey | null;
  alquilerSelected: boolean;
}) =>
  alquilerSelected &&
  (activeSelectorKey === "realizada" ||
    (selectedAlertKey != null && selectedAlertKey !== "vacancia_gt_90"));

const resolveSelectorCardTitle = (
  key: PropDashboardSelectorKey,
  defaultTitle: string,
  selectedTipoOperacionLabel?: string | null,
) => {
  if (key === "realizada" && isAlquilerTipoOperacion(selectedTipoOperacionLabel)) {
    return "Alquilada";
  }
  return defaultTitle;
};

export const useDashboardMainPanel = ({
  selectorData,
  activeSelectorKey,
  activeSubBucket,
  selectedAlertKey,
  detailData,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  alertItems,
  onSelectAlert,
  onSelectStatusCard,
  onOpenProperty,
  onNavigate,
  createPropertyPath = "/propiedades/create",
  propertyListPath = "/propiedades",
  selectedTipoOperacionLabel,
}: UseDashboardMainPanelParams): DashboardMainPanelViewModel => {
  const ventaSelected = isVentaTipoOperacion(selectedTipoOperacionLabel);
  const alquilerSelected = isAlquilerTipoOperacion(selectedTipoOperacionLabel);

  return {
    statusCards: SELECTOR_CARDS.map((card) => {
      const selector = selectorData?.[card.key] ?? { count: 0 };
      return {
        key: card.key,
        title: resolveSelectorCardTitle(card.key, card.title, selectedTipoOperacionLabel),
        count: selector.count ?? 0,
        icon: card.icon,
        accentClassName: card.accentClassName,
        iconClassName: card.iconClassName,
        selected: !selectedAlertKey && activeSelectorKey === card.key,
        onSelect: () => onSelectStatusCard(card.key, null),
        buckets: (card.buckets ?? []).map((bucket) => ({
          key: bucket.key,
          label: bucket.label,
          count: Number(selector[bucket.key as keyof typeof selector] ?? 0),
          tone: getBucketTone(bucket.tone),
          selected:
            !selectedAlertKey &&
            activeSelectorKey === card.key &&
            activeSubBucket === bucket.key,
          onSelect: () => onSelectStatusCard(card.key, bucket.key),
        })),
      };
    }),
    detailItems: (detailData?.data ?? []).map((item) => ({
      key: `${item.propiedad_id}-${item.vacancia_fecha ?? item.vencimiento_contrato ?? "x"}`,
      item,
      onClick: () => onOpenProperty(item),
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
        key: "nueva-propiedad",
        label: "Nueva propiedad",
        icon: Plus,
        onClick: () => onNavigate(createPropertyPath),
      },
      {
        key: "propiedades",
        label: "Propiedades",
        icon: Home,
        onClick: () => onNavigate(propertyListPath),
      },
    ],
    detailTitle: getDetailTitle(
      activeSelectorKey,
      activeSubBucket,
      selectedAlertKey,
      selectedTipoOperacionLabel,
      selectorData?.alert_days?.vacancia,
    ),
    detailEmptyMessage: getDetailEmptyMessage(activeSelectorKey, selectedAlertKey),
    showContratoColumn: shouldShowContratoColumn({
      activeSelectorKey,
      selectedAlertKey,
      alquilerSelected,
    }),
    valueColumnLabel: ventaSelected ? "Precio" : "Alquiler",
  };
};
