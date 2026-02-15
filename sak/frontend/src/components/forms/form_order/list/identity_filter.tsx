"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGetIdentity, useListContext } from "ra-core";

export type IdentityFilterDefaultsOptions = {
  source?: string;
};

// Defaults de filtro por identidad para listados.
export const useIdentityFilterDefaults = ({
  source = "solicitante_id",
}: IdentityFilterDefaultsOptions = {}) => {
  const { data: identity } = useGetIdentity();
  const identityId = identity?.id;
  const defaultFilters = useMemo(
    () => (identityId ? { [source]: identityId } : {}),
    [identityId, source],
  );

  return { identityId, defaultFilters };
};

export type IdentityFilterSyncProps = {
  identityId?: number | string;
  source?: string;
};

// Sincroniza el filtro por identidad si no hay valor inicial.
export const IdentityFilterSync = ({
  identityId,
  source = "solicitante_id",
}: IdentityFilterSyncProps) => {
  const { filterValues, setFilters } = useListContext();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    if (identityId == null) return;
    const value = filterValues?.[source as keyof typeof filterValues];
    const hasValue =
      value != null && String(value).trim().length > 0;
    if (!hasValue) {
      setFilters({ ...filterValues, [source]: identityId }, {});
    }
    didInitRef.current = true;
  }, [filterValues, identityId, setFilters, source]);

  return null;
};
