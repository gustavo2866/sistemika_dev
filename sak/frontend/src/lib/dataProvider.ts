import simpleRestProvider from "ra-data-simple-rest";
import { DataProvider, fetchUtils } from "ra-core";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  deleteMany: async (resource, params) => {
    const { ids } = params;
    const results = await Promise.allSettled(
      ids.map((id) => baseProvider.delete(resource, { id }))
    );
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      throw rejected.reason;
    }
    return { data: ids };
  },
};

export default dataProvider;

