"use client";

type LocationLike = {
  search?: string;
  hash?: string;
  state?: unknown;
};

type FilterRecord = Record<string, unknown>;

const parseNumber = (value: unknown) => {
  if (value == null) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric;
};

export const parseFilterParam = (search?: string) => {
  if (!search) return undefined;
  const params = new URLSearchParams(search);
  const rawFilter = params.get("filter");
  if (!rawFilter) return undefined;
  try {
    return JSON.parse(rawFilter) as FilterRecord;
  } catch {
    return undefined;
  }
};

const getSearchFromHash = (hash?: string) => {
  if (!hash) return undefined;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return undefined;
  return hash.slice(queryIndex);
};

export const getOportunidadIdFromLocation = (location: LocationLike) => {
  const rawSearch = location.search ?? "";
  const hashSearch = getSearchFromHash(location.hash);
  const params = new URLSearchParams(rawSearch || hashSearch || "");
  const filter = parseFilterParam(rawSearch) ?? parseFilterParam(hashSearch);
  const fromFilter =
    parseNumber(filter?.oportunidad_id) ?? parseNumber(filter?.id_oportunidad);
  if (fromFilter) return fromFilter;

  const direct =
    parseNumber(params.get("oportunidad_id")) ?? parseNumber(params.get("id_oportunidad"));
  if (direct) return direct;

  const state = location.state as { oportunidad_id?: unknown; filter?: FilterRecord } | null;
  const fromState =
    parseNumber(state?.oportunidad_id) ??
    parseNumber(state?.filter?.oportunidad_id) ??
    parseNumber((state as { id_oportunidad?: unknown } | null)?.id_oportunidad) ??
    parseNumber((state?.filter as FilterRecord | undefined)?.id_oportunidad);
  return fromState;
};

export const getContactoIdFromLocation = (location: LocationLike) => {
  const params = new URLSearchParams(location.search ?? "");
  const filter = parseFilterParam(location.search);
  const fromFilter = parseNumber(filter?.contacto_id);
  if (fromFilter) return fromFilter;

  const direct = parseNumber(params.get("contacto_id"));
  if (direct) return direct;

  const state = location.state as { contacto_id?: unknown; filter?: FilterRecord } | null;
  const fromState = parseNumber(state?.contacto_id) ?? parseNumber(state?.filter?.contacto_id);
  return fromState;
};

export const getReturnToFromLocation = (location: LocationLike) => {
  const params = new URLSearchParams(location.search ?? "");
  return params.get("returnTo") ?? undefined;
};

export const getContextFromLocation = (location: LocationLike) => {
  const params = new URLSearchParams(location.search ?? "");
  return params.get("context") ?? undefined;
};

export const buildFilterParam = (filter: FilterRecord) => JSON.stringify(filter);

export const buildOportunidadFilter = (oportunidadId: number, extra?: FilterRecord) => ({
  oportunidad_id: oportunidadId,
  ...(extra ?? {}),
});

export const appendFilterParam = (params: URLSearchParams, filter: FilterRecord) => {
  params.set("filter", buildFilterParam(filter));
};

export const buildFilterSearch = (filter: FilterRecord) =>
  `filter=${encodeURIComponent(buildFilterParam(filter))}`;

export const buildReturnToWithFilter = (path: string, filter: FilterRecord) =>
  `${path}?${buildFilterSearch(filter)}`;

export const buildReturnToWithOportunidad = (path: string, oportunidadId: number, extra?: FilterRecord) =>
  buildReturnToWithFilter(path, buildOportunidadFilter(oportunidadId, extra));
