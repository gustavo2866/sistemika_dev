import type {
  AlertKey,
  PeriodType,
  ProyDashboardDetalleResponse,
  ProyDashboardFilters,
  ProyDashboardResponse,
  ProyDashboardSelectorsResponse,
} from "./model";

export const SHOW_KPIS_STORAGE_KEY = "proy-dashboard:show-kpis";
export const DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "proy-dashboard:snapshot:";

export type DashboardCatalogItem = {
  id?: string | number;
  nombre?: string | null;
  full_name?: string | null;
};

export type ProyDashboardSnapshot = {
  savedAt: number;
  periodType: PeriodType;
  filters: ProyDashboardFilters;
  dashboardData: ProyDashboardResponse | null;
  selectorData: ProyDashboardSelectorsResponse | null;
  detailData: ProyDashboardDetalleResponse | null;
  detailPage: number;
  activeSelectorKey: string | null;
  selectedAlertKey: AlertKey | null;
};

export const getDashboardRequestKey = (
  periodType: PeriodType,
  filters: ProyDashboardFilters,
) => JSON.stringify({ periodType, filters });

export const getDetailRequestKey = ({
  filters,
  detailPage,
  selectedAlertKey,
  periodType,
}: {
  filters: ProyDashboardFilters;
  detailPage: number;
  selectedAlertKey: AlertKey | null;
  periodType: PeriodType;
}) =>
  JSON.stringify({
    filters,
    detailPage,
    selectedAlertKey,
    periodType,
  });

export const getDashboardSnapshotStorageKey = (returnTo: string) =>
  `${DASHBOARD_SNAPSHOT_STORAGE_PREFIX}${returnTo}`;

export const loadDashboardSnapshot = (
  returnTo: string,
  enabled: boolean,
  ttlMs: number,
): ProyDashboardSnapshot | null => {
  if (!enabled || typeof window === "undefined") return null;

  try {
    const storageKey = getDashboardSnapshotStorageKey(returnTo);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ProyDashboardSnapshot;
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
  snapshot: ProyDashboardSnapshot,
) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getDashboardSnapshotStorageKey(returnTo),
    JSON.stringify(snapshot),
  );
};

export const getStoredShowKpis = () => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(SHOW_KPIS_STORAGE_KEY);
  if (stored == null) return false;
  return stored === "true";
};

const buildAuthenticatedHeaders = () => {
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
