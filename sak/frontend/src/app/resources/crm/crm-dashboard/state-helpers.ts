import type {
  AlertKey,
  CrmDashboardDetalleItem,
  CrmDashboardDetalleResponse,
  CrmDashboardFilters,
  CrmDashboardResponse,
  CrmOportunidadLite,
  KpiKey,
  PeriodType,
} from "./model";

export const SHOW_KPIS_STORAGE_KEY = "crm-dashboard:show-kpis";
export const DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "crm-dashboard:snapshot:";

export type DashboardCatalogItem = {
  id?: string | number;
  codigo?: string | null;
  nombre?: string | null;
};

export type DashboardPatchedRecord = CrmOportunidadLite & {
  id: string | number;
};

type DashboardComparableRecord = {
  id: string | number;
  estado: string | null;
  monto: number | null;
  fecha_estado: string | null;
  contacto_id: string | null;
  descripcion_estado: string | null;
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
  alertKey: AlertKey;
  hasAlert: boolean;
};

export type CrmDashboardSnapshot = {
  savedAt: number;
  periodType: PeriodType;
  filters: CrmDashboardFilters;
  dashboardData: CrmDashboardResponse | null;
  previousPeriodData: CrmDashboardResponse | null;
  periodTrendData: Array<{ label: string; total: number; nuevas: number; ganadas: number }>;
  detailKpi: KpiKey;
  detailData: CrmDashboardDetalleResponse | null;
  detailPage: number;
  selectedAlertKey: AlertKey | null;
  fastSelectorData: Record<KpiKey, { count: number; amount: number }> | null;
};

export const getDashboardRequestKey = (
  periodType: PeriodType,
  filters: CrmDashboardFilters,
) => JSON.stringify({ periodType, filters });

export const getDetailRequestKey = ({
  filters,
  detailKpi,
  detailPage,
  selectedAlertKey,
}: {
  filters: CrmDashboardFilters;
  detailKpi: KpiKey;
  detailPage: number;
  selectedAlertKey: AlertKey | null;
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
): CrmDashboardSnapshot | null => {
  if (!enabled || typeof window === "undefined") return null;

  try {
    const storageKey = getDashboardSnapshotStorageKey(returnTo);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CrmDashboardSnapshot;
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
  snapshot: CrmDashboardSnapshot,
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
  if (field === "contacto_id") {
    return value == null ? null : String(value);
  }
  return value == null ? null : String(value);
};

export const buildComparableRecordFromOportunidad = (
  oportunidad: CrmOportunidadLite | null | undefined,
): DashboardComparableRecord | null => {
  if (oportunidad?.id == null) return null;

  return {
    id: oportunidad.id,
    estado: normalizeComparableValue("estado", oportunidad.estado) as string | null,
    monto: normalizeComparableValue("monto", oportunidad.monto) as number | null,
    fecha_estado: normalizeComparableValue(
      "fecha_estado",
      oportunidad.fecha_estado,
    ) as string | null,
    contacto_id: normalizeComparableValue(
      "contacto_id",
      oportunidad.contacto_id,
    ) as string | null,
    descripcion_estado: normalizeComparableValue(
      "descripcion_estado",
      oportunidad.descripcion_estado,
    ) as string | null,
    titulo: normalizeComparableValue("titulo", oportunidad.titulo) as string | null,
  };
};

export const buildComparableRecordFromDetailItem = (
  item: CrmDashboardDetalleItem | undefined,
): DashboardComparableRecord | null => {
  if (!item?.oportunidad?.id) return null;

  return {
    id: item.oportunidad.id,
    estado: normalizeComparableValue(
      "estado",
      item.oportunidad.estado ?? item.estado_al_corte,
    ) as string | null,
    monto: normalizeComparableValue(
      "monto",
      item.oportunidad.monto ?? item.monto,
    ) as number | null,
    fecha_estado: normalizeComparableValue(
      "fecha_estado",
      item.oportunidad.fecha_estado,
    ) as string | null,
    contacto_id: normalizeComparableValue(
      "contacto_id",
      item.oportunidad.contacto_id,
    ) as string | null,
    descripcion_estado: normalizeComparableValue(
      "descripcion_estado",
      item.oportunidad.descripcion_estado,
    ) as string | null,
    titulo: normalizeComparableValue("titulo", item.oportunidad.titulo) as string | null,
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
    previousRecord.contacto_id !== nextRecord.contacto_id ||
    previousRecord.descripcion_estado !== nextRecord.descripcion_estado ||
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
    } else if (response.status === 422 && url.includes("/api/dashboard/crm/detalle")) {
      message =
        "Error HTTP 422: el backend desplegado no coincide con el contrato actual del detalle CRM dashboard";
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
