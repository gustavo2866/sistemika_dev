"use client";

const HOME_DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "home-dashboard:snapshot:";

export const HOME_DASHBOARD_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type HomeDashboardSnapshot<TBundle> = {
  savedAt: number;
  bundle: TBundle;
};

const getHomeDashboardSnapshotStorageKey = (returnTo: string) =>
  `${HOME_DASHBOARD_SNAPSHOT_STORAGE_PREFIX}${returnTo}`;

export const loadHomeDashboardSnapshot = <TBundle>(
  returnTo: string,
  ttlMs: number = HOME_DASHBOARD_SNAPSHOT_TTL_MS,
): HomeDashboardSnapshot<TBundle> | null => {
  if (typeof window === "undefined") return null;

  const storageKey = getHomeDashboardSnapshotStorageKey(returnTo);
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HomeDashboardSnapshot<TBundle>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
};

export const saveHomeDashboardSnapshot = <TBundle>(
  returnTo: string,
  snapshot: HomeDashboardSnapshot<TBundle>,
) => {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    getHomeDashboardSnapshotStorageKey(returnTo),
    JSON.stringify(snapshot),
  );
};

export const clearHomeDashboardSnapshot = (returnTo: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getHomeDashboardSnapshotStorageKey(returnTo));
};
