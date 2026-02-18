import simpleRestProvider from "ra-data-simple-rest";
import { DataProvider, fetchUtils } from "ra-core";
import { toast } from "sonner";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const httpClient: typeof fetchUtils.fetchJson = (url, options = {}) => {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetchUtils.fetchJson(url, { ...options, headers });
};

const baseProvider = simpleRestProvider(apiUrl, httpClient);

const FIELD_LABELS: Record<string, string> = {
  centro_costo_id: "Centro de costo",
  oportunidad_id: "Oportunidad",
  solicitante_id: "Solicitante",
  proveedor_id: "Proveedor",
  tipo_solicitud_id: "Tipo de solicitud",
  departamento_id: "Departamento",
  fecha_necesidad: "Fecha de necesidad",
  titulo: "Titulo",
};

const formatFieldLabel = (field: string) => {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .replace(/_id$/i, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
};

const extractErrorMessage = (error: unknown) => {
  const err = error as {
    body?: {
      detail?: {
        error?: { message?: string };
        message?: string;
      };
    };
    message?: string;
  };

  const rawMessage =
    err?.body?.detail?.error?.message ||
    err?.body?.detail?.message ||
    err?.message ||
    "Error inesperado";

  const notNullMatch = /null value in column "([^"]+)"/i.exec(rawMessage);
  if (notNullMatch?.[1]) {
    const label = formatFieldLabel(notNullMatch[1]);
    return `El campo ${label} es obligatorio.`;
  }

  return rawMessage;
};

const withErrorHandling =
  <T extends (...args: any[]) => Promise<any>>(fn: T): T =>
  (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      toast.error(extractErrorMessage(error));
      throw error;
    }
  }) as T;

const normalizeIdValue = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  if (value === 0 || value === "0") return null;
  return value;
};

const isIdKey = (key: string) =>
  key !== "id" && (key.endsWith("_id") || key.startsWith("id_"));

const sanitizeIdsInData = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeIdsInData(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      const sanitized = sanitizeIdsInData(val);
      acc[key] = isIdKey(key) ? normalizeIdValue(sanitized) : sanitized;
      return acc;
    }, {});
  }
  return value;
};

const RESOURCE_ALIASES: Record<string, string> = {
  "propiedades-inmobiliaria": "propiedades",
};

const resolveResource = (resource: string) => RESOURCE_ALIASES[resource] ?? resource;

export const dataProvider: DataProvider = {
  ...baseProvider,
  getList: withErrorHandling((resource, params) => {
    const resolved = resolveResource(resource);
    if (resolved === "crm/eventos" && params?.filter && "default_scope" in params.filter) {
      const { default_scope, ...restFilter } = params.filter as Record<string, unknown>;
      return baseProvider.getList("crm/eventos/default", { ...params, filter: restFilter });
    }
    return baseProvider.getList(resolved, params);
  }),
  getOne: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource);
    const meta = params?.meta as { include?: string | string[]; embed?: unknown } | undefined;
    const include = meta?.include;
    const embed = meta?.embed;
    if (include || embed) {
      const query = new URLSearchParams();
      if (include) {
        query.set("include", Array.isArray(include) ? include.join(",") : include);
      }
      if (embed) {
        query.set("embed", JSON.stringify(embed));
      }
      const qs = query.toString();
      const url = `${apiUrl}/${resolved}/${encodeURIComponent(params.id)}${qs ? `?${qs}` : ""}`;
      const { json } = await httpClient(url, { signal: params?.signal });
      return { data: json };
    }
    return baseProvider.getOne(resolved, params);
  }),
  getMany: withErrorHandling((resource, params) => baseProvider.getMany(resolveResource(resource), params)),
  getManyReference: withErrorHandling((resource, params) =>
    baseProvider.getManyReference(resolveResource(resource), params)
  ),
  create: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource);
    if (typeof window !== "undefined") {
      console.log("[dataProvider] create", resolved, params);
    }
    const dataWithoutId = { ...(params.data as Record<string, unknown>) };
    if ("id" in dataWithoutId) {
      delete dataWithoutId.id;
    }
    const sanitized = sanitizeIdsInData(dataWithoutId);
    return baseProvider.create(resolved, { ...params, data: sanitized });
  }),
  update: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource);
    if (typeof window !== "undefined") {
      console.log("[dataProvider] update", resolved, params);
    }
    const sanitized = sanitizeIdsInData(params.data);
    const response = await baseProvider.update(resolved, { ...params, data: sanitized });
    if (typeof window !== "undefined") {
      console.log("[dataProvider] update response", resolved, response);
    }
    return response;
  }),
  updateMany: withErrorHandling((resource, params) =>
    baseProvider.updateMany(resolveResource(resource), params)
  ),
  delete: withErrorHandling((resource, params) =>
    baseProvider.delete(resolveResource(resource), params)
  ),
  deleteMany: async (resource, params) => {
    const resolved = resolveResource(resource);
    const { ids } = params;
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          baseProvider.delete(resolved, { id }),
        ),
      );
      const rejected = results.find((result) => result.status === "rejected");
      if (rejected && rejected.status === "rejected") {
        throw rejected.reason;
      }
      return { data: ids };
    } catch (error) {
      toast.error(extractErrorMessage(error));
      throw error;
    }
  },
};

export default dataProvider;
