import simpleRestProvider from "ra-data-simple-rest";
import { DataProvider, fetchUtils } from "ra-core";

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

export const dataProvider: DataProvider = {
  ...baseProvider,
  getList: (resource, params) => {
    if (resource === "crm/eventos" && params?.filter && "default_scope" in params.filter) {
      const { default_scope, ...restFilter } = params.filter as Record<string, unknown>;
      return baseProvider.getList("crm/eventos/default", { ...params, filter: restFilter });
    }
    return baseProvider.getList(resource, params);
  },
  getOne: (resource, params) => baseProvider.getOne(resource, params),
  getMany: (resource, params) => baseProvider.getMany(resource, params),
  getManyReference: (resource, params) =>
    baseProvider.getManyReference(resource, params),
  create: (resource, params) => baseProvider.create(resource, params),
  update: (resource, params) => baseProvider.update(resource, params),
  updateMany: (resource, params) =>
    baseProvider.updateMany(resource, params),
  delete: (resource, params) => baseProvider.delete(resource, params),
  deleteMany: async (resource, params) => {
    const { ids } = params;
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
  },
};

export default dataProvider;
