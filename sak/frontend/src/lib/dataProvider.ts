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
  return fetchUtils.fetchJson(url, { ...options, headers }).catch((error) => {
    if (error instanceof TypeError) {
      throw new Error(`No se pudo conectar con la API: ${url}`);
    }
    throw error;
  });
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

const stringifyErrorDetail = (detail: unknown): string | undefined => {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const entry = item as {
          loc?: unknown[];
          msg?: string;
          message?: string;
        };
        const field = Array.isArray(entry.loc)
          ? entry.loc.filter((part) => part !== "body").join(".")
          : undefined;
        const message = entry.msg || entry.message;
        if (field && message) return `${formatFieldLabel(field)}: ${message}`;
        return message || JSON.stringify(item);
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : undefined;
  }
  if (typeof detail === "object") {
    const detailObj = detail as {
      error?: { message?: string } | string;
      message?: string;
      error_description?: string;
      errorMessage?: string;
    };
    if (typeof detailObj.error === "string") return detailObj.error;
    return (
      detailObj.error?.message ||
      detailObj.message ||
      detailObj.error_description ||
      detailObj.errorMessage ||
      JSON.stringify(detail)
    );
  }
  return String(detail);
};

const extractErrorMessage = (error: unknown) => {
  const err = error as {
    body?: {
      detail?: unknown;
      error?: { message?: string };
      message?: string;
    };
    message?: string;
  };

  const rawMessage =
    stringifyErrorDetail(err?.body?.detail) ||
    err?.body?.error?.message ||
    err?.body?.message ||
    err?.message ||
    "Error inesperado";

  const notNullMatch = /null value in column "([^"]+)"/i.exec(rawMessage);
  if (notNullMatch?.[1]) {
    const label = formatFieldLabel(notNullMatch[1]);
    return `El campo ${label} es obligatorio.`;
  }

  const uniqueMatch = /duplicate key value violates unique constraint "([^"]+)"/i.exec(rawMessage);
  if (uniqueMatch?.[1]) {
    const constraint = uniqueMatch[1];
    if (constraint === "ix_propiedades_nombre") {
      return "Ya existe una propiedad con ese nombre.";
    }
    return "Registro duplicado. Verifica los datos.";
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

const isNotFoundError = (error: unknown) => {
  const err = error as { status?: number; response?: Response };
  return err?.status === 404 || err?.response?.status === 404;
};

type DataProviderOperation =
  | "getList"
  | "getOne"
  | "getMany"
  | "getManyReference"
  | "create"
  | "update"
  | "updateMany"
  | "delete"
  | "deleteMany";

const resolveResource = (
  resource: string,
  operation: DataProviderOperation,
) => {
  if (resource === "crm/crm-eventos") return "crm/eventos";
  if (resource === "po-orders-approval") {
    return operation === "getList" ? "po-orders/approval-feed" : "po-orders";
  }
  if (resource === "po-invoices-approval") {
    return operation === "getList" ? "po-invoices/approval-feed" : "po-invoices";
  }
  if (resource === "po-invoices-payments") {
    return operation === "getList" ? "po-invoices/payment-feed" : "po-invoices";
  }
  return resource;
};

export const dataProvider: DataProvider = {
  ...baseProvider,
  getList: withErrorHandling((resource, params) => {
    const resolved = resolveResource(resource, "getList");
    const meta = params?.meta as { fields?: string | string[]; include?: string | string[] } | undefined;
    if (meta?.fields || meta?.include) {
      const query = new URLSearchParams();
      query.set("sort", JSON.stringify([params?.sort?.field ?? "id", params?.sort?.order ?? "ASC"]));
      const page = params?.pagination?.page ?? 1;
      const perPage = params?.pagination?.perPage ?? 25;
      const start = (page - 1) * perPage;
      query.set("range", JSON.stringify([start, start + perPage - 1]));
      query.set("filter", JSON.stringify(params?.filter ?? {}));
      if (meta.fields) {
        query.set("fields", Array.isArray(meta.fields) ? meta.fields.join(",") : meta.fields);
      }
      if (meta.include) {
        query.set("include", Array.isArray(meta.include) ? meta.include.join(",") : meta.include);
      }
      const url = `${apiUrl}/${resolved}?${query.toString()}`;
      return httpClient(url, { signal: params?.signal }).then(({ headers, json }) => {
        const contentRange = headers.get("Content-Range");
        const total = contentRange ? Number(contentRange.split("/").pop()) : json.length;
        return { data: json, total: Number.isFinite(total) ? total : json.length };
      });
    }
    if (resolved === "crm/eventos" && params?.filter && "default_scope" in params.filter) {
      const { default_scope, ...restFilter } = params.filter as Record<string, unknown>;
      return (async () => {
        try {
          return await baseProvider.getList("crm/eventos/default", { ...params, filter: restFilter });
        } catch (error) {
          if (isNotFoundError(error)) {
            return baseProvider.getList(resolved, params);
          }
          throw error;
        }
      })();
    }
    return baseProvider.getList(resolved, params);
  }),
  getOne: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource, "getOne");
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
  getMany: withErrorHandling((resource, params) =>
    baseProvider.getMany(resolveResource(resource, "getMany"), params)
  ),
  getManyReference: withErrorHandling((resource, params) =>
    baseProvider.getManyReference(resolveResource(resource, "getManyReference"), params)
  ),
  create: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource, "create");
    if (typeof window !== "undefined") {
      console.log("[dataProvider] create", resolved, params);
    }
    const dataWithoutId = { ...(params.data as Record<string, unknown>) };
    if ("id" in dataWithoutId) {
      delete dataWithoutId.id;
    }
    const sanitized = sanitizeIdsInData(dataWithoutId);
    return baseProvider.create(resolved, { ...params, data: sanitized as any });
  }),
  update: withErrorHandling(async (resource, params) => {
    const resolved = resolveResource(resource, "update");
    if (typeof window !== "undefined") {
      console.log("[dataProvider] update", resolved, params);
    }
    const sanitized = sanitizeIdsInData(params.data);
    const response = await baseProvider.update(resolved, { ...params, data: sanitized as any });
    if (typeof window !== "undefined") {
      console.log("[dataProvider] update response", resolved, response);
    }
    return response;
  }),
  updateMany: withErrorHandling((resource, params) =>
    baseProvider.updateMany(resolveResource(resource, "updateMany"), params)
  ),
  delete: withErrorHandling((resource, params) =>
    baseProvider.delete(resolveResource(resource, "delete"), params)
  ),
  deleteMany: async (resource, params) => {
    const resolved = resolveResource(resource, "deleteMany");
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
