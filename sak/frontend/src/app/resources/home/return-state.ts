"use client";

const HOME_DASHBOARD_RETURN_MARKER_PREFIX = "home-dashboard:return:";

export const HOME_DASHBOARD_RETURN_TTL_MS = 5 * 60 * 1000;

export type HomeDashboardPartialKey = "miDia" | "radar" | "summary";

export type HomeDashboardReturnMarker = {
  savedAt: number;
  refreshAll?: boolean;
  refreshKeys?: HomeDashboardPartialKey[];
};

const getHomeDashboardReturnMarkerStorageKey = (returnTo: string) =>
  `${HOME_DASHBOARD_RETURN_MARKER_PREFIX}${returnTo}`;

export const normalizeHomeDashboardRefreshKeys = (
  keys?: HomeDashboardPartialKey[],
) => Array.from(new Set((keys ?? []).filter(Boolean)));

export const saveHomeDashboardReturnMarker = (
  returnTo: string,
  marker: HomeDashboardReturnMarker,
) => {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    getHomeDashboardReturnMarkerStorageKey(returnTo),
    JSON.stringify({
      ...marker,
      refreshKeys: normalizeHomeDashboardRefreshKeys(marker.refreshKeys),
    }),
  );
};

export const loadHomeDashboardReturnMarker = (
  returnTo: string,
  ttlMs: number = HOME_DASHBOARD_RETURN_TTL_MS,
): HomeDashboardReturnMarker | null => {
  if (typeof window === "undefined") return null;

  const storageKey = getHomeDashboardReturnMarkerStorageKey(returnTo);
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HomeDashboardReturnMarker;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return {
      ...parsed,
      refreshKeys: normalizeHomeDashboardRefreshKeys(parsed.refreshKeys),
    };
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
};

export const clearHomeDashboardReturnMarker = (returnTo: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getHomeDashboardReturnMarkerStorageKey(returnTo));
};
