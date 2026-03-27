import type {
  PoDashboardAlertKey,
  PoDashboardDetalleItem,
  PoDashboardDetalleResponse,
  PoDashboardFilters,
  PoDashboardKpiKey,
  PoDashboardResponse,
  PoOrderLite,
  PeriodType,
  SelectOption,
} from "./model";

export const SHOW_KPIS_STORAGE_KEY = "po-dashboard:show-kpis";
export const DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "po-dashboard:snapshot:";

export type DashboardCatalogItem = {
  id?: string | number;
  codigo?: string | null;
  nombre?: string | null;
};

export type DashboardPatchedRecord = PoOrderLite & {
  id: string | number;
};

type DashboardComparableRecord = {
  id: string | number;
  estado: string | null;
  monto: number | null;
  fecha_estado: string | null;
  proveedor_id: string | null;
  solicitante_id: string | null;
  titulo: string | null;
};

export type DashboardRefreshDecision = {
  refreshLine: boolean;
  refreshList: boolean;
  refreshSelector: boolean;
  refreshKpis: boolean;
};

export type DashboardAlertItemCheckResponse = {
  id: number;
  alertKey: PoDashboardAlertKey;
  hasAlert: boolean;
};

export type PoDashboardSnapshot = {
  savedAt: number;
  periodType: PeriodType;
  filters: PoDashboardFilters;
  dashboardData: PoDashboardResponse | null;
  previousPeriodData: PoDashboardResponse | null;
  periodTrendData: Array<{ label: string; amount: number; count: number }>;
  detailKpi: PoDashboardKpiKey;
  detailData: PoDashboardDetalleResponse | null;
  detailPage: number;
  selectedAlertKey: PoDashboardAlertKey | null;
  fastSelectorData: Record<PoDashboardKpiKey, { count: number; amount: number }> | null;
  showAdditionalFilters: boolean;
  solicitanteOptions: SelectOption[];
  proveedorOptions: SelectOption[];
  tipoSolicitudOptions: SelectOption[];
  departamentoOptions: SelectOption[];
  tipoCompraOptions: SelectOption[];
};

export const getDashboardRequestKey = (
  periodType: PeriodType,
  filters: PoDashboardFilters,
) => JSON.stringify({ periodType, filters });

export const getDetailRequestKey = ({
  filters,
  detailKpi,
  detailPage,
  selectedAlertKey,
}: {
  filters: PoDashboardFilters;
  detailKpi: PoDashboardKpiKey;
  detailPage: number;
  selectedAlertKey: PoDashboardAlertKey | null;
}) =>
  JSON.stringify({
    filters,
    detailKpi,
    detailPage,
    selectedAlertKey,
  });

export const getDashboardSnapshotStorageKey = (returnTo: string) =>
  `${DASHBOARD_SNAPSHOT_STORAGE_PREFIX}${returnTo}`;

export const loadDashboardSnapshot = (
  returnTo: string,
  enabled: boolean,
  ttlMs: number,
): PoDashboardSnapshot | null => {
  if (!enabled || typeof window === "undefined") return null;

  try {
    const storageKey = getDashboardSnapshotStorageKey(returnTo);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PoDashboardSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(getDashboardSnapshotStorageKey(returnTo));
    return null;
  }
};

export const saveDashboardSnapshot = (
  returnTo: string,
  snapshot: PoDashboardSnapshot,
) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getDashboardSnapshotStorageKey(returnTo),
    JSON.stringify(snapshot),
  );
};

const normalizeComparableValue = (
  field: keyof Omit<DashboardComparableRecord, "id">,
  value: unknown,
) => {
  if (value === "" || value === undefined) return null;
  if (field === "fecha_estado") {
    return value == null ? null : String(value).slice(0, 10);
  }
  if (field === "monto") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (field === "proveedor_id" || field === "solicitante_id") {
    return value == null ? null : String(value);
  }
  return value == null ? null : String(value);
};

export const buildComparableRecordFromOrder = (
  order: PoOrderLite | null | undefined,
): DashboardComparableRecord | null => {
  if (order?.id == null) return null;

  return {
    id: order.id,
    estado: normalizeComparableValue("estado", order.order_status?.nombre) as string | null,
    monto: normalizeComparableValue("monto", order.total) as number | null,
    fecha_estado: normalizeComparableValue("fecha_estado", order.updated_at) as string | null,
    proveedor_id: normalizeComparableValue("proveedor_id", order.proveedor_id) as string | null,
    solicitante_id: normalizeComparableValue(
      "solicitante_id",
      order.solicitante_id,
    ) as string | null,
    titulo: normalizeComparableValue("titulo", order.titulo) as string | null,
  };
};

export const buildComparableRecordFromDetailItem = (
  item: PoDashboardDetalleItem | undefined,
): DashboardComparableRecord | null => {
  if (!item?.order?.id) return null;

  return {
    id: item.order.id,
    estado: normalizeComparableValue(
      "estado",
      item.order.order_status?.nombre ?? item.estado,
    ) as string | null,
    monto: normalizeComparableValue("monto", item.order.total ?? item.monto) as number | null,
    fecha_estado: normalizeComparableValue(
      "fecha_estado",
      item.order.updated_at ?? item.fecha_estado,
    ) as string | null,
    proveedor_id: normalizeComparableValue(
      "proveedor_id",
      item.order.proveedor_id,
    ) as string | null,
    solicitante_id: normalizeComparableValue(
      "solicitante_id",
      item.order.solicitante_id,
    ) as string | null,
    titulo: normalizeComparableValue("titulo", item.order.titulo) as string | null,
  };
};

export const evaluateDashboardRefresh = (
  previousRecord: DashboardComparableRecord | null,
  nextRecord: DashboardComparableRecord | null,
): DashboardRefreshDecision => {
  if (!previousRecord || !nextRecord) {
    return {
      refreshLine: false,
      refreshList: true,
      refreshSelector: true,
      refreshKpis: true,
    };
  }

  const estadoChanged = previousRecord.estado !== nextRecord.estado;
  const montoChanged = previousRecord.monto !== nextRecord.monto;
  const visibleFieldChanged =
    montoChanged ||
    estadoChanged ||
    previousRecord.fecha_estado !== nextRecord.fecha_estado ||
    previousRecord.proveedor_id !== nextRecord.proveedor_id ||
    previousRecord.solicitante_id !== nextRecord.solicitante_id ||
    previousRecord.titulo !== nextRecord.titulo;

  return {
    refreshLine: visibleFieldChanged,
    refreshList: estadoChanged,
    refreshSelector: estadoChanged || montoChanged,
    refreshKpis: estadoChanged || montoChanged,
  };
};

export const getStoredShowKpis = () => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SHOW_KPIS_STORAGE_KEY);
  if (stored == null) return true;
  return stored !== "false";
};

export const idsMatch = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) => left != null && right != null && String(left) === String(right);

export const buildAuthenticatedHeaders = () => {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

export const fetchJsonWithAuth = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: buildAuthenticatedHeaders(),
  });
  const rawBody = await response.text();

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as {
          detail?: unknown;
          message?: string;
        };
        const detail =
          typeof parsed?.detail === "string"
            ? parsed.detail
            : typeof parsed?.message === "string"
              ? parsed.message
              : rawBody;
        if (detail) message = `${message}: ${detail}`;
      } catch {
        message = `${message}: ${rawBody}`;
      }
    }
    throw new Error(message);
  }

  return JSON.parse(rawBody) as T;
};

export const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeStatus = (error as { status?: unknown }).status;
  if (maybeStatus === 404) return true;
  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === "string" && maybeMessage.includes("404");
};
