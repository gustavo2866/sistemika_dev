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

export const dataProvider: DataProvider = {
  ...baseProvider,
  getList: withErrorHandling((resource, params) => {
    if (resource === "crm/eventos" && params?.filter && "default_scope" in params.filter) {
      const { default_scope, ...restFilter } = params.filter as Record<string, unknown>;
      return baseProvider.getList("crm/eventos/default", { ...params, filter: restFilter });
    }
    return baseProvider.getList(resource, params);
  }),
  getOne: withErrorHandling((resource, params) => baseProvider.getOne(resource, params)),
  getMany: withErrorHandling((resource, params) => baseProvider.getMany(resource, params)),
  getManyReference: withErrorHandling((resource, params) =>
    baseProvider.getManyReference(resource, params)
  ),
  create: withErrorHandling((resource, params) => baseProvider.create(resource, params)),
  update: withErrorHandling((resource, params) => baseProvider.update(resource, params)),
  updateMany: withErrorHandling((resource, params) =>
    baseProvider.updateMany(resource, params)
  ),
  delete: withErrorHandling((resource, params) => baseProvider.delete(resource, params)),
  deleteMany: async (resource, params) => {
    const { ids } = params;
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          baseProvider.delete(resource, { id }),
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
