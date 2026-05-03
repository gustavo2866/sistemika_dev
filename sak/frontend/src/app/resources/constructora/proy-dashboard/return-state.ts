"use client";

import type { AlertKey, PeriodType, ProyDashboardFilters } from "./model";

const DASHBOARD_RETURN_MARKER_PREFIX = "proy-dashboard:return:";

export const DASHBOARD_RETURN_TTL_MS = 5 * 60 * 1000;

export type ProyDashboardReturnMarker = {
  savedAt: number;
  filters?: ProyDashboardFilters;
  periodType?: PeriodType;
  showKpis?: boolean;
  activeSelectorKey?: string | null;
  selectedAlertKey?: AlertKey | null;
};

const getDashboardReturnMarkerStorageKey = (returnTo: string) =>
  `${DASHBOARD_RETURN_MARKER_PREFIX}${returnTo}`;

export const saveDashboardReturnMarker = (
  returnTo: string,
  marker: ProyDashboardReturnMarker,
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
): ProyDashboardReturnMarker | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(getDashboardReturnMarkerStorageKey(returnTo));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ProyDashboardReturnMarker;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
    return null;
  }
};

export const clearDashboardReturnMarker = (returnTo: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getDashboardReturnMarkerStorageKey(returnTo));
};
