"use client";

import type {
  PeriodType,
  PropDashboardAlertKey,
  PropDashboardFilters,
  PropDashboardSelectorKey,
} from "./model";

const DASHBOARD_RETURN_MARKER_PREFIX = "propiedades-dashboard:return:";

export const DASHBOARD_RETURN_TTL_MS = 5 * 60 * 1000;

export type PropDashboardReturnMarker = {
  savedAt: number;
  propiedadId?: string | number | null;
  refreshAll?: boolean;
  filters?: PropDashboardFilters;
  periodType?: PeriodType;
  activeSelectorKey?: PropDashboardSelectorKey | null;
  activeSubBucket?: string | null;
  activeAlertKey?: PropDashboardAlertKey | null;
};

const getDashboardReturnMarkerStorageKey = (returnTo: string) =>
  `${DASHBOARD_RETURN_MARKER_PREFIX}${returnTo}`;

export const saveDashboardReturnMarker = (
  returnTo: string,
  marker: PropDashboardReturnMarker,
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
): PropDashboardReturnMarker | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(getDashboardReturnMarkerStorageKey(returnTo));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PropDashboardReturnMarker;
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
