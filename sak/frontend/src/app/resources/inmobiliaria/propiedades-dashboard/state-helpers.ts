import type {
  PeriodType,
  PropDashboardAlertKey,
  PropDashboardCurrentData,
  PropDashboardDetalleResponse,
  PropDashboardFilters,
  PropDashboardResponse,
  PropDashboardSelectorKey,
  PropDashboardSelectorResponse,
} from "./model";

export const SHOW_KPIS_STORAGE_KEY = "propiedades-dashboard:show-kpis";
export const DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "propiedades-dashboard:snapshot:";

export type DashboardCatalogItem = {
  id?: string | number;
  codigo?: string | null;
  nombre?: string | null;
  name?: string | null;
};

export type PropDashboardSnapshot = {
  savedAt: number;
  periodType: PeriodType;
  filters: PropDashboardFilters;
  dashboardData: PropDashboardCurrentData | null;
  previousPeriodData: PropDashboardResponse | null;
  periodTrendData: Array<{
    label: string;
    total: number;
    countVacantes: number;
  }>;
  activeSelectorKey: PropDashboardSelectorKey | null;
  activeSubBucket: string | null;
  activeAlertKey: PropDashboardAlertKey | null;
  detailData: PropDashboardDetalleResponse | null;
  detailPage: number;
  fastSelectorData: PropDashboardSelectorResponse | null;
};

export const getDashboardRequestKey = (
  periodType: PeriodType,
  filters: PropDashboardFilters,
) => JSON.stringify({ periodType, filters });

export const getDetailRequestKey = ({
  filters,
  activeSelectorKey,
  activeSubBucket,
  detailPage,
  activeAlertKey,
}: {
  filters: PropDashboardFilters;
  activeSelectorKey: PropDashboardSelectorKey | null;
  activeSubBucket: string | null;
  detailPage: number;
  activeAlertKey: PropDashboardAlertKey | null;
}) =>
  JSON.stringify({
    filters,
    activeSelectorKey,
    activeSubBucket,
    detailPage,
    activeAlertKey,
  });

export const getDashboardSnapshotStorageKey = (returnTo: string) =>
  `${DASHBOARD_SNAPSHOT_STORAGE_PREFIX}${returnTo}`;

export const loadDashboardSnapshot = (
  returnTo: string,
  enabled: boolean,
  ttlMs: number,
): PropDashboardSnapshot | null => {
  if (!enabled || typeof window === "undefined") return null;

  try {
    const storageKey = getDashboardSnapshotStorageKey(returnTo);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PropDashboardSnapshot;
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
  snapshot: PropDashboardSnapshot,
) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getDashboardSnapshotStorageKey(returnTo),
    JSON.stringify(snapshot),
  );
};

export const getStoredShowKpis = () => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SHOW_KPIS_STORAGE_KEY);
  if (stored == null) return true;
  return stored !== "false";
};

export const buildAuthenticatedHeaders = () => {
  const headers = new Headers();

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
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
