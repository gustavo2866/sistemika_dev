"use client";

const DASHBOARD_RETURN_MARKER_PREFIX = "po-dashboard:return:";

export const DASHBOARD_RETURN_TTL_MS = 5 * 60 * 1000;

export type PoDashboardReturnMarker = {
  savedAt: number;
  orderId?: string | number | null;
  refreshAll?: boolean;
  deleted?: boolean;
};

const getDashboardReturnMarkerStorageKey = (returnTo: string) =>
  `${DASHBOARD_RETURN_MARKER_PREFIX}${returnTo}`;

export const saveDashboardReturnMarker = (
  returnTo: string,
  marker: PoDashboardReturnMarker,
) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getDashboardReturnMarkerStorageKey(returnTo),
    JSON.stringify(marker),
  );
};

export const loadDashboardReturnMarker = (
  returnTo: string,
  ttlMs: number = DASHBOARD_RETURN_TTL_MS,
): PoDashboardReturnMarker | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(
    getDashboardReturnMarkerStorageKey(returnTo),
  );
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PoDashboardReturnMarker;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
      return null;
    }
    return parsed;
  } catch {
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > ttlMs) {
      window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
      return null;
    }
    return { savedAt: timestamp };
  }
};

export const clearDashboardReturnMarker = (returnTo: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
};
